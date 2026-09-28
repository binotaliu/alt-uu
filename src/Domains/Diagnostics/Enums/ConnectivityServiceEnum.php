<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Enums;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
enum ConnectivityServiceEnum: string
{
    case Hungu = 'hungu';
    case SchoolPortal = 'school_portal';
    case NouTools = 'nou_tools';
    case Iap = 'iap';
    case Google = 'google';
    case Cloudflare = 'cloudflare';
    case Apple = 'apple';

    public function label(): string
    {
        return match ($this) {
            self::Hungu => '數位學習平台 (UU平台)',
            self::SchoolPortal => '教務行政資訊系統',
            self::NouTools => 'NOU 小幫手',
            self::Iap => 'Alt UU+ 服務',
            self::Google => 'Google',
            self::Cloudflare => 'Cloudflare',
            self::Apple => 'Apple',
        };
    }

    /**
     * Reference services aren't part of Alt UU — they're well-known public
     * endpoints used to tell whether a failure is general Internet
     * connectivity or specific to Alt UU's own services. They're not
     * checked automatically; the UI only checks them when the user opts in.
     */
    public function isReference(): bool
    {
        return match ($this) {
            self::Google, self::Cloudflare, self::Apple => true,
            default => false,
        };
    }
}
