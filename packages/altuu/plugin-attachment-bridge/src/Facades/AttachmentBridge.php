<?php

declare(strict_types=1);

namespace AltUU\AttachmentBridge\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static object|null download(string $url, ?string $filename = null)
 * @method static object|null openUrl(string $url, array $cookies = [], string $method = 'GET', array $postForm = [])
 * @method static object|null openInBrowser(string $url, array $cookies = [], string $method = 'GET', array $postForm = [])
 *
 * @see \AltUU\AttachmentBridge\AttachmentBridge
 */
final class AttachmentBridge extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return \AltUU\AttachmentBridge\AttachmentBridge::class;
    }
}
