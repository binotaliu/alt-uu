<?php

declare(strict_types=1);

namespace AltUU\Domains\Auth\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Max;
use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class LoginInputData extends Data
{
    public function __construct(
        #[Required, Max(191)]
        public string $username,
        #[Required, Max(191)]
        public string $password,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'username' => ['required', 'string', 'max:191'],
            'password' => ['required', 'string', 'max:191'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        return [
            'username.required' => '請輸入學號或帳號。',
            'password.required' => '請輸入密碼。',
        ];
    }
}
