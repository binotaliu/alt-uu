<?php

declare(strict_types=1);

namespace AltUU\Domains\DataPortability\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Nullable;
use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class PlaybackProgressImportItemData extends Data
{
    public function __construct(
        #[Required]
        public string $username,
        #[Required]
        public string $cid,
        #[Required]
        public string $activityId,
        #[Required]
        public int $durationSeconds,
        #[Required]
        public float $positionSeconds,
        #[Nullable]
        public ?bool $hunguUploadSuccess,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'username' => ['required', 'string'],
            'cid' => ['required', 'string', 'max:64'],
            'activityId' => ['required', 'string', 'max:191'],
            'durationSeconds' => ['required', 'integer', 'min:0'],
            'positionSeconds' => ['required', 'numeric', 'min:0'],
            'hunguUploadSuccess' => ['nullable', 'boolean'],
        ];
    }
}
