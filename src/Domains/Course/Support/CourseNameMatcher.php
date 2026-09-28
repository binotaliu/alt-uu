<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Support;

use Normalizer;

final class CourseNameMatcher
{
    public static function normalizeName(string $name): string
    {
        $value = trim($name);

        if ($value === '') {
            return '';
        }

        if (class_exists(Normalizer::class)) {
            $normalized = Normalizer::normalize($value, Normalizer::FORM_KC);
            if (is_string($normalized) && $normalized !== '') {
                $value = $normalized;
            }
        }

        $value = mb_strtolower($value, 'UTF-8');
        $value = preg_replace('/[\p{Z}\p{P}\p{S}]+/u', '', $value) ?? $value;

        return trim($value);
    }

    /**
     * Normalizes a semester label to a canonical term code, accepting
     * Hongu's short form ("114下", "115暑"), the school portal's
     * current-semester page long form ("114學年下學期", "115學年暑期"), or the
     * school portal's historical-grades page label ("114上學期", "115暑期",
     * i.e. the same long form without the "學年" prefix). Returns null if
     * unrecognized.
     */
    public static function normalizeTermCode(?string $semester): ?string
    {
        if (! is_string($semester)) {
            return null;
        }

        $normalized = preg_replace('/\s+/u', '', trim($semester)) ?? '';

        if ($normalized === '') {
            return null;
        }

        $season = null;
        $rocYear = null;

        if (preg_match('/^(?<year>\d{2,3})(?<season>上|下|暑)$/u', $normalized, $matches) === 1) {
            $rocYear = (int) $matches['year'];
            $season = $matches['season'];
        } elseif (preg_match('/^(?<year>\d{2,3})學年(?:(?<season>上|下)學期|(?<season2>暑)期)$/u', $normalized, $matches) === 1) {
            $rocYear = (int) $matches['year'];
            $season = ($matches['season'] ?? '') !== '' ? $matches['season'] : ($matches['season2'] ?? null);
        } elseif (preg_match('/^(?<year>\d{2,3})(?:(?<season>上|下)學期|(?<season2>暑)期)$/u', $normalized, $matches) === 1) {
            $rocYear = (int) $matches['year'];
            $season = ($matches['season'] ?? '') !== '' ? $matches['season'] : ($matches['season2'] ?? null);
        }

        if ($rocYear === null || $rocYear <= 0 || $season === null || $season === '') {
            return null;
        }

        $seasonCode = match ($season) {
            '上' => 'A',
            '下' => 'B',
            '暑' => 'C',
            default => null,
        };

        if ($seasonCode === null) {
            return null;
        }

        return sprintf('%d%s', $rocYear + 1911, $seasonCode);
    }
}
