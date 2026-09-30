<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Concerns;

use AltUU\AttachmentBridge\Facades\AttachmentBridge;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\File;
use Native\Mobile\Facades\Browser;

/**
 * Opens a homework / self-exam page in the native in-app browser with the
 * Hungu session cookies and the mobile stylesheet injected (port of
 * the SPA's `openAttachmentInBrowser` and its cookie endpoint). Falls back to a plain
 * in-app browser when the attachment bridge is unavailable.
 */
trait OpensAttachmentBrowser
{
    protected function openInAttachmentBrowser(string $url): void
    {
        $result = AttachmentBridge::openUrl($url, $this->hunguCookies(), 'GET', [], $this->homeworkPortalCss());

        if ($result === null) {
            Browser::inApp($url);
        }
    }

    /**
     * @return list<array{name: string, value: string, domain: string}>
     */
    private function hunguCookies(): array
    {
        $session = app(UUSessionStore::class)->get();

        if (! is_array($session)) {
            return [];
        }

        $domain = (string) (parse_url((string) ($session['base_url'] ?? ''), PHP_URL_HOST) ?: '');
        $cookies = [];

        foreach ((array) ($session['cookies'] ?? []) as $name => $value) {
            $cookies[] = ['name' => (string) $name, 'value' => (string) $value, 'domain' => $domain];
        }

        return $cookies;
    }

    private function homeworkPortalCss(): ?string
    {
        $path = resource_path('css/attachment-browser/homework.css');

        return File::exists($path) ? File::get($path) : null;
    }
}
