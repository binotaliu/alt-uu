<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use AltUU\Domains\Course\Actions\ParseMaterialContent;
use AltUU\Domains\Course\Enums\VideoProvider;
use AltUU\Domains\Diagnostics\Support\MaterialPathNodes;
use AltUU\Domains\Diagnostics\ViewModels\MaterialParseOutcomeViewModel;
use AltUU\Domains\Diagnostics\ViewModels\MaterialSourceInspectionViewModel;
use App\Services\Diagnostics\DiagnosticRecorder;
use App\Services\UUCourseClient;
use Throwable;

/**
 * Fetches one directory node's page and reports both halves of the story: the
 * raw source the school returned, and what ParseMaterialContent made of it.
 *
 * The two together are what separates "the school sent an empty or login page"
 * from "our parser threw the content away", which the viewer's single
 * 「此節點沒有可顯示的教材內容」 message cannot.
 */
final readonly class InspectMaterialSource
{
    public function __construct(
        private UUCourseClient $courseClient,
        private ParseMaterialContent $parseMaterialContent,
        private DiagnosticRecorder $recorder,
    ) {}

    public function __invoke(string $cid, string $scoid, string $baseHost): MaterialSourceInspectionViewModel
    {
        $node = $this->findNode($cid, $scoid);
        $href = is_string($node['href'] ?? null) ? trim($node['href']) : '';

        if (preg_match('#^https?://#i', $href) !== 1) {
            abort(422, '此節點沒有可檢視的連結');
        }

        $urlHost = parse_url($href, PHP_URL_HOST);

        if (! is_string($urlHost) || $urlHost !== $baseHost) {
            abort(403, '不允許存取外部資源');
        }

        $redactor = $this->recorder->redactor();
        $fetch = $this->fetch($href);

        return new MaterialSourceInspectionViewModel(
            cid: $cid,
            scoid: $scoid,
            nodeText: is_string($node['text'] ?? null) ? $node['text'] : '',
            url: $redactor->redactUrl($href),
            fetchStatus: $fetch['status'],
            contentType: $fetch['contentType'],
            bodyBytes: $fetch['bodyBytes'],
            isText: $fetch['isText'],
            body: $fetch['body'],
            bodyTruncated: $fetch['bodyTruncated'],
            fetchError: $fetch['error'],
            parse: $this->parse($href, $baseHost),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function findNode(string $cid, string $scoid): array
    {
        $payload = $this->courseClient->fetchCoursePathInfo($cid)['payload'];

        foreach (MaterialPathNodes::flatten($payload) as $node) {
            if ((string) ($node['identifier'] ?? '') === $scoid) {
                return $node;
            }
        }

        abort(404, '找不到此教材節點');
    }

    /**
     * @return array{status: ?int, contentType: ?string, bodyBytes: int, isText: bool, body: ?string, bodyTruncated: bool, error: ?string}
     */
    private function fetch(string $url): array
    {
        $redactor = $this->recorder->redactor();

        try {
            $response = $this->courseClient->fetchMaterialContent($url);
        } catch (Throwable $e) {
            return [
                'status' => null,
                'contentType' => null,
                'bodyBytes' => 0,
                'isText' => false,
                'body' => null,
                'bodyTruncated' => false,
                'error' => $e::class.': '.$redactor->redactText($e->getMessage()),
            ];
        }

        $raw = (string) ($response['body'] ?? '');
        $contentType = strtolower((string) ($response['headers']['content-type'] ?? ''));
        $isText = $this->isTextContentType($contentType);

        $body = null;
        $truncated = false;

        if ($isText) {
            $text = $redactor->redactSecrets($this->toUtf8($raw));
            $limit = max(0, (int) config('diagnostics.material_source_bytes', 204800));
            $truncated = $limit > 0 && strlen($text) > $limit;
            $body = $truncated ? mb_strcut($text, 0, $limit) : $text;
        }

        return [
            'status' => (int) ($response['status'] ?? 0),
            'contentType' => $contentType === '' ? null : $contentType,
            'bodyBytes' => strlen($raw),
            'isText' => $isText,
            'body' => $body,
            'bodyTruncated' => $truncated,
            'error' => null,
        ];
    }

    private function parse(string $url, string $baseHost): MaterialParseOutcomeViewModel
    {
        try {
            $result = ($this->parseMaterialContent)($url, $baseHost);
        } catch (Throwable $e) {
            return new MaterialParseOutcomeViewModel(
                succeeded: false,
                kind: 'error',
                videoUrl: null,
                htmlLength: 0,
                downloadFileName: null,
                errorClass: $e::class,
                errorMessage: $this->recorder->redactor()->redactText($e->getMessage()),
                errorLocation: $this->relativePath($e->getFile()).':'.$e->getLine(),
            );
        }

        $kind = match (true) {
            $result->videoProvider === VideoProvider::Youtube && $result->embedVideoUrl !== null => 'youtube',
            $result->videoUrl !== null => 'video',
            $result->downloadUrl !== null => 'download',
            trim($result->htmlContent) !== '' => 'html',
            default => 'empty',
        };

        return new MaterialParseOutcomeViewModel(
            succeeded: true,
            kind: $kind,
            videoUrl: $result->videoUrl === null
                ? null
                : $this->recorder->redactor()->redactUrl($result->videoUrl),
            htmlLength: mb_strlen($result->htmlContent),
            downloadFileName: $result->downloadFileName,
            errorClass: null,
            errorMessage: null,
            errorLocation: null,
        );
    }

    /**
     * Mirrors MaterialContentProxyController: anything else is a file the
     * viewer offers to download, and dumping its bytes here would be noise.
     */
    private function isTextContentType(string $contentType): bool
    {
        return str_starts_with($contentType, 'text/')
            || str_contains($contentType, 'application/json')
            || str_contains($contentType, 'application/javascript')
            || str_contains($contentType, 'application/xml');
    }

    private function toUtf8(string $body): string
    {
        if (mb_check_encoding($body, 'UTF-8')) {
            return $body;
        }

        $converted = @mb_convert_encoding($body, 'UTF-8', ['BIG-5', 'CP950', 'Windows-1252']);

        return is_string($converted) && mb_check_encoding($converted, 'UTF-8')
            ? $converted
            : mb_scrub($body, 'UTF-8');
    }

    private function relativePath(string $path): string
    {
        $base = base_path().DIRECTORY_SEPARATOR;

        return str_starts_with($path, $base) ? substr($path, strlen($base)) : $path;
    }
}
