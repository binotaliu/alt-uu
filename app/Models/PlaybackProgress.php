<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class PlaybackProgress extends Model
{
    protected $table = 'playback_progress';

    protected $fillable = [
        'account_id',
        'cid',
        'activity_id',
        'duration_seconds',
        'position_seconds',
        'media_duration_seconds',
        'hungu_upload_success',
    ];

    protected $casts = [
        'account_id' => 'integer',
        'duration_seconds' => 'integer',
        'position_seconds' => 'float',
        'media_duration_seconds' => 'float',
        'hungu_upload_success' => 'boolean',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
