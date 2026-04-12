<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\BlockedUser;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BlockedUser> */
final class BlockedUserFactory extends Factory
{
    protected $model = BlockedUser::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'poster' => fake()->userName(),
            'realname' => fake()->name(),
        ];
    }
}
