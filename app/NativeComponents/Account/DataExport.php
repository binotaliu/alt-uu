<?php

declare(strict_types=1);

namespace App\NativeComponents\Account;

use AltUU\Domains\Account\Exceptions\PremiumRequiredException;
use AltUU\Domains\DataPortability\Actions\ExportAccountData;
use AltUU\Domains\DataPortability\Actions\ImportAccountData;
use AltUU\Domains\DataPortability\DataTransferObjects\ImportDataInputData;
use AltUU\Domains\DataPortability\ViewModels\DataImportResultViewModel;
use AltUU\Domains\Subscription\Actions\GetCachedEntitlement;
use App\NativeComponents\Concerns\ShowsToasts;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use JsonException;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Share;
use Throwable;

/**
 * Learning-record backup and restore (Account/DataExport.vue).
 *
 * Export writes the JSON document to app storage and hands it to the system
 * share sheet (which offers "Save to Files" / other apps), replacing the SPA's
 * AttachmentBridge download of `/api/data-export`.
 *
 * Import is gated by Alt UU+ (the cached entitlement decides which UI to show,
 * `ImportAccountData` re-checks and throws PremiumRequiredException). The core
 * `File` facade only offers move/copy, and no installed plugin exposes a
 * document picker to PHP, so the SPA's file input cannot be reproduced: the
 * user pastes the exported JSON text into a sheet instead. Replace
 * `submitImport()`'s source with the picked file's contents once a picker
 * exists.
 */
final class DataExport extends NativeComponent
{
    use ShowsToasts;

    public bool $subscribed = false;

    public bool $exporting = false;

    public string $exportError = '';

    public bool $importSheetVisible = false;

    public string $importText = '';

    public bool $importing = false;

    public string $importError = '';

    public ?DataImportResultViewModel $importResult = null;

    public bool $upgradeSheetVisible = false;

    public function navTitle(): string
    {
        return '資料匯出入';
    }

    public function mount(): void
    {
        $this->refreshSubscription();
    }

    public function onResume(): void
    {
        $this->refreshSubscription();
    }

    public function exportData(): void
    {
        if ($this->exporting) {
            return;
        }

        $this->exporting = true;
        $this->exportError = '';

        try {
            $directory = storage_path('app/data-exports');
            File::ensureDirectoryExists($directory);

            $path = $directory.'/alt-uu-data-export-'.Date::now()->format('Y-m-d').'.json';
            File::put($path, json_encode(
                app(ExportAccountData::class)()->toArray(),
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT,
            ));

            Share::file('匯出資料', '', $path);
            $this->toastSuccess('已匯出資料');
        } catch (Throwable) {
            $this->exportError = '匯出失敗，請稍後再試。';
        } finally {
            $this->exporting = false;
        }
    }

    public function openImport(): void
    {
        if (! $this->subscribed) {
            $this->upgradeSheetVisible = true;

            return;
        }

        $this->importError = '';
        $this->importSheetVisible = true;
    }

    public function closeImport(): void
    {
        if (! $this->importing) {
            $this->importSheetVisible = false;
        }
    }

    public function submitImport(): void
    {
        if ($this->importing) {
            return;
        }

        $this->importing = true;
        $this->importError = '';
        $this->importResult = null;

        try {
            $payload = json_decode(trim($this->importText), true, 512, JSON_THROW_ON_ERROR);

            if (! is_array($payload)) {
                throw new JsonException('Not an object.');
            }

            $this->importResult = app(ImportAccountData::class)(ImportDataInputData::validateAndCreate($payload));
            $this->importSheetVisible = false;
            $this->importText = '';
            $this->toastSuccess('已匯入資料');
        } catch (PremiumRequiredException) {
            $this->subscribed = false;
            $this->importSheetVisible = false;
            $this->upgradeSheetVisible = true;
        } catch (ValidationException|JsonException) {
            $this->importError = '匯入失敗，請確認檔案格式是否正確。';
        } catch (Throwable) {
            $this->importError = '匯入失敗，請稍後再試。';
        } finally {
            $this->importing = false;
        }
    }

    public function closeUpgrade(): void
    {
        $this->upgradeSheetVisible = false;
    }

    public function openSubscription(): void
    {
        $this->upgradeSheetVisible = false;
        $this->navigate($this->route('native.courses.account.subscription'));
    }

    public function render(): View
    {
        return view('native.account.data-export');
    }

    private function refreshSubscription(): void
    {
        $this->subscribed = app(GetCachedEntitlement::class)()->active;
    }
}
