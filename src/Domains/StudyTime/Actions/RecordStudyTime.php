<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\Actions;

use AltUU\Domains\StudyTime\Actions\Results\RecordStudyTimeResult;
use AltUU\Domains\StudyTime\Events\StudyTimeRecorded;
use AltUU\Domains\StudyTime\ViewModels\StudyTimeResultViewModel;
use App\Models\AccountDailyActivity;
use App\Models\PlaybackProgress;
use App\Services\UUStudyTimeClient;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Validator;

final readonly class RecordStudyTime
{
    public function __construct(private UUStudyTimeClient $studyTimeClient) {}

    /**
     * Accepts camelCase or snake_case keys (`activityId`/`activity_id`, `startedAt`/`started_at`,
     * `positionSeconds`/`position_seconds`, `mediaDurationSeconds`/`media_duration_seconds`).
     *
     * @param  array<string, mixed>  $payload
     */
    public function __invoke(array $payload): RecordStudyTimeResult
    {
        $input = Validator::make($this->normalizeInput($payload), [
            'cid' => ['required', 'string', 'max:64'],
            'activityId' => ['required', 'string', 'max:191'],
            'url' => ['required', 'url', 'max:2000'],
            'seconds' => ['nullable', 'integer', 'min:1', 'max:28800'],
            'startedAt' => ['nullable', 'date'],
            'positionSeconds' => ['nullable', 'numeric', 'min:0'],
            'mediaDurationSeconds' => ['nullable', 'numeric', 'gt:0'],
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
            StudyTimeRecorded::dispatch((string) $input['cid'], $this->studyTimeClient->currentAccountId());
        }

        $positionSeconds = isset($input['positionSeconds']) ? (float) $input['positionSeconds'] : null;

        $mediaDurationSeconds = isset($input['mediaDurationSeconds']) ? (float) $input['mediaDurationSeconds'] : null;

        $accountId = $this->studyTimeClient->currentAccountId();

        PlaybackProgress::updateOrCreate(
            [
                'account_id' => $accountId,
                'cid' => (string) $input['cid'],
                'activity_id' => (string) $input['activityId'],
            ],
            [
                'duration_seconds' => $seconds,
                'position_seconds' => $positionSeconds ?? 0,
                'hungu_upload_success' => $ok,
                ...($mediaDurationSeconds !== null ? ['media_duration_seconds' => $mediaDurationSeconds] : []),
            ],
        );

        if ($accountId !== null) {
            $this->recordDailyActivity($accountId, $seconds);
        }

        return new RecordStudyTimeResult(
            viewModel: new StudyTimeResultViewModel(
                ok: $ok,
                seconds: (int) Arr::get($uploadPayload, 'data.seconds', $seconds),
                message: is_string($uploadPayload['message'] ?? null) ? $uploadPayload['message'] : null,
            ),
        );
    }

    private function recordDailyActivity(int $accountId, int $seconds): void
    {
        $activityDate = Date::now('Asia/Taipei')->toDateString();

        $activity = AccountDailyActivity::query()->firstOrCreate(
            ['account_id' => $accountId, 'activity_date' => $activityDate],
            ['total_seconds' => 0],
        );

        $activity->increment('total_seconds', $seconds);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normalizeInput(array $payload): array
    {
        return [
            'cid' => Arr::get($payload, 'cid'),
            'activityId' => Arr::get($payload, 'activityId', Arr::get($payload, 'activity_id')),
            'url' => Arr::get($payload, 'url'),
            'seconds' => Arr::get($payload, 'seconds'),
            'startedAt' => Arr::get($payload, 'startedAt', Arr::get($payload, 'started_at')),
            'positionSeconds' => Arr::get($payload, 'positionSeconds', Arr::get($payload, 'position_seconds')),
            'mediaDurationSeconds' => Arr::get($payload, 'mediaDurationSeconds', Arr::get($payload, 'media_duration_seconds')),
        ];
    }
}
