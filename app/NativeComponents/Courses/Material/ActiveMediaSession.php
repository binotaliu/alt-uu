<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Material;

use AltUU\MediaPlayer\Facades\MediaPlayer;
use Throwable;

/**
 * The material the native player is still playing (native replacement for
 * `restoreActiveMediaRoute.ts` and `loadNativeRestoreState()`).
 *
 * The player is process-wide and every `<native:media-playback>` echoes its
 * `sessionContext` back through `MediaPlayer::getState()`. When PHP restarts
 * under a live player (the screen stack is gone, the audio keeps running) the
 * first screen can ask `find()` where the user was and navigate back there.
 */
final class ActiveMediaSession
{
    /**
     * @return array{cid: string, activityId: string, routePath: string, startedAt: string|null}|null
     */
    public static function find(): ?array
    {
        try {
            $state = MediaPlayer::getState();
        } catch (Throwable) {
            return null;
        }

        if (! is_object($state) || ($state->isActive ?? false) !== true) {
            return null;
        }

        $context = $state->sessionContext ?? null;

        if (is_string($context)) {
            $context = json_decode($context);
        }

        if (! is_object($context) && ! is_array($context)) {
            return null;
        }

        $context = (array) $context;

        $cid = $context['cid'] ?? null;
        $activityId = $context['activityId'] ?? null;
        $routePath = $context['routePath'] ?? null;
        $startedAt = $context['startedAt'] ?? null;

        if (! is_string($cid) || $cid === '' || ! is_string($activityId) || $activityId === '' || ! is_string($routePath) || $routePath === '') {
            return null;
        }

        return [
            'cid' => $cid,
            'activityId' => $activityId,
            'routePath' => $routePath,
            'startedAt' => is_string($startedAt) && trim($startedAt) !== '' ? $startedAt : null,
        ];
    }
}
