<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Support\VideoExtractors;

interface MaterialVideoExtractor
{
    /**
     * Return the extracted video (and, if present, subtitle) URL for this page
     * format, or null when the page doesn't match this extractor's format.
     */
    public function extract(string $html): ?ExtractedVideo;
}
