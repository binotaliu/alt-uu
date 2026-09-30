<?php

declare(strict_types=1);

use Native\Mobile\Edge\TailwindParser;

it('uses only TailwindParser-supported classes in the auth views', function (): void {
    $files = glob(resource_path('views/native/auth/*.blade.php')) ?: [];

    expect($files)->toHaveCount(3);

    $dropped = [];

    foreach ($files as $file) {
        $source = (string) file_get_contents($file);
        $candidates = [];

        preg_match_all('/\sclass="([^"]*)"/', $source, $attributes);

        foreach ($attributes[1] as $classAttribute) {
            $candidates[] = preg_replace('/\{\{.*?\}\}/s', ' ', $classAttribute) ?? '';
        }

        preg_match_all("/'([a-z0-9\/\[\]:. -]*-[a-z0-9\/\[\]:. -]*)'/", $source, $literals);
        array_push($candidates, ...$literals[1]);

        foreach ($candidates as $candidate) {
            foreach (preg_split('/\s+/', trim($candidate)) ?: [] as $token) {
                if ($token !== '' && ! in_array($token, ['study-time', 'nou-tools'], true) && TailwindParser::parse($token) === []) {
                    $dropped[basename($file)][] = $token;
                }
            }
        }
    }

    expect($dropped)->toBe([]);
});

it('never uses the banned wording in the auth views', function (): void {
    foreach (glob(resource_path('views/native/auth/*.blade.php')) ?: [] as $file) {
        expect(file_get_contents($file))->not->toContain('查看');
    }
});
