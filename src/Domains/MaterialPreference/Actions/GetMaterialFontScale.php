<?php

declare(strict_types=1);

namespace AltUU\Domains\MaterialPreference\Actions;

use AltUU\Domains\MaterialPreference\MaterialPreferenceStore;

final readonly class GetMaterialFontScale
{
    public function __construct(private MaterialPreferenceStore $store) {}

    public function __invoke(): float
    {
        return $this->store->getScale();
    }
}
