<?php

declare(strict_types=1);

use App\Console\Commands\CheckIosBuildNumberCommand;

it('declares every option the App Store Connect lookup reads', function (): void {
    $definition = (new CheckIosBuildNumberCommand)->getDefinition();

    foreach (['api-key', 'api-key-path', 'api-key-id', 'api-issuer-id'] as $option) {
        expect($definition->hasOption($option))->toBeTrue();
    }
});

it('reaches the App Store Connect lookup without an undefined option error', function (): void {
    $this->artisan('altuu:check-build-number', ['platform' => 'ios'])
        ->doesntExpectOutputToContain('does not exist')
        ->assertSuccessful();
});
