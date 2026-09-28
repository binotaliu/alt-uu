<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\DataTransferObjects;

use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class RenameAccountInputData extends Data
{
    public function __construct(
        public ?string $nickname,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'nickname' => ['nullable', 'string', 'max:30'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        return [
            'nickname.max' => '自訂名稱長度不可超過 30 個字。',
        ];
    }
}
