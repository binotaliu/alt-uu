<?php

declare(strict_types=1);

namespace AltUU\Domains\AppStatus\Actions;

use AltUU\Domains\AppStatus\AppStatusFeedClient;
use AltUU\Domains\AppStatus\DismissedAppStatusStore;
use AltUU\Domains\AppStatus\ViewModels\AnnouncementViewModel;
use AltUU\Domains\AppStatus\ViewModels\AppStatusViewModel;
use AltUU\Domains\AppStatus\ViewModels\AppUpdateViewModel;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Str;
use Native\Mobile\Facades\System;
use Throwable;

final readonly class GetAppStatus
{
    /** @var string[] */
    private const SEVERITIES = ['info', 'warning', 'critical'];

    public function __construct(
        private AppStatusFeedClient $feedClient,
        private DismissedAppStatusStore $dismissedStore,
    ) {}

    public function __invoke(): AppStatusViewModel
    {
        $feed = $this->feedClient->fetch();

        if ($feed === null) {
            return new AppStatusViewModel(update: null, announcements: []);
        }

        // Defaults to iOS outside a native shell, like FetchAvailableProducts.
        $platform = System::isAndroid() ? 'android' : 'ios';
        $currentVersion = $this->currentVersion();
        $dismissed = $this->dismissedStore->all();

        return new AppStatusViewModel(
            update: $this->resolveUpdate($feed, $platform, $currentVersion, $dismissed),
            announcements: $this->resolveAnnouncements($feed, $platform, $currentVersion, $dismissed),
        );
    }

    /**
     * The running version, or null for builds that carry no release number
     * (e.g. "DEBUG"), which never see update banners or version-gated notices.
     */
    private function currentVersion(): ?string
    {
        $version = (string) config('nativephp.version');

        return $this->isVersion($version) ? $version : null;
    }

    private function isVersion(mixed $value): bool
    {
        return is_string($value) && preg_match('/^\d+(\.\d+)*/', $value) === 1;
    }

    /**
     * @param  array<string, mixed>  $feed
     * @param  array<int, string>  $dismissed
     */
    private function resolveUpdate(array $feed, string $platform, ?string $currentVersion, array $dismissed): ?AppUpdateViewModel
    {
        $latest = Arr::get($feed, "latest.{$platform}");

        if ($currentVersion === null || ! $this->isVersion($latest)) {
            return null;
        }

        if (version_compare($currentVersion, $latest, '>=')) {
            return null;
        }

        $minSupported = Arr::get($feed, "minSupported.{$platform}");
        $required = $this->isVersion($minSupported) && version_compare($currentVersion, $minSupported, '<');
        $dismissKey = "update:{$latest}";

        if (! $required && in_array($dismissKey, $dismissed, true)) {
            return null;
        }

        return new AppUpdateViewModel(
            dismissKey: $dismissKey,
            latestVersion: $latest,
            storeUrl: $this->httpsUrl(Arr::get($feed, "storeUrl.{$platform}")),
            required: $required,
        );
    }

    /**
     * @param  array<string, mixed>  $feed
     * @param  array<int, string>  $dismissed
     * @return array<int, AnnouncementViewModel>
     */
    private function resolveAnnouncements(array $feed, string $platform, ?string $currentVersion, array $dismissed): array
    {
        $entries = Arr::get($feed, 'announcements');

        if (! is_array($entries)) {
            return [];
        }

        $announcements = [];

        foreach ($entries as $entry) {
            if (! is_array($entry) || ! $this->appliesHere($entry, $platform, $currentVersion)) {
                continue;
            }

            $id = Arr::get($entry, 'id');
            $title = Arr::get($entry, 'title');

            if (! is_string($id) || $id === '' || ! is_string($title) || $title === '') {
                continue;
            }

            $dismissible = Arr::get($entry, 'dismissible', true) !== false;
            $dismissKey = "announcement:{$id}";

            if ($dismissible && in_array($dismissKey, $dismissed, true)) {
                continue;
            }

            $severity = Arr::get($entry, 'severity');
            $body = Arr::get($entry, 'body');

            $announcements[] = new AnnouncementViewModel(
                dismissKey: $dismissKey,
                severity: is_string($severity) && in_array($severity, self::SEVERITIES, true) ? $severity : 'info',
                title: Str::limit($title, 120),
                body: is_string($body) ? Str::limit($body, 500) : '',
                url: $this->httpsUrl(Arr::get($entry, 'url')),
                dismissible: $dismissible,
            );
        }

        return $announcements;
    }

    /**
     * @param  array<mixed>  $entry
     */
    private function appliesHere(array $entry, string $platform, ?string $currentVersion): bool
    {
        $platforms = Arr::get($entry, 'platforms');

        if (is_array($platforms) && $platforms !== [] && ! in_array($platform, $platforms, true)) {
            return false;
        }

        $expires = Arr::get($entry, 'expires');

        if ($expires !== null && ! $this->isStillActive($expires)) {
            return false;
        }

        if ($currentVersion === null) {
            return true;
        }

        $minVersion = Arr::get($entry, 'minVersion');
        $maxVersion = Arr::get($entry, 'maxVersion');

        if ($this->isVersion($minVersion) && version_compare($currentVersion, $minVersion, '<')) {
            return false;
        }

        return ! ($this->isVersion($maxVersion) && version_compare($currentVersion, $maxVersion, '>'));
    }

    /**
     * An unparseable expiry counts as expired, so a typo in the feed hides the
     * notice rather than pinning it on screen forever.
     */
    private function isStillActive(mixed $expires): bool
    {
        if (! is_string($expires)) {
            return false;
        }

        try {
            return Date::parse($expires)->isFuture();
        } catch (Throwable) {
            return false;
        }
    }

    private function httpsUrl(mixed $url): ?string
    {
        return is_string($url) && str_starts_with($url, 'https://') ? $url : null;
    }
}
