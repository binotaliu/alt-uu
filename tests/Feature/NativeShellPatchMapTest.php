<?php

use AltUU\NativePHPPatch\PatchMap;

it('keeps every patched_hash in sync with its committed patch template', function () {
    $stale = [];

    foreach (['ios', 'android'] as $platform) {
        foreach (PatchMap::forPlatform($platform) as $patch) {
            $path = base_path($patch['patched']);

            if (! file_exists($path)) {
                $stale[] = "{$platform}: {$patch['target']} - patched template missing at {$path}";

                continue;
            }

            if (hash_file('sha256', $path) !== $patch['patched_hash']) {
                $stale[] = "{$platform}: {$patch['target']} - patched_hash in PatchMap does not match {$patch['patched']}";
            }
        }
    }

    expect($stale)->toBe([]);
});
