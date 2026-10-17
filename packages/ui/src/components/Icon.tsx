import { cssInterop } from 'nativewind';
import Svg, { Path } from 'react-native-svg';

import { iconPaths, type IconName } from '../icons/paths';

const StyledSvg = cssInterop(Svg, {
    className: { target: 'style', nativeStyleToProp: { color: true } },
});

export interface IconProps {
    name: IconName;
    size?: number;
    /** Tailwind text colour utilities drive the stroke (`text-theme-700 dark:text-zinc-300`). */
    className?: string;
    strokeWidth?: number;
}

/** Heroicons outline icon (see icons/paths.ts for the available names). */
export function Icon({
    name,
    size = 24,
    className,
    strokeWidth = 1.5,
}: IconProps) {
    return (
        <StyledSvg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className={className}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            {iconPaths[name].map((d) => (
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
