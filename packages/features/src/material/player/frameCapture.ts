/** Footer note on every captured frame (legacy MediaFrameCapture). */
export const FRAME_CAPTURE_DISCLAIMER =
    '此截圖僅供個人保存學術使用，請遵循合理使用原則，合法使用教材，遵守智慧財產權。此截圖由 Alt UU 產生。';

/** `HH:MM:SS` of the captured position. */
export function frameTimestampLabel(seconds: number): string {
    const total = Math.max(
        0,
        Math.floor(Number.isFinite(seconds) ? seconds : 0),
    );
    const pad = (value: number) => value.toString().padStart(2, '0');

    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** The footer's first line: `課程 · 教材  00:01:02`. */
export function frameInfoLine(
    courseName: string | null,
    materialName: string | null,
    seconds: number,
): string {
    const title = [courseName, materialName]
        .filter((part): part is string => !!part && part !== '')
        .join(' · ');

    return title === ''
        ? frameTimestampLabel(seconds)
        : `${title}  ${frameTimestampLabel(seconds)}`;
}

/** File name (without extension) of the shared JPEG. */
export function frameCaptureFileName(
    materialName: string | null,
    seconds: number,
): string {
    const safe = (materialName ?? '')
        .split(/[/\\:?%*|"<>\r\n]/)
        .join('_')
        .trim();
    const prefix =
        safe === '' ? 'AltUU' : Array.from(safe).slice(0, 40).join('');

    return `${prefix}_${frameTimestampLabel(seconds).replaceAll(':', '-')}`;
}

export interface WatermarkPlacement {
    /** Centre of the label, in the frame's coordinate space. */
    centerX: number;
    centerY: number;
    /** Rotation in radians. */
    angle: number;
}

/**
 * 4–6 student-ID watermarks, one per horizontal band at a random position
 * and angle, so a single crop cannot remove them (legacy drawWatermarks).
 */
export function watermarkPlacements(
    width: number,
    height: number,
    labelWidth: number,
    random: () => number = Math.random,
): WatermarkPlacement[] {
    const between = (min: number, max: number) => min + (max - min) * random();
    const count = 4 + Math.min(2, Math.floor(random() * 3));
    const bandHeight = height / count;
    const half = labelWidth / 2;

    return Array.from({ length: count }, (_, index) => ({
        centerX: between(half, Math.max(half, width - half)),
        centerY: bandHeight * (index + between(0.2, 0.8)),
        angle: between(-0.5, 0.5),
    }));
}
