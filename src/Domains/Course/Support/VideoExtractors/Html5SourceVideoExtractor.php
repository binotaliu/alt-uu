<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Support\VideoExtractors;

use Symfony\Component\DomCrawler\Crawler;

/**
 * Handles pages that declare the stream directly in markup, e.g.:
 *
 *   <div class="flowplayer">
 *     <video>
 *       <source type="application/x-mpegurl" src="https://.../playlist.m3u8">
 *       <track kind="subtitles" src="01.vtt">
 *     </video>
 *   </div>
 */
final readonly class Html5SourceVideoExtractor implements MaterialVideoExtractor
{
    public function extract(string $html): ?ExtractedVideo
    {
        $crawler = new Crawler($html);

        $sources = $crawler->filterXPath(
            "//source[@type and @src and contains(translate(@type,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), 'mpegurl')]"
        );

        if ($sources->count() === 0) {
            return null;
        }

        $videoUrl = trim((string) ($sources->first()->attr('src') ?? ''));

        if ($videoUrl === '') {
            return null;
        }

        return new ExtractedVideo(
            videoUrl: $videoUrl,
            subtitleUrl: $this->extractTrackSrc($crawler),
        );
    }

    private function extractTrackSrc(Crawler $crawler): ?string
    {
        $tracks = $crawler->filterXPath('//video//track[@src]');

        if ($tracks->count() === 0) {
            return null;
        }

        $subtitleUrl = trim((string) ($tracks->first()->attr('src') ?? ''));

        return $subtitleUrl !== '' ? $subtitleUrl : null;
    }
}
