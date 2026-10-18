import { BackButton, Screen, TransparentPageHeader } from '@altuu/ui';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, type RefreshControlProps } from 'react-native';

export interface SubPageProps {
  title: string;
  backHref?: Href;
  onBack?: () => void;
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Narrower or wider content column; legacy used max-w-2xl / max-w-4xl. */
  wide?: boolean;
}

/**
 * Legacy "sticky transparent header + centred column" page used by the
 * account and settings screens.
 */
export function SubPage({
  title,
  backHref,
  onBack,
  children,
  refreshControl,
  wide = false,
}: SubPageProps) {
  return (
    <Screen ignoreTopInset>
      <TransparentPageHeader
        title={title}
        icon={<BackButton href={backHref} onPress={onBack} />}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        contentContainerClassName={`mx-auto w-full gap-4 px-4 pb-10 pt-2 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}
      >
        {children}
      </ScrollView>
    </Screen>
  );
}
