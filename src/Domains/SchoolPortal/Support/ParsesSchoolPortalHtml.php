<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\Support;

/**
 * Shared HTML-scraping helpers for the school portal's Kurogo-based pages,
 * used by SchoolPortal Actions that parse `/device/compliant/*` responses.
 */
trait ParsesSchoolPortalHtml
{
    /**
     * @return array{0: string, 1: string}
     */
    private function splitDetail(string $text): array
    {
        $text = $this->normalizeText($text);
        $colonPos = mb_strpos($text, '：');

        if ($colonPos === false) {
            $colonPos = mb_strpos($text, ':');
        }

        if ($colonPos === false) {
            return ['', $text];
        }

        $label = trim(mb_substr($text, 0, $colonPos));
        $value = trim(mb_substr($text, $colonPos + 1));

        return [$label, $value];
    }

    private function normalizeText(?string $value): string
    {
        $value = $this->ensureUtf8(trim((string) $value));
        $value = preg_replace('/[\s\x{00A0}\x{3000}]+/u', ' ', $value) ?? $value;

        return trim($value);
    }

    /**
     * The portal serves its pages with a leading XML declaration
     * (`<?xml version="1.0" ...?>`), which makes Symfony's Crawler parse
     * the document as namespaced XHTML instead of plain HTML5 — under
     * which unprefixed CSS/XPath selectors like `div`/`button` silently
     * match nothing. Stripping it forces HTML5 parsing.
     */
    private function stripXmlProlog(string $html): string
    {
        return preg_replace('/^\s*<\?xml[^>]*\?>/', '', $html) ?? $html;
    }

    private function ensureUtf8(string $value): string
    {
        if ($value === '' || mb_check_encoding($value, 'UTF-8')) {
            return $value;
        }

        $detected = mb_detect_encoding($value, ['UTF-8', 'BIG-5', 'CP950', 'Windows-1252', 'ISO-8859-1'], true);

        if ($detected !== false && $detected !== 'UTF-8') {
            $converted = @mb_convert_encoding($value, 'UTF-8', $detected);

            if (is_string($converted) && $converted !== '') {
                return $converted;
            }
        }

        foreach (['BIG-5', 'CP950', 'Windows-1252', 'ISO-8859-1'] as $encoding) {
            $converted = @mb_convert_encoding($value, 'UTF-8', $encoding);

            if (is_string($converted) && $converted !== '' && mb_check_encoding($converted, 'UTF-8')) {
                return $converted;
            }
        }

        $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $value);

        return is_string($converted) && $converted !== ''
            ? $converted
            : mb_convert_encoding($value, 'UTF-8', 'UTF-8');
    }
}
