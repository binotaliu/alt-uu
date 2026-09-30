<?php

declare(strict_types=1);

use Native\Mobile\Edge\TailwindParser;

/**
 * The parser drops unsupported utilities silently, so every static class
 * token in the account screens' views must resolve to something.
 */
it('uses only TailwindParser-supported classes in the account views', function (): void {
    $files = glob(resource_path('views/native/account/*.blade.php')) ?: [];

    expect($files)->not->toBeEmpty();

    $dropped = [];

    foreach ($files as $file) {
        $source = preg_replace('/\{\{--.*?--\}\}/s', '', (string) file_get_contents($file)) ?? '';
        $candidates = [];

        preg_match_all('/\sclass="([^"]*)"/', $source, $attributes);

        foreach ($attributes[1] as $classAttribute) {
            $joined = preg_replace('/(?<=\S)\{\{.*?\}\}(?=\S)/s', '1', $classAttribute) ?? '';
            $candidates[] = preg_replace('/\{\{.*?\}\}/s', ' ', $joined) ?? '';
        }

        preg_match_all("/'([a-z0-9\/\[\]:. -]*-[a-z0-9\/\[\]:. -]*)'/", $source, $literals);
        array_push($candidates, ...$literals[1]);

        foreach ($candidates as $candidate) {
            foreach (preg_split('/\s+/', trim($candidate)) ?: [] as $token) {
                if ($token !== '' && TailwindParser::parse($token) === []) {
                    $dropped[basename($file)][] = $token;
                }
            }
        }
    }

    expect($dropped)->toBe([]);
});

it('contains no hex colour literals or the banned word in the account views', function (): void {
    foreach (glob(resource_path('views/native/account/*.blade.php')) ?: [] as $file) {
        $source = (string) file_get_contents($file);

        expect($source)->not->toMatch('/#[0-9a-fA-F]{6}\b/')
            ->and($source)->not->toContain('查看');
    }
});
