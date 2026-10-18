import {
    FRAME_CAPTURE_DISCLAIMER,
    frameCaptureFileName,
    frameInfoLine,
    frameTimestampLabel,
    watermarkPlacements,
} from './frameCapture';
import {
    PLAYBACK_RATES,
    clampSeek,
    formatPlaybackRate,
    formatPlayerTime,
} from './playback';

describe('playback helpers', () => {
    it('offers the legacy speeds', () => {
        expect(PLAYBACK_RATES).toEqual([0.5, 1, 1.25, 1.5, 2]);
        expect(PLAYBACK_RATES.map(formatPlaybackRate)).toEqual([
            '0.5x',
            '1x',
            '1.25x',
            '1.5x',
            '2x',
        ]);
    });

    it('formats player time as m:ss', () => {
        expect(formatPlayerTime(0)).toBe('0:00');
        expect(formatPlayerTime(Number.NaN)).toBe('0:00');
        expect(formatPlayerTime(61.9)).toBe('1:01');
        expect(formatPlayerTime(3661)).toBe('61:01');
    });

    it('clamps seeks into the media', () => {
        expect(clampSeek(-5, 100)).toBe(0);
        expect(clampSeek(120, 100)).toBe(100);
        expect(clampSeek(30, 0)).toBe(30);
    });
});

describe('frame capture helpers', () => {
    it('labels the timestamp as HH:MM:SS', () => {
        expect(frameTimestampLabel(0)).toBe('00:00:00');
        expect(frameTimestampLabel(3723.9)).toBe('01:02:03');
        expect(frameTimestampLabel(-3)).toBe('00:00:00');
    });

    it('builds the footer info line', () => {
        expect(frameInfoLine('課程', '第一講', 65)).toBe(
            '課程 · 第一講  00:01:05',
        );
        expect(frameInfoLine(null, '', 5)).toBe('00:00:05');
        expect(FRAME_CAPTURE_DISCLAIMER).toContain('Alt UU');
    });

    it('builds a safe file name', () => {
        expect(frameCaptureFileName('第1講: 導論/概要', 65)).toBe(
            '第1講_ 導論_概要_00-01-05',
        );
        expect(frameCaptureFileName(null, 0)).toBe('AltUU_00-00-00');
        expect(frameCaptureFileName('x'.repeat(60), 1)).toBe(
            `${'x'.repeat(40)}_00-00-01`,
        );
    });

    it('spreads 4 to 6 watermarks over horizontal bands', () => {
        const values = [0.99, 0.5, 0.5, 0.5];
        let index = 0;
        const random = () => values[index++ % values.length] as number;
        const placements = watermarkPlacements(600, 300, 100, random);

        expect(placements).toHaveLength(6);
        placements.forEach((placement, band) => {
            expect(placement.centerX).toBeGreaterThanOrEqual(50);
            expect(placement.centerX).toBeLessThanOrEqual(550);
            expect(placement.centerY).toBeGreaterThanOrEqual(band * 50);
            expect(placement.centerY).toBeLessThan((band + 1) * 50);
            expect(Math.abs(placement.angle)).toBeLessThanOrEqual(0.5);
        });
        expect(watermarkPlacements(600, 300, 100, () => 0)).toHaveLength(4);
    });
});
