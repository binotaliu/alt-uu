<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Native\Mobile\Commands\CheckBuildNumberCommand;
use Symfony\Component\Console\Attribute\AsCommand;

/**
 * nativephp/mobile's native:check-build-number reads --api-key-path,
 * --api-key-id and --api-issuer-id while looking up App Store Connect, but
 * never declares them, so every iOS lookup throws "option does not exist".
 * This subclass declares the missing options; the inherited logic is unchanged.
 */
#[AsCommand(name: 'altuu:check-build-number')]
final class CheckIosBuildNumberCommand extends CheckBuildNumberCommand
{
    protected $signature = 'altuu:check-build-number
        {platform : The platform to check (android/a, ios/i, or both)}
        {--google-service-key= : Path to Google Service Account JSON key file (Android)}
        {--api-key= : Path to App Store Connect API key file (iOS)}
        {--api-key-path= : Path to App Store Connect API key file (.p8) - same as --api-key}
        {--api-key-id= : App Store Connect API key ID}
        {--api-issuer-id= : App Store Connect API issuer ID}
        {--update : Update local build number to store latest + 1}
        {--jump-by= : Add extra number to the suggested version}';
}
