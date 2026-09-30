<?php

declare(strict_types=1);

use AltUU\AttachmentBridge\Events\DocumentPickCancelled;
use AltUU\AttachmentBridge\Events\DocumentPicked;
use App\Models\Account;
use App\Models\AccountDailyActivity;
use App\Models\KeyValueStore;
use App\Models\PlaybackProgress;
use App\NativeComponents\Account\DataExport;
use Illuminate\Support\Facades\File;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\AccountSeeding;

beforeEach(function (): void {
    $this->account = AccountSeeding::seed('s1111111');
    AccountSeeding::activate($this->account);
    File::deleteDirectory(storage_path('app/data-exports'));
});

afterEach(function (): void {
    File::deleteDirectory(storage_path('app/data-exports'));
});

function dataExportSubscribe(): void
{
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'subscription:entitlement'],
        ['value' => json_encode([
            'active' => true,
            'productId' => 'alt_uu_monthly',
            'expiresAt' => '2099-01-01T00:00:00+00:00',
            'platform' => 'ios',
            'reference' => null,
        ], JSON_THROW_ON_ERROR)],
    );
}

function dataExportSeedRecords(Account $account): void
{
    PlaybackProgress::create([
        'account_id' => $account->id,
        'cid' => '1001',
        'activity_id' => 'N-1',
        'duration_seconds' => 120,
        'position_seconds' => 45.5,
        'hungu_upload_success' => true,
    ]);
    AccountDailyActivity::create([
        'account_id' => $account->id,
        'activity_date' => '2026-05-01',
        'total_seconds' => 300,
    ]);
}

it('shows the export and import cards with the premium badge and upsell when not subscribed', function (): void {
    Native::test(DataExport::class)
        ->assertSee('匯出資料')
        ->assertSee('匯入資料')
        ->assertSee('Alt UU+')
        ->assertSee('想要匯入學習紀錄嗎？訂閱 Alt UU+ 即可解鎖此功能與更多內容。')
        ->assertSee('匯出為 JSON 檔案');
});

it('hides the premium badge and upsell when subscribed', function (): void {
    dataExportSubscribe();

    Native::test(DataExport::class)
        ->assertSet('subscribed', true)
        ->assertDontSee('想要匯入學習紀錄嗎？')
        ->assertMissingElement('button', fn (array $node): bool => ($node['ref'] ?? null) === 'subscribe');
});

it('exports to a json file and opens the share sheet even without a subscription', function (): void {
    dataExportSeedRecords($this->account);

    Native::test(DataExport::class)
        ->tap('export')
        ->assertSet('exporting', false)
        ->assertSet('exportError', '')
        ->assertNativeCalled('Share.File', fn (array $params): bool => str_ends_with($params['filePath'], '.json')
            && str_contains($params['filePath'], 'alt-uu-data-export-'))
        ->assertNativeCalled('Dialog.Toast', fn (array $params): bool => $params['message'] === '已匯出資料');

    $files = File::files(storage_path('app/data-exports'));
    $document = json_decode(File::get($files[0]->getPathname()), true);

    expect($files)->toHaveCount(1)
        ->and($document['accounts'])->toBe(['s1111111' => $this->account->id])
        ->and($document['playbackProgress'])->toHaveCount(1)
        ->and($document['accountDailyActivities'])->toHaveCount(1);
});

it('reports an export failure', function (): void {
    File::put(storage_path('app/data-exports'), 'not a directory');

    Native::test(DataExport::class)
        ->tap('export')
        ->assertSet('exporting', false)
        ->assertSet('exportError', '匯出失敗，請稍後再試。')
        ->assertSee('匯出失敗，請稍後再試。')
        ->assertNativeNotCalled('Share.File');

    File::delete(storage_path('app/data-exports'));
});

it('asks non-subscribers to upgrade instead of opening the import sheet', function (): void {
    Native::test(DataExport::class)
        ->tap('import')
        ->assertSet('upgradeSheetVisible', true)
        ->assertSet('importSheetVisible', false)
        ->assertSee('資料匯入為 Alt UU+ 專屬功能')
        ->tap('confirm')
        ->assertNavigatedTo('/native/courses/account/subscription');
});

it('dismisses the upgrade sheet with 關閉', function (): void {
    Native::test(DataExport::class)
        ->tap('import')
        ->tap('cancel')
        ->assertSet('upgradeSheetVisible', false)
        ->assertNoNavigation();
});

it('opens the subscription screen from the upsell card', function (): void {
    Native::test(DataExport::class)
        ->tap('subscribe')
        ->assertNavigatedTo('/native/courses/account/subscription');
});

it('imports pasted export data and summarises the result', function (): void {
    dataExportSubscribe();
    dataExportSeedRecords($this->account);

    Native::test(DataExport::class)->tap('export');
    $json = File::get(File::files(storage_path('app/data-exports'))[0]->getPathname());

    PlaybackProgress::query()->delete();
    AccountDailyActivity::query()->delete();

    $payload = json_decode($json, true);
    $payload['accounts']['s9999999'] = 99;
    $payload['playbackProgress'][] = [
        'username' => 's9999999', 'cid' => '2', 'activityId' => 'N-9',
        'durationSeconds' => 10, 'positionSeconds' => 1.0, 'hunguUploadSuccess' => null,
    ];

    Native::test(DataExport::class)
        ->tap('import')
        ->assertSet('importSheetVisible', true)
        ->input('import-text', json_encode($payload, JSON_UNESCAPED_UNICODE))
        ->tap('import-submit')
        ->assertSet('importSheetVisible', false)
        ->assertSet('importError', '')
        ->assertSee('已匯入 1 個帳號的資料，共 1 筆播放進度、1 筆每日學習活動。')
        ->assertSee('以下使用者名稱在本裝置找不到對應帳號，已略過：s9999999')
        ->assertNativeCalled('Dialog.Toast', fn (array $params): bool => $params['message'] === '已匯入資料');

    expect(PlaybackProgress::query()->count())->toBe(1)
        ->and(AccountDailyActivity::query()->count())->toBe(1);
});

it('rejects text that is not json', function (): void {
    dataExportSubscribe();

    Native::test(DataExport::class)
        ->tap('import')
        ->input('import-text', 'this is not json')
        ->tap('import-submit')
        ->assertSet('importSheetVisible', true)
        ->assertSet('importError', '匯入失敗，請確認檔案格式是否正確。')
        ->assertSet('importing', false);
});

it('rejects json with the wrong shape', function (): void {
    dataExportSubscribe();

    Native::test(DataExport::class)
        ->tap('import')
        ->input('import-text', '{"hello": "world"}')
        ->tap('import-submit')
        ->assertSet('importError', '匯入失敗，請確認檔案格式是否正確。');
});

it('sends the user to the upgrade sheet when the entitlement lapsed since it was cached', function (): void {
    dataExportSubscribe();

    $screen = Native::test(DataExport::class)
        ->tap('import')
        ->set('importText', '{"accounts": {"s1111111": 1}, "playbackProgress": [], "accountDailyActivities": []}');

    KeyValueStore::query()->where('key', 'subscription:entitlement')->delete();

    $screen->tap('import-submit')
        ->assertSet('subscribed', false)
        ->assertSet('importSheetVisible', false)
        ->assertSet('upgradeSheetVisible', true);
});

it('disables the submit button until something is pasted', function (): void {
    dataExportSubscribe();

    Native::test(DataExport::class)
        ->tap('import')
        ->assertElement('button', fn (array $node): bool => ($node['ref'] ?? null) === 'import-submit'
            && ($node['props']['disabled'] ?? false) === true);
});

it('cancels the import sheet without importing', function (): void {
    dataExportSubscribe();

    Native::test(DataExport::class)
        ->tap('import')
        ->tap('import-cancel')
        ->assertSet('importSheetVisible', false)
        ->assertSet('importResult', null);
});

// ── Document picker ─────────────────────────────────────────────────────────

function dataExportFakePicker(): void
{
    Native::fakeBridge()->respondTo('AttachmentBridge.PickDocument', ['status' => 'success', 'data' => ['queued' => true]]);
}

function dataExportPickedFile(string $contents): string
{
    File::ensureDirectoryExists(storage_path('app/data-exports'));
    $path = storage_path('app/data-exports/picked-'.bin2hex(random_bytes(4)).'.json');
    File::put($path, $contents);

    return $path;
}

function dataExportEmptyDocument(): string
{
    return '{"accounts": {"s1111111": 1}, "playbackProgress": [], "accountDailyActivities": []}';
}

it('opens the document picker instead of the paste sheet when one is available', function (): void {
    dataExportSubscribe();
    dataExportFakePicker();

    $screen = Native::test(DataExport::class)
        ->tap('import')
        ->assertNativeCalled('AttachmentBridge.PickDocument', fn (array $params): bool => $params['mimeTypes'] === ['application/json', 'text/plain']
            && $params['id'] !== ''
            && str_ends_with($params['event'], 'DocumentPicked'))
        ->assertSet('importSheetVisible', false)
        ->assertSet('upgradeSheetVisible', false);

    expect($screen->get('pickId'))->not->toBe('');
});

it('falls back to the paste sheet when the picker is unavailable', function (): void {
    dataExportSubscribe();

    Native::test(DataExport::class)
        ->tap('import')
        ->assertSet('importSheetVisible', true)
        ->assertSet('pickId', '');
});

it('imports the picked file, summarises it and deletes the temporary copy', function (): void {
    dataExportSubscribe();
    dataExportSeedRecords($this->account);
    dataExportFakePicker();

    Native::test(DataExport::class)->tap('export');
    $json = File::get(File::files(storage_path('app/data-exports'))[0]->getPathname());
    PlaybackProgress::query()->delete();
    AccountDailyActivity::query()->delete();

    $path = dataExportPickedFile($json);

    $screen = Native::test(DataExport::class)->tap('import');

    $screen->emitNative(DocumentPicked::class, [
        'id' => $screen->get('pickId'),
        'path' => $path,
        'name' => 'export.json',
        'mimeType' => 'application/json',
        'size' => strlen($json),
    ])
        ->assertSet('pickId', '')
        ->assertSet('importError', '')
        ->assertSee('已匯入 1 個帳號的資料，共 1 筆播放進度、1 筆每日學習活動。')
        ->assertNativeCalled('Dialog.Toast', fn (array $params): bool => $params['message'] === '已匯入資料');

    expect(File::exists($path))->toBeFalse()
        ->and(PlaybackProgress::query()->count())->toBe(1);
});

it('ignores a picked file that belongs to another request', function (): void {
    dataExportSubscribe();
    dataExportFakePicker();

    $path = dataExportPickedFile(dataExportEmptyDocument());

    Native::test(DataExport::class)
        ->tap('import')
        ->emitNative(DocumentPicked::class, ['id' => 'someone-else', 'path' => $path, 'name' => 'x.json', 'mimeType' => 'application/json', 'size' => 10])
        ->assertSet('importResult', null)
        ->assertNativeNotCalled('Dialog.Toast');

    expect(File::exists($path))->toBeTrue();
});

it('shows an error for a picked file that is not a valid export', function (): void {
    dataExportSubscribe();
    dataExportFakePicker();

    $path = dataExportPickedFile('definitely not json');

    $screen = Native::test(DataExport::class)->tap('import');

    $screen->emitNative(DocumentPicked::class, ['id' => $screen->get('pickId'), 'path' => $path, 'name' => 'x.json', 'mimeType' => 'application/json', 'size' => 19])
        ->assertSet('importSheetVisible', false)
        ->assertSet('importError', '匯入失敗，請確認檔案格式是否正確。')
        ->assertSee('匯入失敗，請確認檔案格式是否正確。');

    expect(File::exists($path))->toBeFalse();
});

it('reports an unreadable picked file', function (): void {
    dataExportSubscribe();
    dataExportFakePicker();

    $screen = Native::test(DataExport::class)->tap('import');

    $screen->emitNative(DocumentPicked::class, ['id' => $screen->get('pickId'), 'path' => storage_path('app/data-exports/missing.json'), 'name' => 'x.json', 'mimeType' => 'application/json', 'size' => 0])
        ->assertSet('importError', '無法讀取所選檔案。');
});

it('stays quiet when the picker is dismissed and explains oversized or failed picks', function (string $reason, string $expected): void {
    dataExportSubscribe();
    dataExportFakePicker();

    $screen = Native::test(DataExport::class)->tap('import');

    $screen->emitNative(DocumentPickCancelled::class, ['id' => $screen->get('pickId'), 'reason' => $reason])
        ->assertSet('pickId', '')
        ->assertSet('importError', $expected)
        ->assertSet('importSheetVisible', false);
})->with([
    'dismissed' => ['cancelled', ''],
    'too large' => ['too_large', '檔案太大，無法匯入。'],
    'failed' => ['failed', '無法讀取所選檔案。'],
]);
