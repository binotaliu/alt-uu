<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\SchoolPortal\Actions\GetExamAgenda;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamAgendaItemViewModel;
use Illuminate\Http\Request;

final class ExamAgendaController
{
    /**
     * @return array{items: array<int, SchoolPortalExamAgendaItemViewModel>}
     */
    public function __invoke(Request $request, GetExamAgenda $getExamAgenda): array
    {
        return ['items' => $getExamAgenda($request)];
    }
}
