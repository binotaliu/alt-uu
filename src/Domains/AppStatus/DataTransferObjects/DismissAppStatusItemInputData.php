<?php

declare(strict_types=1);

namespace AltUU\Domains\AppStatus\DataTransferObjects;

use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class DismissAppStatusItemInputData extends Data
{
    public function __construct(
        public string $dismissKey,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'dismissKey' => ['required', 'string', 'max:128', 'regex:/^(update|announcement):.+$/'],
        ];
    }
}
