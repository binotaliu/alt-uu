<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class BoardListViewModel extends Resource
{
    /**
     * @param  BoardViewModel[]  $boards
     */
    public function __construct(
        public string $courseId,
        public array $boards,
    ) {}
}
