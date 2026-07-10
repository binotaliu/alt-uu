<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Support\VideoExtractors;

/**
 * Handles pages that initialize flowplayer via its JS API, e.g.:
 *
 *   window.player = flowplayer("#player", {
 *       src: "https://.../playlist.m3u8",
 *       subtitles: { tracks: [{ src: "01.vtt" }] },
 *   });
 */
final readonly class FlowplayerJsConfigVideoExtractor implements MaterialVideoExtractor
{
    public function extract(string $html): ?ExtractedVideo
    {
        if (! preg_match('/flowplayer\s*\(/i', $html)) {
            return null;
        }

        $videoUrl = $this->extractVideoUrl($html);

        if ($videoUrl === null) {
            return null;
        }

        return new ExtractedVideo(
            videoUrl: $videoUrl,
            subtitleUrl: $this->extractSubtitleSrc($html),
        );
    }

    private function extractVideoUrl(string $html): ?string
    {
        // Match src: "https://..." (absolute URL only — skips relative subtitle paths)
        if (preg_match('/\bsrc\s*:\s*["\'](https?:\/\/[^"\']+)["\']/', $html, $matches)) {
            return $matches[1];
        }

        return null;
    }

    private function extractSubtitleSrc(string $html): ?string
    {
        // Match subtitles: { tracks: [{ src: "...", ... }] }
        if (preg_match('/subtitles\s*:\s*\{[^{}]*tracks\s*:\s*\[\s*\{[^}]*\bsrc\s*:\s*["\']([^"\']+)["\']/', $html, $matches)) {
            return $matches[1];
        }

        return null;
    }
}
