<?php

declare(strict_types=1);

namespace App\Services\Diagnostics;

use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\Client\Events\ConnectionFailed;
use Illuminate\Http\Client\Events\RequestSending;
use Illuminate\Http\Client\Events\ResponseReceived;
use Illuminate\Http\Client\Request;
use Throwable;

/**
 * Records every outbound HTTP call to an upstream service.
 *
 * Subscribing to the framework's HTTP client events covers UUProxyClient,
 * SchoolPortalProxyClient, NouToolsClient and AltUUPlusClient at once, with
 * no changes to any of them.
 *
 * The important case is the one that used to disappear. UUProxyClient ends
 * with `return ['payload' => $response->json() ?? []]` and NouToolsClient
 * with `if (! $response->successful()) return []`, so an upstream 500 becomes
 * an empty array, then an empty screen, served as HTTP 200. Recording here —
 * before any of that swallowing happens — is what makes the difference
 * between "the API failed" and "our parsing is wrong" visible at all.
 *
 * Lives here rather than in app/Listeners on purpose. It subscribes to three
 * events rather than handling one, so it does not fit the framework's
 * single-`handle()` listener convention that the arch preset enforces, and
 * keeping it out of that directory also keeps Laravel's event auto-discovery
 * from registering its methods a second time.
 */
final class UpstreamCallSubscriber
{
    /**
     * Request attribute set to false by callers that fetch raw HTML or files.
     *
     * The shared HTTP client always sends `Accept: application/json`, so the
     * header cannot tell a JSON call from a page fetch.
     */
    public const string EXPECTS_JSON_ATTRIBUTE = 'diagnostics.expects_json';

    /**
     * Start times keyed by request object id.
     *
     * @var array<int, float>
     */
    private array $startedAt = [];

    public function __construct(
        private readonly DiagnosticRecorder $recorder,
        private readonly UpstreamRecordingSwitch $recordingSwitch,
    ) {}

    /**
     * @return array<class-string, string>
     */
    public function subscribe(Dispatcher $events): array
    {
        return [
            RequestSending::class => 'recordRequestSending',
            ResponseReceived::class => 'recordResponseReceived',
            ConnectionFailed::class => 'recordConnectionFailed',
        ];
    }

    public function recordRequestSending(RequestSending $event): void
    {
        if ($this->shouldSkip()) {
            return;
        }

        $this->startedAt[spl_object_id($event->request)] = microtime(true);
    }

    public function recordResponseReceived(ResponseReceived $event): void
    {
        $duration = $this->takeDuration($event->request);

        if ($this->shouldSkip()) {
            return;
        }

        $status = $event->response->status();
        $body = $this->safeBody($event->response->body(...));

        // A 200 whose body will not decode is the other half of the problem:
        // the service answered, but not with anything we can use.
        $undecodableJson = $event->response->successful()
            && $this->looksLikeJsonRequest($event->request)
            && $body !== '' && json_decode($body, true) === null;

        $failed = ! $event->response->successful();

        if (! $failed && ! $undecodableJson) {
            $this->record(
                $event->request,
                DiagnosticLevelEnum::Info,
                $status,
                $duration,
                ['bodyBytes' => strlen($body)],
            );

            return;
        }

        $this->record(
            $event->request,
            $failed ? DiagnosticLevelEnum::Error : DiagnosticLevelEnum::Warning,
            $status,
            $duration,
            [
                'bodyBytes' => strlen($body),
                'reason' => $failed ? 'upstream_status' : 'undecodable_json',
                'bodySnippet' => $this->recorder->snippet($body),
            ],
            type: $undecodableJson && ! $failed
                ? DiagnosticEventTypeEnum::ParseAnomaly
                : DiagnosticEventTypeEnum::UpstreamCall,
        );
    }

    public function recordConnectionFailed(ConnectionFailed $event): void
    {
        $duration = $this->takeDuration($event->request);

        if ($this->shouldSkip()) {
            return;
        }

        $this->record(
            $event->request,
            DiagnosticLevelEnum::Error,
            null,
            $duration,
            [
                'reason' => 'connection_failed',
                'exception' => $event->exception::class,
                'detail' => $event->exception->getMessage(),
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function record(
        Request $request,
        DiagnosticLevelEnum $level,
        ?int $status,
        ?int $durationMs,
        array $context,
        DiagnosticEventTypeEnum $type = DiagnosticEventTypeEnum::UpstreamCall,
    ): void {
        $url = $this->recorder->redactor()->redactUrl($request->url());
        $host = parse_url($request->url(), PHP_URL_HOST) ?: 'unknown';

        $this->recorder->record(
            $type,
            mb_strtoupper($request->method()).' '.$url,
            $level,
            [...$context, 'host' => $host],
            status: $status,
            durationMs: $durationMs,
        );
    }

    private function shouldSkip(): bool
    {
        return ! $this->recorder->isEnabled() || $this->recordingSwitch->isSuppressed();
    }

    private function takeDuration(Request $request): ?int
    {
        $key = spl_object_id($request);
        $startedAt = $this->startedAt[$key] ?? null;
        unset($this->startedAt[$key]);

        return $startedAt === null ? null : (int) round((microtime(true) - $startedAt) * 1000);
    }

    private function looksLikeJsonRequest(Request $request): bool
    {
        $accept = mb_strtolower(implode(',', $request->header('accept')));

        if (($request->attributes()[self::EXPECTS_JSON_ATTRIBUTE] ?? true) === false) {
            return false;
        }

        return $accept === '' || str_contains($accept, 'json');
    }

    /**
     * @param  callable(): string  $reader
     */
    private function safeBody(callable $reader): string
    {
        try {
            return $reader();
        } catch (Throwable) {
            // Streamed or already-consumed bodies cannot be read back.
            return '';
        }
    }
}
