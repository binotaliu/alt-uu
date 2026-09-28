<?php

declare(strict_types=1);

namespace AltUU\Domains\Subscription\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Max;
use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class PurchaseSubscriptionInputData extends Data
{
    public function __construct(
        #[Required, Max(191)]
        public string $productId,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'productId' => ['required', 'string', 'max:191'],
        ];
    }
}
