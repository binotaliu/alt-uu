<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

final class AttachmentDownload extends Model
{
    use SoftDeletes;

    public const STATUS_QUEUED = 'queued';

    public const STATUS_DOWNLOADING = 'downloading';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'cid',
        'source_url',
        'file_name',
        'status',
        'relative_path',
        'mime_type',
        'file_size',
        'error_message',
        'started_at',
        'completed_at',
        'expires_at',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'expires_at' => 'datetime',
    ];
}
