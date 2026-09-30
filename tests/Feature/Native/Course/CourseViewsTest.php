<?php

declare(strict_types=1);

use Native\Mobile\Edge\TailwindParser;

/**
 * PartialsTest only scans the shared folders, so this guards the course
 * views against classes the parser silently drops.
 */
it('uses only Tailwind classes the native parser understands', function (): void {
    $dropped = [];

    foreach (glob(resource_path('views/native/courses/{course-show,course-*-tab,discuss-board}.blade.php'), GLOB_BRACE) as $file) {
        preg_match_all('/class="([^"]*)"/', (string) File::get($file), $matches);

        foreach ($matches[1] as $attribute) {
            $attribute = preg_replace('/\{\{.*?\}\}/s', '', $attribute) ?? '';
            preg_match_all("/'([^']+)'/", $matches[0][array_search($attribute, $matches[1], true)] ?? '', $ternary);

            foreach (preg_split('/\s+/', trim($attribute)) ?: [] as $class) {
                if ($class !== '' && TailwindParser::parse($class) === []) {
                    $dropped[basename($file)][] = $class;
                }
            }
        }
    }

    expect($dropped)->toBe([]);
});
