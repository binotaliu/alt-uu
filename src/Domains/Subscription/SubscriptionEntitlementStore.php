<?php

declare(strict_types=1);

namespace AltUU\Domains\Subscription;

use App\Models\KeyValueStore;
use JsonException;

final readonly class SubscriptionEntitlementStore
{
    private const ENTITLEMENT_KEY = 'subscription:entitlement';

    /**
     * @return array{active: bool, productId: ?string, expiresAt: ?string, platform: ?string, reference: ?array<string, mixed>}|null
     */
    public function get(): ?array
    {
        $record = KeyValueStore::query()->find(self::ENTITLEMENT_KEY);

        if (! $record) {
            return null;
        }

        try {
            $decoded = json_decode($record->value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        return [
            'active' => (bool) ($decoded['active'] ?? false),
            'productId' => $decoded['productId'] ?? null,
            'expiresAt' => $decoded['expiresAt'] ?? null,
            'platform' => $decoded['platform'] ?? null,
            'reference' => $decoded['reference'] ?? null,
        ];
    }

    /**
     * @param  ?array<string, mixed>  $reference
     */
    public function put(bool $active, ?string $productId, ?string $expiresAt, ?string $platform, ?array $reference): void
    {
        KeyValueStore::query()->updateOrCreate(
            ['key' => self::ENTITLEMENT_KEY],
            ['value' => json_encode([
                'active' => $active,
                'productId' => $productId,
                'expiresAt' => $expiresAt,
                'platform' => $platform,
                'reference' => $reference,
                'checkedAt' => now()->toIso8601String(),
            ], JSON_THROW_ON_ERROR)],
        );
    }
}
