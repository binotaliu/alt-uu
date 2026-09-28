<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use AltUU\Domains\Diagnostics\Support\MaterialPathNodes;
use AltUU\Domains\Diagnostics\ViewModels\MaterialDirectoryInspectionViewModel;
use AltUU\Domains\Diagnostics\ViewModels\MaterialDirectoryNodeViewModel;
use App\Services\Diagnostics\DiagnosticRecorder;
use App\Services\UUCourseClient;

/**
 * Shows a course's material directory the way the school sent it.
 *
 * Always fetches fresh, never from the 30-minute path-info cache: this tool
 * exists to answer "what does the school say right now", and a stale cached
 * tree would answer a different question.
 */
final readonly class InspectMaterialDirectory
{
    public function __construct(
        private UUCourseClient $courseClient,
        private DiagnosticRecorder $recorder,
    ) {}

    public function __invoke(string $cid): MaterialDirectoryInspectionViewModel
    {
        $payload = $this->courseClient->fetchCoursePathInfo($cid)['payload'];
        $redactor = $this->recorder->redactor();

        $nodes = array_map(
            fn (array $node): MaterialDirectoryNodeViewModel => $this->toNode($node),
            MaterialPathNodes::flatten($payload),
        );

        $rawJson = $redactor->redactSecrets((string) json_encode(
            $payload,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR,
        ));

        $limit = max(0, (int) config('diagnostics.material_source_bytes', 204800));
        $truncated = $limit > 0 && strlen($rawJson) > $limit;

        return new MaterialDirectoryInspectionViewModel(
            cid: $cid,
            apiCode: is_numeric($payload['code'] ?? null) ? (int) $payload['code'] : null,
            apiMessage: is_string($payload['message'] ?? null) ? $payload['message'] : null,
            nodeCount: count($nodes),
            nodes: $nodes,
            rawJson: $truncated ? mb_strcut($rawJson, 0, $limit) : $rawJson,
            rawJsonTruncated: $truncated,
        );
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private function toNode(array $node): MaterialDirectoryNodeViewModel
    {
        $href = is_string($node['href'] ?? null) ? trim($node['href']) : null;
        $isWebUrl = $href !== null && preg_match('#^https?://#i', $href) === 1;

        return new MaterialDirectoryNodeViewModel(
            identifier: (string) ($node['identifier'] ?? ''),
            text: is_string($node['text'] ?? null) ? $node['text'] : '',
            level: (int) ($node['level'] ?? 0),
            // Only real URLs go through the URL redactor: it rebuilds from
            // parse_url, which would turn `about:blank` into `about://blank`.
            href: $href === '' ? null : ($isWebUrl
                ? $this->recorder->redactor()->redactUrl($href)
                : $href),
            leaf: (bool) ($node['leaf'] ?? false),
            itemDisabled: (bool) ($node['itemDisabled'] ?? false),
            isInspectable: $isWebUrl,
        );
    }
}
