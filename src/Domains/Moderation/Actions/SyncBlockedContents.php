<?php

declare(strict_types=1);

namespace AltUU\Domains\Moderation\Actions;

use App\Models\BlockedContent;
use App\Models\KeyValueStore;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Http;

final readonly class SyncBlockedContents
{
    private const string SITE_HASH = '1b04f287644330e02cab8e616c5a657a24e0a759081235d2739612924eb73680';

    private const string SYNCED_AT_KEY = 'moderation:blocked_contents_synced_at';

    private const string API_URL = 'https://alt-uu.binota.org/api/moderation/blocked-contents';

    public function __invoke(): void
    {
        $lastSyncedAt = KeyValueStore::where('key', self::SYNCED_AT_KEY)->first()?->value;

        $query = ['site_hash' => self::SITE_HASH];

        if ($lastSyncedAt !== null) {
            $query['since'] = $lastSyncedAt;
        }

        try {
            $response = Http::get(self::API_URL, $query)->throw();
        } catch (RequestException) {
            return;
        }

        /** @var array<int, array{b: string, n: string, r: string|null, t: int}> $items */
        $items = $response->json();

        if (! is_array($items)) {
            return;
        }

        foreach ($items as $item) {
            if (! isset($item['b'], $item['n'], $item['t']) || ! array_key_exists('r', $item)) {
                continue;
            }

            if ($item['r'] === null) {
                BlockedContent::where('board_hash', $item['b'])
                    ->where('node_hash', $item['n'])
                    ->delete();

                continue;
            }

            BlockedContent::updateOrCreate(
                [
                    'board_hash' => $item['b'],
                    'node_hash' => $item['n'],
                ],
                [
                    'reason' => $item['r'],
                    'blocked_at' => Date::createFromTimestamp($item['t']),
                ],
            );
        }

        KeyValueStore::updateOrCreate(
            ['key' => self::SYNCED_AT_KEY],
            ['value' => Date::now()->toIso8601String()],
        );
    }
}
