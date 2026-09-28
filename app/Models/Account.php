<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Account extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['username', 'nickname', 'password', 'hungu_session', 'school_portal_session'];

    protected $casts = [
        'password' => 'encrypted',
        'hungu_session' => 'encrypted:array',
        'school_portal_session' => 'encrypted:array',
    ];
}
