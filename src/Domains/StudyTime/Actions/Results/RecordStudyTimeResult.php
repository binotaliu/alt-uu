<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\Actions\Results;

use AltUU\Domains\StudyTime\ViewModels\StudyTimeResultViewModel;

final readonly class RecordStudyTimeResult
{
    public function __construct(
        public StudyTimeResultViewModel $viewModel,
    ) {}
}
