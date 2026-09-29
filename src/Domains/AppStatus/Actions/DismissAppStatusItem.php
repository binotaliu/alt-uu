<?php

declare(strict_types=1);

namespace AltUU\Domains\AppStatus\Actions;

use AltUU\Domains\AppStatus\DataTransferObjects\DismissAppStatusItemInputData;
use AltUU\Domains\AppStatus\DismissedAppStatusStore;
use AltUU\Domains\AppStatus\ViewModels\AppStatusViewModel;

final readonly class DismissAppStatusItem
{
    public function __construct(
        private DismissedAppStatusStore $dismissedStore,
        private GetAppStatus $getAppStatus,
    ) {}

    public function __invoke(DismissAppStatusItemInputData $input): AppStatusViewModel
    {
        $this->dismissedStore->dismiss($input->dismissKey);

        return ($this->getAppStatus)();
    }
}
