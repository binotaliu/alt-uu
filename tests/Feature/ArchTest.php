<?php

use AltUU\AttachmentBridge\Facades\AttachmentBridge;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\MediaPlayer\Facades\MediaPlayer;
use App\Providers\AppServiceProvider;
use App\Services\UUCrypto;
use App\Services\UUProfileSession;
use App\Services\UUProxyClient;
use App\Services\UURememberedCredentialsStore;
use App\Services\UUSessionAuthenticator;
use App\Services\UUSessionStore;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Spatie\LaravelData\Data;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

arch()->preset()->php();
arch()->preset()->security()
    ->ignoring(UUCrypto::class);
arch()->preset()->laravel();
arch()->preset()->strict()
    ->ignoring([
        // Allow us to mock
        UUCrypto::class,
        UUProfileSession::class,
        UUProxyClient::class,
        UURememberedCredentialsStore::class,
        UUSessionAuthenticator::class,
        UUSessionStore::class,
        SyncCurrentCourse::class,

        // False-positive on facade protected static method
        AttachmentBridge::class,
        MediaPlayer::class,
    ]);

arch('No Direct Hungu Usage in Domains: inject a domain-specific Hungu*Client service instead')
    ->expect('AltUU\Domains')
    ->not->toUse([
        UUCrypto::class,
        UUProfileSession::class,
        UUProxyClient::class,
        UURememberedCredentialsStore::class,
        UUSessionAuthenticator::class,
        UUSessionStore::class,
    ]);

arch('Actions')
    ->expect('AltUU\Domains\*\Actions')
    ->not->toHavePublicMethodsBesides(['__invoke', '__construct']);

arch('View Models')
    ->expect('AltUU\Domains\*\ViewModels')
    ->toExtend(Resource::class)
    ->toHaveAttribute(TypeScript::class)
    ->toHaveConstructor()
    ->toHaveOnlyCamelCasePublicProperties();

arch('DTOs')
    ->expect('AltUU\Domains\*\DataTransferObjects')
    ->toExtend(Data::class)
    ->toHaveConstructor()
    ->toHaveOnlyCamelCasePublicProperties()
    ->toHaveAttribute(TypeScript::class);

arch('No Directly File Read/Write: use File facade or Storage facade instead')
    ->expect(['file_get_contents', 'file_put_contents'])
    ->not->toBeUsed();

arch('No Directly Carbon Usage: use Date facade instead')
    ->expect([Carbon::class, CarbonImmutable::class])
    ->not->toBeUsed()
    ->ignoring([
        // Allow us to set CarbonImmutable in AppServiceProvider
        AppServiceProvider::class,
    ]);
