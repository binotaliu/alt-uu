<?php

use AltUU\Domains\Course\Actions\CourseTypeMatcher;
use AltUU\Domains\Course\Support\VideoExtractors\FlowplayerJsConfigVideoExtractor;
use AltUU\Domains\Course\Support\VideoExtractors\Html5SourceVideoExtractor;
use AltUU\Domains\Course\Support\YoutubeEmbedUrlParser;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use App\Models\Account;
use App\Models\AccountDailyActivity;
use App\Models\BlockedContent;
use App\Models\KeyValueStore;
use App\Models\PlaybackProgress;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\Diagnostics\DiagnosticRedactor;
use App\Services\SchoolPortalSessionStore;
use App\Services\UUProxyClient;
use App\Services\UUSessionStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Facades\System;
use Tests\TestCase;

class GoldenTest extends TestCase
{
    use RefreshDatabase;

    private string $out;

    /** @return array<string, array{0: array<string, mixed>}> */
    public static function cases(): array
    {
        $manifest = json_decode(file_get_contents(__DIR__.'/manifest.json'), true);
        $only = getenv('GOLDEN_ONLY') ?: null;
        $cases = [];
        foreach ($manifest['cases'] as $case) {
            if ($only !== null && ! str_contains($case['domain'].'/'.$case['name'], $only)) {
                continue;
            }
            $case['out'] = $manifest['out'];
            $cases[$case['domain'].'/'.$case['name']] = [$case];
        }

        return $cases;
    }

    /** @dataProvider cases */
    #[\PHPUnit\Framework\Attributes\DataProvider('cases')]
    public function test_golden(array $case): void
    {
        $this->out = $case['out'];
        $dir = $this->out.'/'.$case['domain'];
        $cases = match ($case['kind']) {
            'material-parsed' => $this->materialParsed($case, $dir),
            'extractor' => $this->extractor($case, $dir),
            'youtube' => $this->youtube($case, $dir),
            'course-type-matcher' => $this->courseTypeMatcher($case, $dir),
            'endpoint' => $this->endpoint($case, $dir),
            'portal-action' => $this->portalAction($case, $dir),
            'redactor' => $this->redactor($case, $dir),
            'app-status' => $this->appStatus($case, $dir),
            'data-export' => $this->dataExport($case),
            'data-import' => $this->dataImport($case, $dir),
            'hungu-login' => $this->hunguLogin($case),
        };

        file_put_contents(
            $dir.'/'.$case['name'].'.golden.json',
            json_encode([
                'generatedBy' => 'real PHP legacy app (alt-uu-legacy worktree of main)',
                'phpClass' => $case['cls'],
                'cases' => $cases,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_PRESERVE_ZERO_FRACTION)."\n",
        );
        $this->assertTrue(true);
    }

    private function sessions(string $baseUrl = 'https://uu.nou.edu.tw'): Account
    {
        app(AccountCredentialsStore::class)->put('s123', 'test-password');
        app(UUSessionStore::class)->put([
            'base_url' => $baseUrl,
            'ua' => 'test-agent',
            'ticket' => 'ticket-1',
            'session_idx' => 'idx-1',
            'cookies' => ['WM' => 'cookie'],
            'profile' => ['display_name' => '測試', 'username' => 's123'],
        ]);
        app(SchoolPortalSessionStore::class)->put([
            'base_url' => 'https://nouapp.nou.edu.tw',
            'ua' => 'test-agent',
            'cookies' => ['session' => 'abc'],
        ]);

        return Account::query()->where('username', 's123')->firstOrFail();
    }

    /** @param  array<int, array<string, mixed>>  $fakes */
    private function fake(array $fakes, string $dir): void
    {
        $map = [];
        foreach ($fakes as $fake) {
            $status = $fake['status'] ?? 200;
            $headers = $fake['headers'] ?? [];
            if (isset($fake['file'])) {
                $body = file_get_contents($dir.'/'.$fake['file']);
                if (str_ends_with($fake['file'], '.json')) {
                    $body = json_decode($body, true);
                }
            } elseif (isset($fake['json'])) {
                $body = $fake['json'];
            } else {
                $body = $fake['body'] ?? '';
            }
            $map[$fake['match']] = Http::response($body, $status, $headers);
        }
        $map['*'] = Http::response('', 404);
        Http::fake($map);
    }

    /** @return array<int, array<string, mixed>> */
    private function recorded(): array
    {
        return collect(Http::recorded())->map(function (array $pair): array {
            /** @var HttpRequest $request */
            $request = $pair[0];

            return [
                'method' => $request->method(),
                'url' => $request->url(),
                'body' => $request->body() === '' ? null : $request->body(),
            ];
        })->all();
    }

    private function materialParsed(array $case, string $dir): array
    {
        $this->sessions($case['baseUrl']);
        $responses = $case['responses'];
        $map = [];
        $make = fn (array $r) => Http::response(
            $r['file'] !== null ? file_get_contents($dir.'/'.$r['file']) : '',
            $r['status'],
            $r['headers'],
        );
        if (count($responses) === 1) {
            $map[$case['url']] = $make($responses[0]);
        } elseif (count($responses) > 1) {
            $seq = Http::sequence();
            foreach ($responses as $r) {
                $seq->push($r['file'] !== null ? file_get_contents($dir.'/'.$r['file']) : '', $r['status'], $r['headers']);
            }
            $map[$case['url']] = $seq;
        }
        $map['*'] = Http::response('', 404);
        Http::fake($map);

        $response = $this->getJson('/materials/content/parsed?url='.rawurlencode($case['url']));

        return [[
            'name' => $case['name'],
            'input' => ['url' => $case['url'], 'sessionBaseUrl' => $case['baseUrl']],
            'output' => ['status' => $response->status(), 'json' => $response->json(), 'upstreamRequests' => collect($this->recorded())->map(fn ($r) => $r['method'].' '.$r['url'])->all()],
        ]];
    }

    private function extractor(array $case, string $dir): array
    {
        $html = file_get_contents($dir.'/'.$case['file']);
        $dump = fn ($v) => $v === null ? null : ['videoUrl' => $v->videoUrl, 'subtitleUrl' => $v->subtitleUrl];
        $output = match ($case['extractor']) {
            'html5' => $dump((new Html5SourceVideoExtractor)->extract($html)),
            'flowplayerJs' => $dump((new FlowplayerJsConfigVideoExtractor)->extract($html)),
            'both' => ['html5' => $dump((new Html5SourceVideoExtractor)->extract($html)), 'flowplayerJs' => $dump((new FlowplayerJsConfigVideoExtractor)->extract($html))],
        };

        return [['name' => $case['name'], 'input' => ['file' => $case['file']], 'output' => $output]];
    }

    private function youtube(array $case, string $dir): array
    {
        $items = json_decode(file_get_contents($dir.'/'.$case['file']), true);

        return array_map(fn ($i) => ['name' => $i['name'], 'input' => ['url' => $i['url']], 'output' => YoutubeEmbedUrlParser::extractVideoId($i['url'])], $items);
    }

    private function courseTypeMatcher(array $case, string $dir): array
    {
        $in = json_decode(file_get_contents($dir.'/'.$case['file']), true);

        return [['name' => $case['name'], 'input' => $in, 'output' => (new CourseTypeMatcher)($in['course'], $in['courseTypesByTitleKey'])]];
    }

    private function endpoint(array $case, string $dir): array
    {
        $this->sessions();
        if (! empty($case['nouTools'])) {
            KeyValueStore::query()->updateOrCreate(['key' => 'preference:nou-tools-integration'], ['value' => json_encode(['enabled' => true])]);
        }
        foreach ($case['blocked'] ?? [] as $b) {
            BlockedContent::create(['board_hash' => hash('sha256', $b['board']), 'node_hash' => hash('sha256', $b['node']), 'reason' => $b['reason'], 'blocked_at' => now()]);
        }
        $this->fake($case['fakes'], $dir);

        $calls = $case['calls'] ?? [['name' => $case['name'], 'method' => $case['method'] ?? 'GET', 'path' => $case['path'], 'json' => $case['json'] ?? null]];
        $results = [];
        foreach ($calls as $call) {
            $response = $this->json($call['method'], $call['path'], $call['json'] ?? []);
            $results[] = [
                'name' => $call['name'],
                'input' => ['method' => $call['method'], 'path' => $call['path']] + (isset($call['json']) ? ['body' => $call['json']] : []),
                'output' => ['status' => $response->status(), 'json' => $response->json()],
            ];
        }
        if (! empty($case['recordRequests'])) {
            $results[count($results) - 1]['upstreamRequests'] = $this->recorded();
        }

        return $results;
    }

    private function portalAction(array $case, string $dir): array
    {
        $this->sessions();
        $this->fake($case['fakes'], $dir);
        $action = app('AltUU\\Domains\\SchoolPortal\\Actions\\'.$case['action']);
        $results = [];
        foreach ($case['runs'] as $run) {
            $c = $run['course'];
            $result = $action(Request::create('/'), new CourseItemViewModel(courseId: $c['courseId'], semester: $c['semester'], name: $c['name']));
            $output = match (true) {
                $result === null => null,
                method_exists($result, 'items') => array_map(fn ($i) => $i->toArray(), $result->items()),
                default => $result->toArray(),
            };
            $results[] = ['name' => $run['name'], 'input' => ['course' => $c], 'output' => $output];
        }

        return $results;
    }

    private function redactor(array $case, string $dir): array
    {
        $items = json_decode(file_get_contents($dir.'/'.$case['file']), true);
        $results = [];
        foreach ($items as $i) {
            $r = new DiagnosticRedactor($i['salt']);
            $output = match ($i['op']) {
                'redact' => $r->redact($i['input']),
                'redactText' => $r->redactText($i['input']),
                'redactUrl' => $r->redactUrl($i['input']),
                'redactSecrets' => $r->redactSecrets($i['input']),
                'pseudonymizeStable' => array_map(fn ($v) => $r->pseudonymize($v), $i['input']),
                'pseudonymizeSalts' => [(new DiagnosticRedactor($i['input']['saltA']))->pseudonymize($i['input']['value']), (new DiagnosticRedactor($i['input']['saltB']))->pseudonymize($i['input']['value'])],
            };
            $results[] = ['name' => $i['name'], 'input' => ['op' => $i['op'], 'salt' => $i['salt'], 'input' => $i['input']], 'output' => $output];
        }

        return $results;
    }

    private function appStatus(array $case, string $dir): array
    {
        $scenarios = json_decode(file_get_contents($dir.'/'.$case['file']), true);
        $results = [];
        $platform = 'ios';
        System::shouldReceive('isAndroid')->andReturnUsing(function () use (&$platform) {
            return $platform === 'android';
        });
        foreach ($scenarios as $s) {
            \App\Models\KeyValueStore::query()->truncate();
            Cache::flush();
            $platform = $s['context']['platform'];
            Date::setTestNow($s['context']['now'] ?? null);
            config(['services.statics.base_url' => 'https://statics.test', 'nativephp.version' => $s['context']['appVersion']]);

            $fakeFeed = function ($feed, int $status = 200) {
                Http::swap(new Factory);
                Http::preventStrayRequests();
                Http::fake(['https://statics.test/status.json' => Http::response($feed ?? 'boom', $status)]);
            };
            $fakeFeed($s['feed'], $s['feedHttpStatus'] ?? 200);
            foreach ($s['context']['dismissals'] as $key) {
                $this->postJson('/api/app-status/dismissals', ['dismissKey' => $key]);
            }
            if (! empty($s['context']['cacheFlushedBeforeFeed'])) {
                Cache::flush();
            }
            $response = $this->getJson('/api/app-status');
            $results[] = ['name' => $s['name'], 'input' => ['context' => $s['context'], 'feed' => $s['feed']], 'output' => ['status' => $response->status(), 'json' => $response->json()]];
        }
        Date::setTestNow();

        return $results;
    }

    private function activateSubscription(): void
    {
        KeyValueStore::query()->updateOrCreate(['key' => 'subscription:entitlement'], ['value' => json_encode(['active' => true, 'productId' => 'alt_uu_premium_monthly', 'expiresAt' => '2027-01-01T00:00:00+00:00', 'platform' => 'ios', 'reference' => null])]);
    }

    private function portabilityAccount(string $username): Account
    {
        app(AccountCredentialsStore::class)->put($username, 'test-password');
        $account = Account::query()->where('username', $username)->firstOrFail();
        app(UUSessionStore::class)->put(['base_url' => 'https://uu-data-export.nou.edu.tw', 'ua' => 'test-agent', 'ticket' => 't', 'session_idx' => 'i', 'cookies' => ['WM' => 'c'], 'profile' => ['display_name' => "測試學生 {$username}", 'username' => $username, 'picture' => '', 'realname' => "測試學生 {$username}"]], $account->id);
        app(AccountActiveProfile::class)->set($account->id);

        return $account;
    }

    private function dataExport(array $case): array
    {
        Date::setTestNow('2026-07-10T12:00:00+00:00');
        $account = $this->portabilityAccount('s2222222');
        $this->activateSubscription();
        PlaybackProgress::create(['account_id' => $account->id, 'cid' => '1001', 'activity_id' => 'N-1', 'duration_seconds' => 120, 'position_seconds' => 42.5, 'hungu_upload_success' => true]);
        AccountDailyActivity::factory()->create(['account_id' => $account->id, 'activity_date' => '2026-07-10', 'total_seconds' => 900]);
        $response = $this->withCookie(config('hungu.app_boot_cookie_name'), '1')->getJson('/api/data-export');
        Date::setTestNow();

        return [['name' => 'exports accounts, playback progress, and daily activity keyed by username', 'input' => ['account' => 's2222222'], 'output' => ['status' => $response->status(), 'json' => $response->json(), 'contentDispositionHeader' => (bool) $response->headers->get('Content-Disposition')]]];
    }

    private function dataImport(array $case, string $dir): array
    {
        $account = $this->portabilityAccount($case['username']);
        if (($case['subscription'] ?? true) !== false) {
            $this->activateSubscription();
        }
        $payload = json_decode(file_get_contents($dir.'/'.$case['payloadFile']), true);
        for ($i = 0; $i < ($case['times'] ?? 1); $i++) {
            $response = $this->withCookie(config('hungu.app_boot_cookie_name'), '1')->postJson('/api/data-export/import', $payload);
        }

        return [[
            'name' => $case['name'],
            'input' => ['payloadFile' => $case['payloadFile'], 'times' => $case['times'] ?? 1, 'localAccount' => $case['username']],
            'output' => [
                'status' => $response->status(),
                'json' => $response->json(),
                'playbackProgressRows' => PlaybackProgress::query()->where('account_id', $account->id)->get(['cid', 'activity_id', 'duration_seconds', 'position_seconds', 'hungu_upload_success'])->toArray(),
                'accountDailyActivityRows' => AccountDailyActivity::query()->where('account_id', $account->id)->get(['activity_date', 'total_seconds'])->toArray(),
            ],
        ]];
    }

    private function hunguLogin(array $case): array
    {
        $base = 'https://uu.nou.edu.tw';
        Http::fake([
            $base.'/' => Http::response($case['warmup'][0]['body'], $case['warmup'][0]['status'], $case['warmup'][0]['headers']),
            $base.'/learn/index.php' => Http::response($case['warmup'][1]['body'], $case['warmup'][1]['status'], $case['warmup'][1]['headers']),
            $base.'/xmlapi/index.php?action=login*' => Http::response($case['login']['body'], $case['login']['status'], $case['login']['headers'] ?? []),
        ]);
        $client = app(UUProxyClient::class);
        $result = $client->login($base, 'test-agent', $case['username'], $case['password']);
        $requests = collect($this->recorded())->map(function (array $r): array {
            if ($r['body'] !== null) {
                $form = json_decode($r['body'], true);
                if (! is_array($form)) {
                    parse_str($r['body'], $form);
                }
                foreach (['username', 'password'] as $k) {
                    if (isset($form[$k])) {
                        $form[$k] = '<encrypted (non-deterministic): '.strlen($form[$k]).' chars>';
                    }
                }
                $r['body'] = $form;
            }

            return $r;
        })->all();

        return [['name' => 'login', 'input' => ['baseUrl' => $base, 'ua' => 'test-agent', 'username' => $case['username'], 'password' => $case['password']], 'output' => ['result' => $result, 'upstreamRequests' => $requests]]];
    }
}
