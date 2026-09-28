<?php

declare(strict_types=1);

namespace App\Services\Diagnostics;

use Closure;

/**
 * Lets a caller opt out of upstream-call recording for the duration of a
 * closure.
 *
 * The connectivity probes in src/Domains/Diagnostics/Checks are the reason
 * this exists: their failures ARE the diagnostic result and are already shown
 * in the UI, so recording them too would duplicate the information while
 * pushing genuine events out of the bounded ring buffer.
 */
final class UpstreamRecordingSwitch
{
    private bool $suppressed = false;

    /**
     * @template TReturn
     *
     * @param  Closure(): TReturn  $callback
     * @return TReturn
     */
    public function withoutRecording(Closure $callback): mixed
    {
        $previous = $this->suppressed;
        $this->suppressed = true;

        try {
            return $callback();
        } finally {
            $this->suppressed = $previous;
        }
    }

    public function isSuppressed(): bool
    {
        return $this->suppressed;
    }
}
