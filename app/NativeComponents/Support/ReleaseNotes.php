<?php

declare(strict_types=1);

namespace App\NativeComponents\Support;

use AltUU\Domains\AppPreference\Actions\GetAppPreferences;
use App\Icons\Android;
use App\Icons\Ios;

/**
 * "What's new" content, ported from resources/js/lib/releaseNotes.ts.
 *
 * Newest first. The first launch of a version that has an entry here shows the
 * What's New sheet once; versions without an entry are skipped silently.
 * Add a new release by prepending an entry to `releases()`.
 */
final class ReleaseNotes
{
    public const string CHANGELOG_URL = 'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/changelog';

    /**
     * @return list<array{version: string, highlights: list<array{ios: Ios, android: Android, title: string, description: string, plus: bool}>}>
     */
    public static function releases(): array
    {
        return [
            [
                'version' => '1.1.0',
                'highlights' => [
                    [
                        'ios' => Ios::BookClosed,
                        'android' => Android::MenuBook,
                        'title' => '追蹤觀看進度',
                        'description' => '教材列表會標示「上次看到」的教材，並顯示上次觀看的時間與影片總長度',
                        'plus' => false,
                    ],
                    [
                        'ios' => Ios::Person2,
                        'android' => Android::Group,
                        'title' => '支援多帳號登入',
                        'description' => '最多可登入 5 個帳號，隨時切換身份',
                        'plus' => false,
                    ],
                    [
                        'ios' => Ios::Graduationcap,
                        'android' => Android::School,
                        'title' => '整合教務行政系統',
                        'description' => '在 App 中直接檢視成績與作業，不用再另外登入',
                        'plus' => false,
                    ],
                    [
                        'ios' => Ios::Paintpalette,
                        'android' => Android::Palette,
                        'title' => '個人化主題色',
                        'description' => '除了預設主題色，另外提供六種主題色可供選擇',
                        'plus' => true,
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array{version: string, highlights: list<array{ios: Ios, android: Android, title: string, description: string, plus: bool}>}|null
     */
    public static function find(string $version): ?array
    {
        foreach (self::releases() as $release) {
            if ($release['version'] === $version) {
                return $release;
            }
        }

        return null;
    }

    /**
     * The release to show for `$version`, falling back to the newest one so
     * development builds do not show an empty sheet.
     *
     * @return array{version: string, highlights: list<array{ios: Ios, android: Android, title: string, description: string, plus: bool}>}|null
     */
    public static function forVersionOrLatest(string $version): ?array
    {
        return self::find($version) ?? (self::releases()[0] ?? null);
    }

    /**
     * Whether the user should be taken to the What's New sheet: this version has
     * release notes and the user has not seen them yet.
     */
    public static function hasUnseen(string $currentVersion, string $seenVersion): bool
    {
        return self::find($currentVersion) !== null && $seenVersion !== $currentVersion;
    }

    /**
     * Convenience for the first screen: reads the running version and the
     * stored preference.
     */
    public static function shouldShowNow(): bool
    {
        $seen = app(GetAppPreferences::class)()->whatsNewSeenVersion;

        return self::hasUnseen((string) config('nativephp.version'), $seen);
    }

    public static function changelogUrl(?string $version): string
    {
        return $version === null || $version === ''
            ? self::CHANGELOG_URL
            : self::CHANGELOG_URL.'?version='.rawurlencode($version);
    }
}
