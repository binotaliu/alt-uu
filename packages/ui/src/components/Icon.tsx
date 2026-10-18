import { cssInterop } from 'nativewind';
import Svg, { Path } from 'react-native-svg';

import { iconPaths, solidIconPaths, type IconName } from '../icons/paths';

const StyledSvg = cssInterop(Svg, {
    className: { target: 'style', nativeStyleToProp: { color: true } },
});

export interface IconProps {
    name: IconName;
    size?: number;
    /** Tailwind text colour utilities drive the stroke (`text-theme-700 dark:text-zinc-300`). */
    className?: string;
    strokeWidth?: number;
    /**
     * Draws the filled Heroicons variant when `solidIconPaths` has one for
     * `name`; otherwise the outline icon is drawn.
     */
    solid?: boolean;
}

/** Heroicons outline (or solid) icon (see icons/paths.ts for the available names). */
export function Icon({
    name,
    size = 24,
    className,
    strokeWidth = 1.5,
    solid = false,
}: IconProps) {
    const solidPaths = solid ? solidIconPaths[name] : undefined;

    return (
        <StyledSvg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={solidPaths ? 'currentColor' : 'none'}
            stroke={solidPaths ? 'none' : 'currentColor'}
            strokeWidth={solidPaths ? undefined : strokeWidth}
            className={className}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            {solidPaths
                ? solidPaths.map((d) => (
                      <Path
                          key={d}
                          d={d}
                          fillRule="evenodd"
                          clipRule="evenodd"
                      />
                  ))
                : iconPaths[name].map((d) => (
                      <Path
                          key={d}
                          d={d}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                      />
                  ))}
        </StyledSvg>
    );
}
