<?php

declare(strict_types=1);

namespace AltUU\Domains\AppStatus\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AppStatusViewModel extends Resource
{
    /**
     * @param  array<int, AnnouncementViewModel>  $announcements
     */
    public function __construct(
        public ?AppUpdateViewModel $update,
        public array $announcements,
    ) {}
}
