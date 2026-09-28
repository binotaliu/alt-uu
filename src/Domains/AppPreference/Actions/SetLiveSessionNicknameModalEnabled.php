<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\DataTransferObjects\SetLiveSessionNicknameModalEnabledInputData;
use AltUU\Domains\AppPreference\ViewModels\LiveSessionNicknameModalEnabledPreferenceViewModel;

final readonly class SetLiveSessionNicknameModalEnabled
{
    public function __construct(private AppPreferenceStore $store) {}

    public function __invoke(SetLiveSessionNicknameModalEnabledInputData $input): LiveSessionNicknameModalEnabledPreferenceViewModel
    {
        $enabled = $this->store->setLiveSessionNicknameModalEnabled($input->enabled);

        return new LiveSessionNicknameModalEnabledPreferenceViewModel($enabled);
    }
}
