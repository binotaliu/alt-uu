<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class StudyTimeRecorded
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly string $cid,
    ) {}
}
