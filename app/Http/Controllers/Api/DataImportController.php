<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\DataPortability\Actions\ImportAccountData;
use AltUU\Domains\DataPortability\DataTransferObjects\ImportDataInputData;
use AltUU\Domains\DataPortability\ViewModels\DataImportResultViewModel;

final class DataImportController
{
    public function __invoke(ImportDataInputData $input, ImportAccountData $importAccountData): DataImportResultViewModel
    {
        return $importAccountData($input);
    }
}
