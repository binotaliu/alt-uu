<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\AccountDailyActivityFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AccountDailyActivity extends Model
{
    /** @use HasFactory<AccountDailyActivityFactory> */
    use HasFactory;

    protected $fillable = [
        'account_id',
        'activity_date',
        'total_seconds',
    ];

    protected $casts = [
        'account_id' => 'integer',
        'total_seconds' => 'integer',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
