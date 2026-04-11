<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use AltUU\Domains\Course\Actions\Results\MaterialContentResult;
use AltUU\Domains\Course\DataTransferObjects\MaterialContentInputData;
use App\Services\UUCourseClient;

final readonly class FetchMaterialContent
{
    public function __construct(private UUCourseClient $courseClient) {}

    public function __invoke(MaterialContentInputData $input, string $baseHost): MaterialContentResult
    {
        $urlHost = parse_url($input->url, PHP_URL_HOST);

        if (! is_string($urlHost) || $baseHost !== $urlHost) {
            abort(403, '不允許存取外部資源');
        }

        $materialResult = $this->courseClient->fetchMaterialContent($input->url);

        return new MaterialContentResult(
            status: $materialResult['status'],
            body: $materialResult['body'],
            headers: $materialResult['headers'],
        );
    }
}
