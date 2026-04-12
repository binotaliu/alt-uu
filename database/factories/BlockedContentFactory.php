<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\BlockedContent;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BlockedContent> */
final class BlockedContentFactory extends Factory
{
    protected $model = BlockedContent::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'board_hash' => hash('sha256', fake()->uuid()),
            'node_hash' => hash('sha256', fake()->uuid()),
            'reason' => fake()->randomElement(['s', 'i', 'c', 'p', 'l', 'm', 'o']),
            'blocked_at' => fake()->dateTime(),
        ];
    }
}
