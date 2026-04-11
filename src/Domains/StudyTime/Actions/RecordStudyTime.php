<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\Actions;

use AltUU\Domains\StudyTime\Actions\Results\RecordStudyTimeResult;
use AltUU\Domains\StudyTime\Events\StudyTimeRecorded;
use AltUU\Domains\StudyTime\ViewModels\StudyTimeResultViewModel;
use App\Models\PlaybackProgress;
use App\Services\UUStudyTimeClient;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Validator;

final readonly class RecordStudyTime
{
    public function __construct(private UUStudyTimeClient $studyTimeClient) {}

    public function __invoke(Request $request): RecordStudyTimeResult
    {
        $input = Validator::make($this->normalizeInput($request), [
            'cid' => ['required', 'string', 'max:64'],
            'activityId' => ['required', 'string', 'max:191'],
            'url' => ['required', 'url', 'max:2000'],
            'seconds' => ['nullable', 'integer', 'min:1', 'max:28800'],
            'startedAt' => ['nullable', 'date'],
            'positionSeconds' => ['nullable', 'numeric', 'min:0'],
        ])->validate();

        $seconds = (int) ($input['seconds'] ?? 0);
        $startedAt = isset($input['startedAt']) ? Date::parse((string) $input['startedAt']) : null;

        if ($seconds <= 0 && $startedAt instanceof \DateTimeInterface) {
            $seconds = max(1, $startedAt->diffInSeconds(Date::now()));
        }

        $seconds = max(1, min(28800, $seconds));

        $timeResult = $this->studyTimeClient->fetchServerTime();
        $serverTime = Arr::get($timeResult['payload'], 'data.server_time');
        $start = is_string($serverTime)
            ? Date::createFromFormat('Y-m-d H:i:s', $serverTime, 'Asia/Taipei')->subSeconds($seconds)
            : Date::now()->subSeconds($seconds);

        $payload = [
            'cid' => (string) $input['cid'],
            'url' => (string) $input['url'],
            'st' => $start->format('Y-m-d H:i:s'),
            'activity_id' => (string) $input['activityId'],
        ];

        $result = $this->studyTimeClient->recordStudyTime($payload);

        if (($result['payload']['code'] ?? 500) !== 0) {
            $result = $this->studyTimeClient->recordStudyTime([
                ...$payload,
                'et' => Date::now('Asia/Taipei')->format('Y-m-d H:i:s'),
            ]);
        }

        $uploadPayload = $result['payload'];

        $ok = ($uploadPayload['code'] ?? 500) === 0;

        if ($ok) {
            StudyTimeRecorded::dispatch((string) $input['cid']);
        }

        $positionSeconds = isset($input['positionSeconds']) ? (float) $input['positionSeconds'] : null;

        PlaybackProgress::updateOrCreate(
            [
                'cid' => (string) $input['cid'],
                'activity_id' => (string) $input['activityId'],
            ],
            [
                'duration_seconds' => $seconds,
                'position_seconds' => $positionSeconds ?? 0,
                'hungu_upload_success' => $ok,
            ],
        );

        return new RecordStudyTimeResult(
            viewModel: new StudyTimeResultViewModel(
                ok: $ok,
                seconds: (int) Arr::get($uploadPayload, 'data.seconds', $seconds),
                message: is_string($uploadPayload['message'] ?? null) ? $uploadPayload['message'] : null,
            ),
        );
    }

    private function normalizeInput(Request $request): array
    {
        return [
            'cid' => $request->input('cid'),
            'activityId' => $request->input('activityId', $request->input('activity_id')),
            'url' => $request->input('url'),
            'seconds' => $request->input('seconds'),
            'startedAt' => $request->input('startedAt', $request->input('started_at')),
            'positionSeconds' => $request->input('positionSeconds', $request->input('position_seconds')),
        ];
    }
}
