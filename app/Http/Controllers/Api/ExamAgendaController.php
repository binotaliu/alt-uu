<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\SchoolPortal\Actions\GetExamAgenda;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamAgendaItemViewModel;

final class ExamAgendaController
{
    /**
     * @return array{items: array<int, SchoolPortalExamAgendaItemViewModel>}
     */
    public function __invoke(GetExamAgenda $getExamAgenda): array
    {
        return ['items' => $getExamAgenda()];
    }
}
