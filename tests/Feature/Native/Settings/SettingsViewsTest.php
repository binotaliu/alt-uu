<?php

declare(strict_types=1);

use Native\Mobile\Edge\TailwindParser;

/**
 * The parser drops unsupported utilities silently, so every class token in the
 * settings views (interpolations replaced by a placeholder) must resolve.
 */
it('uses only TailwindParser-supported classes in the settings views', function (): void {
    $files = glob(resource_path('views/native/settings/*.blade.php')) ?: [];

    expect($files)->not->toBeEmpty();

    $dropped = [];

    foreach ($files as $file) {
        $source = preg_replace('/\{\{--.*?--\}\}/s', '', (string) file_get_contents($file)) ?? '';

        preg_match_all('/\sclass="([^"]*)"/', $source, $attributes);

        foreach ($attributes[1] as $classAttribute) {
            $expanded = preg_replace_callback('/\{\{(.*?)\}\}/s', static function (array $match): string {
                $withoutKeys = preg_replace("/\\['[^']*'\\]|=== '[^']*'/", '', $match[1]) ?? '';
                preg_match_all("/'([^']*)'/", $withoutKeys, $literals);

                return ' '.implode(' ', $literals[1]).' ';
            }, str_replace('bg-[{{ $option[\'swatch\'] }}]', 'bg-[#123456]', $classAttribute)) ?? '';

            foreach (preg_split('/\s+/', trim($expanded)) ?: [] as $token) {
                if ($token !== '' && TailwindParser::parse($token) === []) {
                    $dropped[basename($file)][] = $token;
                }
            }
        }
    }

    expect($dropped)->toBe([]);
});

it('never uses the banned wording in settings views or components', function (): void {
    $files = [
        ...glob(resource_path('views/native/settings/*.blade.php')) ?: [],
        ...glob(app_path('NativeComponents/Settings/*.php')) ?: [],
    ];

    foreach ($files as $file) {
        expect(file_get_contents($file))->not->toContain('查看');
    }
});
