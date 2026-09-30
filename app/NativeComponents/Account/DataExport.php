<?php

declare(strict_types=1);

namespace App\NativeComponents\Account;

use AltUU\AttachmentBridge\Events\DocumentPickCancelled;
use AltUU\AttachmentBridge\Events\DocumentPicked;
use AltUU\AttachmentBridge\Facades\AttachmentBridge;
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
use Native\Mobile\Attributes\On;
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
 * `ImportAccountData` re-checks and throws PremiumRequiredException). Tapping
 * import opens the system document picker (`AttachmentBridge::pickDocument()`,
 * result via `DocumentPicked` / `DocumentPickCancelled`), like the SPA's file
 * input. When no picker is available (`pickDocument()` returns null) the user
 * pastes the exported JSON text into a sheet instead.
 */ final class DataExport extends NativeComponent
{
    use ShowsToasts;

    public bool $subscribed = false;

    public bool $exporting = false;

    public string $exportError = '';

    public bool $importSheetVisible = false;

    /** Correlation id of the document picker request in flight, '' when none. */
    public string $pickId = '';

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
        $this->importResult = null;

        $pickId = AttachmentBridge::pickDocument(['application/json', 'text/plain']);

        if ($pickId === null) {
            $this->importSheetVisible = true;

            return;
        }

        $this->pickId = $pickId;
    }

    #[On(DocumentPicked::class)]
    public function onDocumentPicked(?string $id, string $path, string $name, string $mimeType, int $size): void
    {
        if ($this->pickId === '' || $id !== $this->pickId) {
            return;
        }

        $this->pickId = '';

        try {
            $json = File::get($path);
        } catch (Throwable) {
            $this->importError = '無法讀取所選檔案。';

            return;
        } finally {
            File::delete($path);
        }

        $this->importJson($json);
    }

    #[On(DocumentPickCancelled::class)]
    public function onDocumentPickCancelled(?string $id, string $reason = 'cancelled'): void
    {
        if ($this->pickId === '' || $id !== $this->pickId) {
            return;
        }

        $this->pickId = '';

        $this->importError = match ($reason) {
            'too_large' => '檔案太大，無法匯入。',
            'failed' => '無法讀取所選檔案。',
            default => '',
        };
    }

    public function closeImport(): void
    {
        if (! $this->importing) {
            $this->importSheetVisible = false;
        }
    }

    public function submitImport(): void
    {
        $this->importJson($this->importText);
    }

    private function importJson(string $json): void
    {
        if ($this->importing) {
            return;
        }

        $this->importing = true;
        $this->importError = '';
        $this->importResult = null;

        try {
            $payload = json_decode(trim($json), true, 512, JSON_THROW_ON_ERROR);

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
