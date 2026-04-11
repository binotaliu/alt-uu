<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use AltUU\Domains\StudyTime\Actions\RecordStudyTime;
use AltUU\Domains\StudyTime\ViewModels\StudyTimeResultViewModel;
use Illuminate\Http\Request;

final class StudyTimeController
{
    public function store(Request $request, RecordStudyTime $record): StudyTimeResultViewModel
    {
        $result = $record($request);

        return $result->viewModel;
    }
}
