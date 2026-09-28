<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class MaterialDirectoryInspectionViewModel extends Resource
{
    /**
     * @param  MaterialDirectoryNodeViewModel[]  $nodes
     */
    public function __construct(
        public string $cid,
        public ?int $apiCode,
        public ?string $apiMessage,
        public int $nodeCount,
        public array $nodes,
        public string $rawJson,
        public bool $rawJsonTruncated,
    ) {}
}
