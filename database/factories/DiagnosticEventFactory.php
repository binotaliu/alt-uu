<?php

declare(strict_types=1);

namespace Database\Factories;

use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticSourceEnum;
use App\Models\DiagnosticEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DiagnosticEvent>
 */
final class DiagnosticEventFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'occurred_at' => now(),
            'type' => DiagnosticEventTypeEnum::ApiRequest,
            'level' => DiagnosticLevelEnum::Info,
            'source' => DiagnosticSourceEnum::Server,
            'op' => 'courses.list',
            'request_id' => fake()->regexify('[0-9a-f]{8}'),
            'summary' => 'GET /api/courses',
            'status' => 200,
            'duration_ms' => fake()->numberBetween(10, 2000),
            'context' => [],
        ];
    }

    public function failed(int $status = 503): self
    {
        return $this->state(fn (): array => [
            'level' => DiagnosticLevelEnum::Error,
            'status' => $status,
        ]);
    }

    public function upstream(int $status = 500): self
    {
        return $this->state(fn (): array => [
            'type' => DiagnosticEventTypeEnum::UpstreamCall,
            'level' => DiagnosticLevelEnum::Error,
            'summary' => 'GET uu.nou.edu.tw/xmlapi/index.php',
            'status' => $status,
        ]);
    }

    public function fromClient(): self
    {
        return $this->state(fn (): array => [
            'source' => DiagnosticSourceEnum::Client,
            'type' => DiagnosticEventTypeEnum::ClientError,
            'level' => DiagnosticLevelEnum::Error,
            'status' => null,
        ]);
    }
}
