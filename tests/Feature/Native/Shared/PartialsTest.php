<?php

declare(strict_types=1);

use Native\Mobile\Edge\TailwindParser;
use Tests\Feature\Native\Fixtures\RecordingHost;

it('renders the shared section and skeleton partials', function (): void {
    RecordingHost::mountView('partials')
        ->assertSee('114-1')
        ->assertSee('本學期')
        ->assertSee('外觀')
        ->assertSee('暖橘')
        ->assertElement('rect');
});

/**
 * The parser drops unsupported utilities silently, so every static class
 * token in the shared native views must resolve to something.
 */
it('uses only TailwindParser-supported classes in shared views', function (): void {
    $files = [
        ...glob(resource_path('views/native/shared/*.blade.php')) ?: [],
        ...glob(resource_path('views/native/partials/*.blade.php')) ?: [],
    ];

    expect($files)->not->toBeEmpty();

    $dropped = [];

    foreach ($files as $file) {
        preg_match_all('/\sclass="([^"]*)"/', (string) file_get_contents($file), $matches);

        foreach ($matches[1] as $classAttribute) {
            $static = preg_replace('/\{\{.*?\}\}/s', ' ', $classAttribute) ?? '';

            foreach (preg_split('/\s+/', trim($static)) ?: [] as $token) {
                if ($token !== '' && TailwindParser::parse($token) === []) {
                    $dropped[basename($file)][] = $token;
                }
            }
        }
    }

    expect($dropped)->toBe([]);
});
