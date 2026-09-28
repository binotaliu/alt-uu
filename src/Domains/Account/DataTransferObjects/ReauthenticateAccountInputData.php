<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Max;
use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ReauthenticateAccountInputData extends Data
{
    public function __construct(
        #[Required, Max(191)]
        public string $password,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'password' => ['required', 'string', 'max:191'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        return [
            'password.required' => '請輸入密碼。',
        ];
    }
}
