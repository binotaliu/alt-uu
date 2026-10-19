import { Text, Icon, type IconName } from '@altuu/ui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

/** White rounded panel used by every account / settings section. */
export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`rounded-xl border border-theme-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      {children}
    </View>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
      {children}
    </Text>
  );
}

export function CardDescription({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Text
      className={`mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400 ${className}`}
    >
      {children}
    </Text>
  );
}

export interface OutlineButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  accessibilityLabel?: string;
}

/** The soft bordered button of the legacy settings pages. */
export function OutlineButton({
  label,
  onPress,
  icon,
  disabled = false,
  loading = false,
  className = '',
  accessibilityLabel,
}: OutlineButtonProps) {
  const blocked = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked }}
      disabled={blocked}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 active:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:active:bg-zinc-700 ${blocked ? 'opacity-60' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#9ca3af" />
      ) : icon ? (
        <Icon
          name={icon}
          size={16}
          className="text-theme-700 dark:text-zinc-200"
        />
      ) : null}
      <Text className="text-sm font-medium text-theme-800 dark:text-zinc-100">
        {label}
      </Text>
    </Pressable>
  );
}

/** Legacy PremiumBadge: marks features that need Alt UU+. */
export function PremiumBadge() {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-900/40">
      <Icon
        name="lock-closed"
        size={12}
        className="text-amber-700 dark:text-amber-400"
      />
      <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
        Alt UU+
      </Text>
    </View>
  );
}

/** Profile picture, or the placeholder user icon. */
export function Avatar({
  picture,
  size,
}: {
  picture: string | null | undefined;
  size: number;
}) {
  return picture ? (
    <Image
      source={{ uri: picture }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <Icon
      name="user-circle"
      size={size}
      className="text-theme-700 dark:text-zinc-500"
    />
  );
}

export interface FormFieldProps extends TextInputProps {
  label?: string;
  icon?: IconName;
  invalid?: boolean;
  trailing?: ReactNode;
  compact?: boolean;
}

/** Labelled text input in the legacy rounded style. */
export function FormField({
  label,
  icon,
  invalid = false,
  trailing,
  compact = false,
  ...inputProps
}: FormFieldProps) {
  return (
    <View>
      {label ? (
        <Text className="mb-1 text-sm font-medium text-theme-800 dark:text-zinc-100">
          {label}
        </Text>
      ) : null}
      <View
        className={`flex-row items-center rounded-xl border bg-white px-3 dark:bg-zinc-700 ${
          invalid ? 'border-rose-400' : 'border-theme-300 dark:border-zinc-600'
        }`}
      >
        {icon ? (
          <Icon
            name={icon}
            size={20}
            className="text-theme-700 dark:text-zinc-400"
          />
        ) : null}
        <TextInput
          accessibilityLabel={label ?? inputProps.placeholder}
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          {...inputProps}
          className={`min-w-0 flex-1 px-2 text-theme-900 dark:text-zinc-100 ${compact ? 'py-2 text-sm' : 'py-3 text-base'}`}
        />
        {trailing}
      </View>
    </View>
  );
}

/** FormField for passwords, with the show / hide eye. */
export function PasswordField(
  props: Omit<FormFieldProps, 'trailing' | 'secureTextEntry' | 'icon'>,
) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      icon="lock-closed"
      textContentType="password"
      autoComplete="current-password"
      {...props}
      secureTextEntry={!visible}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? '隱藏密碼' : '顯示密碼'}
          hitSlop={8}
          onPress={() => setVisible((value) => !value)}
          className="ml-2 p-1"
        >
          <Icon
            name={visible ? 'eye-slash' : 'eye'}
            size={20}
            className="text-theme-700 dark:text-zinc-400"
          />
        </Pressable>
      }
    />
  );
}

/** Solid primary action (login, confirm). */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  className = '',
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`items-center rounded-xl bg-theme-700 px-4 py-3 active:bg-theme-800 ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      <Text className="font-medium text-theme-50">{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text className="text-xs text-rose-600 dark:text-rose-400">{children}</Text>
  );
}

/** The small "Alt UU+" sparkles used on upsells. */
export function Sparkles({
  size = 24,
  className = 'text-amber-600 dark:text-amber-400',
}: {
  size?: number;
  className?: string;
}) {
  return <Icon solid name="sparkles" size={size} className={className} />;
}

export interface FlashState {
  message: string | null;
  tone: 'success' | 'error';
}

/**
 * Minimal stand-in for the legacy `window.showFlashMessage`: a message that
 * clears itself. Render {@link FlashBanner} somewhere in the screen.
 */
export function useFlash(durationMs = 2500) {
  const [flash, setFlash] = useState<FlashState>({
    message: null,
    tone: 'success',
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const show = useCallback(
    (message: string, tone: FlashState['tone'] = 'success') => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }

      setFlash({ message, tone });
      timer.current = setTimeout(
        () => setFlash({ message: null, tone }),
        durationMs,
      );
    },
    [durationMs],
  );

  return { flash, show };
}

export function FlashBanner({ flash }: { flash: FlashState }) {
  if (flash.message === null) {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      className={`rounded-xl px-4 py-3 ${
        flash.tone === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
      }`}
    >
      <Text className="text-sm font-medium text-white">{flash.message}</Text>
    </View>
  );
}

export interface PillSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  /** Colour of the "on" track; the diagnostics screens use green. */
  tone?: 'theme' | 'green';
}

/** The small 48x28 pill switch of the legacy settings cards. */
export function PillSwitch({
  value,
  onValueChange,
  label,
  disabled = false,
  tone = 'theme',
}: PillSwitchProps) {
  const on =
    tone === 'green'
      ? 'bg-emerald-600 dark:bg-emerald-500'
      : 'bg-theme-700 dark:bg-theme-600';

  // Legacy `transition`: the thumb slides between translate-x-1 and translate-x-6.
  const [thumbX] = useState(() => new Animated.Value(value ? 24 : 4));

  useEffect(() => {
    Animated.timing(thumbX, {
      toValue: value ? 24 : 4,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [value, thumbX]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      className={`h-7 w-12 shrink-0 justify-center rounded-full ${
        value ? on : 'bg-theme-300 dark:bg-zinc-600'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <Animated.View
        className="size-5 rounded-full bg-white"
        style={{ transform: [{ translateX: thumbX }] }}
      />
    </Pressable>
  );
}

/** Card with a title, description and a pill switch (settings toggles). */
export function SwitchCard({
  title,
  description,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </View>
        <PillSwitch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          label={`切換${title}`}
        />
      </View>
    </Card>
  );
}
