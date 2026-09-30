/**
 MediaPlayer Plugin for NativePHP Mobile

 @example
 import { mediaPlayer } from '@altuu/plugin-media-player';

 // Control playback (the player itself is the <native:media-player> element)
 await mediaPlayer.play();
 await mediaPlayer.pause();
 await mediaPlayer.seek(30);
 await mediaPlayer.stop();
 */

const baseUrl = '/_native/api/call';

/**
 * Internal bridge call function
 * @private
 */
async function bridgeCall(method, params = {}) {
    const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ method, params }),
    });

    const result = await response.json();

    if (result.status === 'error') {
        throw new Error(result.message || 'Native call failed');
    }

    const nativeResponse = result.data;

    if (nativeResponse && nativeResponse.data !== undefined) {
        return nativeResponse.data;
    }

    return nativeResponse;
}

/**
 * Play the current media
 * @returns {Promise<Object>}
 */
export async function play() {
    return bridgeCall('MediaPlayer.Play');
}

/**
 * Pause the current media
 * @returns {Promise<Object>}
 */
export async function pause() {
    return bridgeCall('MediaPlayer.Pause');
}

/**
 * Stop the current media
 * @returns {Promise<Object>}
 */
export async function stop() {
    return bridgeCall('MediaPlayer.Stop');
}

/**
 * Seek to a specific time
 * @param {number} seconds - Time in seconds
 * @returns {Promise<Object>}
 */
export async function seek(seconds) {
    if (typeof seconds !== 'number' || seconds < 0) {
        throw new Error('Invalid seek time');
    }

    return bridgeCall('MediaPlayer.Seek', { time: seconds });
}

/**
 * Get the current playback position
 * @returns {Promise<number>} Current time in seconds
 */
export async function getCurrentTime() {
    const result = await bridgeCall('MediaPlayer.GetCurrentTime');

    return typeof result?.time === 'number' ? result.time : 0;
}

/**
 * Set playback rate (0.5 to 3.0)
 * @param {number} rate - Playback rate
 * @returns {Promise<Object>}
 */
export async function setPlaybackRate(rate) {
    if (typeof rate !== 'number' || rate < 0.0 || rate > 3.0) {
        throw new Error('Invalid playback rate');
    }

    return bridgeCall('MediaPlayer.SetPlaybackRate', { rate });
}

/**
 * Get current playback rate
 * @returns {Promise<number>}
 */
export async function getPlaybackRate() {
    const result = await bridgeCall('MediaPlayer.GetPlaybackRate');

    return typeof result?.rate === 'number' ? result.rate : 1.0;
}

/**
 * Get current player state and restore context
 * @returns {Promise<Object>}
 */
export async function getState() {
    return bridgeCall('MediaPlayer.GetState');
}

/**
 * MediaPlayer namespace object
 */
export const mediaPlayer = {
    setPlayer,
    play,
    pause,
    stop,
    seek,
    getCurrentTime,
    setPlaybackRate,
    getPlaybackRate,
    getState,
};

export default mediaPlayer;
