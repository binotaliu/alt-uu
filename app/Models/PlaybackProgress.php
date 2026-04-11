<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class PlaybackProgress extends Model
{
    protected $table = 'playback_progress';

    protected $fillable = [
        'cid',
        'activity_id',
        'duration_seconds',
        'position_seconds',
        'hungu_upload_success',
    ];

    protected $casts = [
        'duration_seconds' => 'integer',
        'position_seconds' => 'float',
        'hungu_upload_success' => 'boolean',
    ];
}
