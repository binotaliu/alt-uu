<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

final class BlockedContent extends Model
{
    use HasFactory;

    protected $table = 'blocked_contents';

    protected $fillable = [
        'board_hash',
        'node_hash',
        'reason',
        'blocked_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'blocked_at' => 'datetime',
    ];
}
