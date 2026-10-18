import { cssInterop } from 'nativewind';
import Svg, { Circle, Path } from 'react-native-svg';

const StyledSvg = cssInterop(Svg, {
  className: { target: 'style', nativeStyleToProp: { color: true } },
});

/** Icons of the material page that the shared icon set does not have. */
const icons = {
  clock: { paths: ['M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'] },
  'chevron-left': { paths: ['M15.75 19.5 8.25 12l7.5-7.5'] },
  'chevron-right': { paths: ['m8.25 4.5 7.5 7.5-7.5 7.5'] },
  reload: { paths: ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v4.5h-4.5'] },
  camera: {
    paths: [
      'M4 8a2 2 0 0 1 2-2h1.5l1.2-1.6A1 1 0 0 1 9.5 4h5a1 1 0 0 1 .8.4L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z',
    ],
    circle: { cx: 12, cy: 12.5, r: 3.5 },
  },
  download: {
    paths: [
      'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3',
    ],
  },
  'skip-back': {
    paths: ['M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3'],
  },
  'skip-forward': {
    paths: ['m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3'],
  },
} as const;

export type MaterialIconName = keyof typeof icons;

export interface MaterialIconProps {
  name: MaterialIconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function MaterialIcon({
  name,
  size = 20,
  className,
  strokeWidth = 1.8,
}: MaterialIconProps) {
  const icon = icons[name];

  return (
    <StyledSvg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {icon.paths.map((d) => (
        <Path key={d} d={d} />
      ))}
      {'circle' in icon ? (
        <Circle cx={icon.circle.cx} cy={icon.circle.cy} r={icon.circle.r} />
      ) : null}
    </StyledSvg>
  );
}

/** Filled play / pause glyph for the audio controls. */
export function PlayPauseGlyph({
  playing,
  size = 14,
  color = '#ffffff',
}: {
  playing: boolean;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {playing ? (
        <Path d="M6 4h4v16H6zM14 4h4v16h-4z" />
      ) : (
        <Path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
      )}
    </Svg>
  );
}
