import { Icon, Text, useIsDark, type IconName } from '@altuu/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useServiceRuntime } from '../../services/AppServicesProvider';
import { useAppPreferences, useUpdatePreferences } from '../../services/hooks';
import { authBackgroundStyle } from '../components/backgrounds';
import {
  Card,
  CardDescription,
  CardTitle,
  PillSwitch,
} from '../components/primitives';

interface OnboardingSlide {
  id: 'about' | 'study-time' | 'nou-tools';
  title: string;
  description: string;
  note?: string;
  icon: IconName;
  /** Icon tile colours (legacy `panelClass`). */
  panelClass: string;
  iconClass: string;
}

export const onboardingSlides: readonly OnboardingSlide[] = [
  {
    id: 'about',
    title: '這是什麼 App？',
    description:
      'Alt UU 是一款由學生開發的，用於替代網頁版 UU 平台的瀏覽器 App。使用 Alt UU 能讓你在行動裝置上方便地存取 UU 平台的教材，隨時隨地學習。',
    note: '備註：你必須擁有有效的 UU 平台帳號，才可以使用本 App。',
    icon: 'academic-cap',
    panelClass:
      'bg-amber-500/15 border-amber-300/70 dark:bg-amber-400/10 dark:border-amber-400/20',
    iconClass: 'text-amber-900 dark:text-amber-100',
  },
  {
    id: 'study-time',
    title: '保存學習時數',
    description:
      '選擇教材後，你會在畫面的右上方看到計時器，這個時間表示你本次學習的時數。觀看完畢後，記得點擊左上角的返回按鈕來保存本次的學習時數喔！',
    icon: 'clock',
    panelClass:
      'bg-sky-500/15 border-sky-300/70 dark:bg-sky-400/10 dark:border-sky-400/20',
    iconClass: 'text-sky-900 dark:text-sky-100',
  },
  {
    id: 'nou-tools',
    title: 'NOU 小幫手整合',
    description:
      'Alt UU 支援整合「NOU 小幫手」，開啟後即可看到學校行事曆、視訊面授、以及考古題等資訊。',
    note: '備註：開啟本功能時，將傳送部分詮釋資料（如課程名稱等）給「NOU 小幫手」，此資料不會與其他人分享，你可以選擇是否要開啟此功能。此功能可於稍後在 App 內的「設定」頁中開啟或關閉。',
    icon: 'puzzle-piece',
    panelClass:
      'bg-emerald-500/15 border-emerald-300/70 dark:bg-emerald-400/10 dark:border-emerald-400/20',
    iconClass: 'text-emerald-900 dark:text-emerald-100',
  },
];

const SWIPE_DISTANCE = 48;

/** Static preview of the study timer header (legacy "study-time" slide). */
function StudyTimerPreview() {
  return (
    <View className="mt-8 overflow-hidden rounded-2xl border border-theme-200 bg-white/90 dark:border-zinc-700/80 dark:bg-zinc-900/90">
      <View className="flex-row items-stretch border-b border-theme-200 dark:border-zinc-700/80">
        <View className="flex-1 flex-row items-center gap-3 px-4 py-3.5">
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon
              name="chevron-right"
              size={24}
              className="text-theme-700 dark:text-zinc-300"
            />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <View className="h-5 w-20 rounded bg-theme-200 dark:bg-zinc-700" />
            <View className="h-4 w-32 rounded bg-theme-100 dark:bg-zinc-800" />
          </View>
        </View>
        <View className="shrink-0 justify-center px-4 py-3.5">
          <View className="flex-row items-center gap-2 rounded-full bg-theme-100 px-3 py-1.5 dark:bg-zinc-700/60">
            <Icon
              name="clock"
              size={16}
              className="text-theme-800 dark:text-zinc-200"
            />
            <Text className="text-xs font-medium text-theme-800 dark:text-zinc-200">
              12:34
            </Text>
          </View>
        </View>
      </View>
      <View className="bg-theme-50/50 px-4 py-3 dark:bg-zinc-800/30">
        <Text className="text-sm leading-relaxed text-theme-700 dark:text-zinc-300">
          觀看完成記得按返回按鈕，系統將會自動記錄你觀看課程內容的時間
        </Text>
      </View>
    </View>
  );
}

/** Legacy Auth/Onboarding.vue. */
export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const runtime = useServiceRuntime();
  const preferences = useAppPreferences();
  const isDark = useIsDark();
  const updatePreferences = useUpdatePreferences();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const slide = onboardingSlides[currentSlide]!;
  const isLastSlide = currentSlide === onboardingSlides.length - 1;

  const onTouchEnd = (event: GestureResponderEvent) => {
    const startX = touchStartX;
    setTouchStartX(null);

    if (startX === null) {
      return;
    }

    const delta = event.nativeEvent.pageX - startX;

    if (delta <= -SWIPE_DISTANCE && !isLastSlide) {
      setCurrentSlide((value) => value + 1);
    } else if (delta >= SWIPE_DISTANCE && currentSlide > 0) {
      setCurrentSlide((value) => value - 1);
    }
  };

  const setNouTools = async (enabled: boolean) => {
    setErrorMessage(null);

    try {
      await updatePreferences.mutateAsync({
        nouToolsIntegrationEnabled: enabled,
      });
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error
          ? caught.message
          : '更新 NOU 小幫手整合失敗，請稍後再試。',
      );
    }
  };

  const finish = async () => {
    setIsFinishing(true);
    setErrorMessage(null);

    try {
      const config = await runtime.run('app.config', () =>
        runtime.services.appConfig.get(),
      );
      await updatePreferences.mutateAsync({
        onboardingCompleted: true,
        whatsNewSeenVersion: config.appVersion,
      });
      const hasAccounts = await runtime.services.account.hasAny();

      router.replace(hasAccounts ? '/courses' : '/login');
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error
          ? caught.message
          : '儲存 onboarding 狀態失敗，請稍後再試。',
      );
    } finally {
      setIsFinishing(false);
    }
  };

  const handleContinue = () => {
    if (!isLastSlide) {
      setCurrentSlide((value) => value + 1);

      return;
    }

    void finish();
  };

  return (
    <ScrollView
      className="flex-1 bg-theme-50 dark:bg-zinc-950"
      style={authBackgroundStyle(isDark)}
      contentContainerClassName="flex-grow items-center justify-center px-5"
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, 32),
        paddingBottom: Math.max(insets.bottom, 32),
      }}
    >
      <View className="w-full max-w-md overflow-hidden rounded-[2rem] border border-theme-200 bg-white/85 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/90">
        <View className="flex-row items-center justify-between px-2 pb-3 pt-1">
          <View>
            <Text className="text-xs font-medium text-theme-700 dark:text-theme-300">
              Welcome
            </Text>
            <Text
              accessibilityRole="header"
              className="mt-1 text-xl font-semibold text-theme-900 dark:text-zinc-50"
            >
              歡迎使用 Alt UU
            </Text>
          </View>
          <Text className="text-sm text-theme-700 dark:text-zinc-400">
            {`${currentSlide + 1} / ${onboardingSlides.length}`}
          </Text>
        </View>

        <View
          className="bg-theme-50/80 rounded-[1.75rem] border border-theme-100 px-3 pb-4 pt-3 dark:border-zinc-800 dark:bg-zinc-950/70"
          onTouchStart={(event) => setTouchStartX(event.nativeEvent.pageX)}
          onTouchEnd={onTouchEnd}
        >
          <View className="p-1">
            <View
              className={`size-12 items-center justify-center rounded-2xl border ${slide.panelClass}`}
            >
              <Icon name={slide.icon} size={24} className={slide.iconClass} />
            </View>
          </View>

          <View className="px-2 pb-1 pt-5">
            <Text className="text-2xl font-semibold text-theme-900 dark:text-zinc-50">
              {slide.title}
            </Text>
            <Text className="mt-3 text-sm leading-7 text-theme-700 dark:text-zinc-300">
              {slide.description}
            </Text>
            {slide.note ? (
              <Text className="mt-3 text-xs leading-6 text-theme-700 dark:text-zinc-400">
                {slide.note}
              </Text>
            ) : null}

            {slide.id === 'nou-tools' ? (
              <Card className="mt-4 rounded-2xl">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="min-w-0 flex-1">
                    <CardTitle>開啟 NOU 小幫手整合</CardTitle>
                    <CardDescription>
                      開啟後即可在課程內看到學校行事曆、視訊面授與考古題等資訊。
                    </CardDescription>
                  </View>
                  <PillSwitch
                    label="切換 NOU 小幫手整合"
                    value={preferences.nouToolsIntegrationEnabled}
                    disabled={updatePreferences.isPending}
                    onValueChange={(value) => void setNouTools(value)}
                  />
                </View>
              </Card>
            ) : null}
            {slide.id === 'study-time' ? <StudyTimerPreview /> : null}
          </View>
        </View>

        <View className="flex-row items-center justify-center gap-2 px-2 py-4">
          {onboardingSlides.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`切換至 ${item.title}`}
              hitSlop={8}
              onPress={() => setCurrentSlide(index)}
              className={`h-2.5 rounded-full ${
                index === currentSlide
                  ? 'w-7 bg-theme-800 dark:bg-theme-400'
                  : 'w-2.5 bg-theme-300 dark:bg-zinc-700'
              }`}
            />
          ))}
        </View>

        {errorMessage ? (
          <View className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/40">
            <Text className="text-sm text-rose-700 dark:text-rose-200">
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <View className="mt-5 flex-row items-center gap-3 px-2 pb-2">
          <Pressable
            accessibilityRole="button"
            disabled={currentSlide === 0 || isFinishing}
            onPress={() => setCurrentSlide((value) => Math.max(0, value - 1))}
            className={`h-12 items-center justify-center rounded-2xl border border-theme-200 px-5 dark:border-zinc-700 ${
              currentSlide === 0 || isFinishing ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-sm font-medium text-theme-800 dark:text-zinc-200">
              上一頁
            </Text>
          </Pressable>
          <Pressable
            testID="onboarding-continue"
            accessibilityRole="button"
            disabled={isFinishing}
            onPress={handleContinue}
            className={`h-12 flex-1 items-center justify-center rounded-2xl bg-theme-800 px-5 ${
              isFinishing ? 'opacity-60' : ''
            }`}
          >
            <Text className="text-sm font-semibold text-white">
              {isFinishing ? '處理中...' : isLastSlide ? '開始使用' : '繼續'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
