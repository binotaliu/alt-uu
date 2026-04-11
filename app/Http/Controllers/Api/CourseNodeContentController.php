<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\GetCoursePathInfo;
use AltUU\Domains\Course\Actions\ParseMaterialContent;
use AltUU\Domains\Course\ViewModels\ParsedMaterialContentViewModel;
use Illuminate\Http\Request;

final class CourseNodeContentController
{
    public function __invoke(
        Request $request,
        string $cid,
        string $scoid,
        GetCoursePathInfo $getPath,
        ParseMaterialContent $parse,
    ): ParsedMaterialContentViewModel {
        $pathData = $getPath($request, $cid);
        $activeNode = collect($pathData['materialNodes']->items())
            ->first(fn ($node) => $node->identifier === $scoid);

        if ($activeNode === null || $activeNode->href === null) {
            return ParsedMaterialContentViewModel::emptyContent();
        }

        $session = $request->hunguSession();
        $baseHost = parse_url((string) ($session['base_url'] ?? ''), PHP_URL_HOST);

        if (! is_string($baseHost) || trim($baseHost) === '') {
            $baseHost = parse_url($activeNode->href, PHP_URL_HOST);
        }

        if (! is_string($baseHost) || trim($baseHost) === '') {
            return ParsedMaterialContentViewModel::emptyContent();
        }

        return ParsedMaterialContentViewModel::fromResult($parse($activeNode->href, $baseHost));
    }
}
