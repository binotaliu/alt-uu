<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\ParseMaterialContent;
use AltUU\Domains\Course\DataTransferObjects\MaterialContentInputData;
use AltUU\Domains\Course\ViewModels\ParsedMaterialContentViewModel;
use Illuminate\Http\Request;

final class ParsedMaterialContentController
{
    public function __invoke(
        Request $request,
        MaterialContentInputData $input,
        ParseMaterialContent $parse,
    ): ParsedMaterialContentViewModel {
        $session = $request->hunguSession();
        $baseHost = parse_url((string) ($session['base_url'] ?? ''), PHP_URL_HOST);
        $urlHost = parse_url($input->url, PHP_URL_HOST);

        if (! is_string($baseHost) || ! is_string($urlHost) || $baseHost !== $urlHost) {
            abort(403, '不允許存取外部資源');
        }

        return ParsedMaterialContentViewModel::fromResult($parse($input->url, $baseHost));
    }
}
