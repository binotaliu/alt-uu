<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Account;
use App\Models\AccountDailyActivity;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AccountDailyActivity>
 */
final class AccountDailyActivityFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'account_id' => Account::factory(),
            'activity_date' => fake()->date(),
            'total_seconds' => fake()->numberBetween(60, 7200),
        ];
    }
}
