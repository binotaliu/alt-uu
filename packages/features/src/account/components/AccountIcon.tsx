import { iconPaths } from '@altuu/ui';
import { cssInterop } from 'nativewind';
import Svg, { Path } from 'react-native-svg';

import {
    accountIconPaths,
    solidIconPaths,
    type ExtraIconName,
    type SolidIconName,
} from './iconPaths';

const StyledSvg = cssInterop(Svg, {
    className: { target: 'style', nativeStyleToProp: { color: true } },
});

type SharedIconName = keyof typeof iconPaths;

/** Every outline icon these screens can draw. */
export type AccountIconName = ExtraIconName | SharedIconName;

export interface AccountIconProps {
    name: AccountIconName;
    size?: number;
    /** Tailwind text colour utilities drive the stroke. */
    className?: string;
    strokeWidth?: number;
}

/** Outline Heroicon: the shared set from @altuu/ui plus the extras these screens need. */
export function AccountIcon({
    name,
    size = 24,
    className,
    strokeWidth = 1.5,
}: AccountIconProps) {
    const paths: readonly string[] =
        name in accountIconPaths
            ? accountIconPaths[name as ExtraIconName]
            : iconPaths[name as SharedIconName];

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
            {paths.map((d) => (
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

export interface SolidIconProps {
    name: SolidIconName;
    size?: number;
    className?: string;
}

/** Filled Heroicon (legacy `24/solid` imports: the Alt UU+ sparkles, the accent check). */
export function SolidIcon({ name, size = 24, className }: SolidIconProps) {
    return (
        <StyledSvg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            {solidIconPaths[name].map((d) => (
                <Path key={d} d={d} fillRule="evenodd" clipRule="evenodd" />
            ))}
        </StyledSvg>
    );
}
