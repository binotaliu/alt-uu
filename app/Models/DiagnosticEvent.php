<?php

declare(strict_types=1);

namespace App\Models;

use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticSourceEnum;
use Database\Factories\DiagnosticEventFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A single entry in the on-device diagnostic log.
 *
 * Rows are written already redacted — see DiagnosticRedactor — so the table
 * itself never holds credentials, tickets or cookies.
 */
final class DiagnosticEvent extends Model
{
    /** @use HasFactory<DiagnosticEventFactory> */
    use HasFactory;

    public $timestamps = false;

    /** Keeps the milliseconds that make concurrent events orderable. */
    protected $dateFormat = 'Y-m-d H:i:s.v';

    protected $casts = [
        'occurred_at' => 'immutable_datetime',
        'type' => DiagnosticEventTypeEnum::class,
        'level' => DiagnosticLevelEnum::class,
        'source' => DiagnosticSourceEnum::class,
        'context' => 'array',
    ];

    protected $fillable = [
        'occurred_at',
        'type',
        'level',
        'source',
        'op',
        'request_id',
        'summary',
        'status',
        'duration_ms',
        'context',
    ];

    /**
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeProblems(Builder $query): Builder
    {
        return $query->whereIn('level', [
            DiagnosticLevelEnum::Warning->value,
            DiagnosticLevelEnum::Error->value,
        ]);
    }
}
