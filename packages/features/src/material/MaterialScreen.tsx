import type { CourseMaterialNode, ParsedMaterialContent } from '@altuu/core';
import {
  PageHeader,
  Screen,
  Text,
  FoldSplit,
  ToggleSwitch,
  useDuoLayout,
  accentPalettes,
  useIsDark,
  useIsTablet,
} from '@altuu/ui';
import { useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  courseKeys,
  useCourseLearningTimes,
  useCourses,
  useLastSeenMaterial,
} from '../courses/courseQueries';
import { MaterialDirectory } from '../courses/MaterialDirectory';
import { PremiumBadge } from '../account';
import { useServiceRuntime } from '../services/AppServicesProvider';
import { useAppPreferences, useIsSubscribed } from '../services/hooks';
import { asServiceError } from '../services/serviceError';
import { useToastStore } from '../services/stores';
import { ErrorRetry } from '../shell/ErrorRetry';
import { openExternalUrl, openInAppBrowser } from '../shell/openUrl';
import {
  clearActiveMaterialSession,
  writeActiveMaterialSession,
} from './activeMaterialSession';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';
import { seedHunguWebViewCookies } from './materialCookies';
import {
  clampFontScale,
  type MaterialHtmlPalette,
} from './materialHtmlDocument';
import { MaterialDirectorySheet } from './MaterialDirectorySheet';
import { MaterialIcon } from './MaterialIcon';
import {
  IMMERSIVE_IDLE_SECONDS,
  MIN_RESUME_POSITION_SECONDS,
  adjacentMaterials,
  buildDownloadFileName,
  hasReachedEnd,
  isAudioMaterial,
  materialRoutePath,
  resolveContentLink,
  tronclassAppUrl,
} from './materialNavigation';
import {
  CellularPrompt,
  ImmersiveCountdownToast,
  ResumePrompt,
  SavingProgressToast,
} from './MaterialPrompts';
import {
  materialKeys,
  useMaterialContent,
  useMaterialCoursePath,
  useMaterialFontScale,
  useMaterialResources,
} from './materialQueries';
import { MaterialViewer } from './MaterialViewer';
import { useFrameCapture } from './player/FrameCaptureComposer';
import {
  MaterialPlayer,
  type MaterialPlayerHandle,
  type PlaybackProgress,
} from './player/MaterialPlayer';
import { usePlaybackRateStore } from './player/PlaybackRateMenu';
import { VideoControlBar } from './player/VideoControlBar';
import { YoutubeEmbed, type YoutubeEmbedHandle } from './player/YoutubeEmbed';
import { formatDurationLabel, formatStudyClock } from './studyTimer';
import { useMaterialDownload } from './useMaterialDownload';
import { useStudyTimer, type LivePlaybackReading } from './useStudyTimer';

export interface MaterialScreenProps {
  cid: string;
  scoid: string;
}

/** Throttle of the crash-recovery checkpoint while media plays. */
const CHECKPOINT_INTERVAL_MS = 15_000;

function paletteFor(accent: string, isDark: boolean): MaterialHtmlPalette {
  const shades =
    accentPalettes[accent as keyof typeof accentPalettes] ??
    accentPalettes.warm;

  return isDark
    ? {
        text: '#d4d4d8',
        heading: '#f4f4f5',
        link: shades['400'],
        muted: '#a1a1aa',
        border: '#3f3f46',
        codeBackground: '#27272a',
      }
    : {
        text: shades['800'],
        heading: shades['900'],
        link: shades['700'],
        muted: shades['700'],
        border: shades['200'],
        codeBackground: shades['50'],
      };
}

function hasPlayableMedia(content: ParsedMaterialContent | undefined): boolean {
  return (
    !!content?.videoUrl ||
    (content?.videoProvider === 'youtube' && !!content.embedVideoUrl)
  );
}

async function isOnCellularNetwork(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();

    return state.type === Network.NetworkStateType.CELLULAR;
  } catch {
    return false;
  }
}

function MaterialSkeleton() {
  return (
    <View className="gap-3">
      <View className="aspect-video w-full rounded-2xl bg-theme-200 dark:bg-zinc-700" />
      <View className="gap-2 rounded-2xl border border-theme-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <View className="h-4 w-3/4 rounded bg-theme-200 dark:bg-zinc-700" />
        <View className="h-4 w-1/2 rounded bg-theme-200 dark:bg-zinc-700" />
        <View className="h-4 w-11/12 rounded bg-theme-200 dark:bg-zinc-700" />
      </View>
    </View>
  );
}

function AdjacentButton({
  node,
  direction,
  onPress,
}: {
  node: CourseMaterialNode | null;
  direction: 'previous' | 'next';
  onPress: () => void;
}) {
  const isNext = direction === 'next';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: node === null }}
      disabled={node === null}
      onPress={onPress}
      className={`min-w-0 flex-1 flex-row items-start gap-2 rounded-2xl border border-theme-200 bg-white p-3 active:bg-theme-50 dark:border-zinc-700 dark:bg-zinc-900 dark:active:bg-zinc-800 ${isNext ? 'justify-end' : ''} ${node === null ? 'opacity-40' : ''}`}
    >
      {isNext ? null : (
        <MaterialIcon
          name="chevron-left"
          size={16}
          className="mt-0.5 text-theme-700 dark:text-zinc-400"
        />
      )}
      <View className="min-w-0 flex-1">
        <Text
          className={`text-xs font-medium text-theme-700 dark:text-zinc-400 ${isNext ? 'text-right' : ''}`}
        >
          {isNext ? '下一個教材' : '上一個教材'}
        </Text>
        <Text
          numberOfLines={2}
          className={`text-sm font-semibold text-theme-900 dark:text-zinc-100 ${isNext ? 'text-right' : ''}`}
        >
          {node?.text || '無'}
        </Text>
      </View>
      {isNext ? (
        <MaterialIcon
          name="chevron-right"
          size={16}
          className="mt-0.5 text-theme-700 dark:text-zinc-400"
        />
      ) : null}
    </Pressable>
  );
}

/**
 * The material page (legacy pages/Courses/Material.vue): header with the
 * study clock, the player (video / audio / YouTube), the material content,
 * previous / next navigation, study-time reporting on leave, the resume and
 * cellular prompts, and crash-recovery checkpoints.
 */
interface BeforeRemoveSource {
  addListener: (event: 'beforeRemove', listener: () => void) => () => void;
  setOptions?: (options: { gestureEnabled: boolean }) => void;
}

export function MaterialScreen({ cid, scoid }: MaterialScreenProps) {
  const runtime = useServiceRuntime();
  const { services } = runtime;
  const queryClient = useQueryClient();
  const preferences = useAppPreferences();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const isTablet = useIsTablet();
  const { width, height } = useWindowDimensions();
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const learningTimes = useCourseLearningTimes(cid);
  const lastSeen = useLastSeenMaterial(cid);

  const [activeScoid, setActiveScoid] = useState(scoid);
  const courses = useCourses();
  const path = useMaterialCoursePath(cid);
  const content = useMaterialContent(cid, activeScoid);
  const resources = useMaterialResources(cid, activeScoid);
  const fontScaleQuery = useMaterialFontScale();

  const [subpage, setSubpage] = useState<{
    scoid: string;
    content: ParsedMaterialContent;
  } | null>(null);
  const [isSubpageLoading, setIsSubpageLoading] = useState(false);
  const [readyScoid, setReadyScoid] = useState<string | null>(null);
  const [cellularOpen, setCellularOpen] = useState(false);
  const cellularResolveRef = useRef<((allowed: boolean) => void) | null>(null);
  const [resume, setResume] = useState<{
    position: number;
    label: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const [cookiesReadyFor, setCookiesReadyFor] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState<number | null>(null);
  const [isSavingFontScale, setIsSavingFontScale] = useState(false);
  const videoRate = usePlaybackRateStore((state) => state.rate);
  const isSubscribed = useIsSubscribed();
  const [immersiveRequested, setImmersiveRequested] = useState(false);
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number | null>(null);
  // 沉浸式播放 is an Alt UU+ feature: a lapsed subscription switches it off.
  const immersive = immersiveRequested && isSubscribed;
  const immersiveRef = useRef(immersive);
  const finishedScoidRef = useRef<string | null>(null);

  const { foldFrame, foldAxis } = useDuoLayout();
  // The latest playback state, kept only while the folded layout shows its own controls.
  const [playback, setPlayback] = useState<PlaybackProgress | null>(null);
  const lastPositionRef = useRef(0);
  const playerRef = useRef<MaterialPlayerHandle>(null);
  const youtubeRef = useRef<YoutubeEmbedHandle>(null);
  const playbackRef = useRef({ playing: false, lastCheckpointAt: 0 });
  const leftRef = useRef(false);
  const savingRef = useRef(false);

  const displayedContent =
    subpage !== null && subpage.scoid === activeScoid
      ? subpage.content
      : content.data;
  const course = courses.data?.find((item) => item.courseId === cid) ?? null;
  const courseTitle = course?.name || `課程 ${cid}`;
  const nodes = useMemo(() => path.data?.materialNodes ?? [], [path.data]);
  const activeNode =
    nodes.find((node) => node.identifier === activeScoid) ?? null;
  const activeNodeText = activeNode?.text ?? '';
  const activeHref = activeNode?.href ?? null;
  const { previous, next } = adjacentMaterials(nodes, activeScoid);
  const isAudio = isAudioMaterial(course, activeNodeText);
  const isYoutube =
    displayedContent?.videoProvider === 'youtube' &&
    !!displayedContent.embedVideoUrl;
  const effectiveFontScale = fontScale ?? fontScaleQuery.data?.scale ?? 1;
  const palette = useMemo(
    () => paletteFor(preferences.accentColor, isDark),
    [preferences.accentColor, isDark],
  );

  const readLive = useCallback((): LivePlaybackReading => {
    const media = youtubeRef.current ?? playerRef.current;

    if (media === null) {
      return {};
    }

    return {
      positionSeconds: media.getCurrentTime(),
      mediaDurationSeconds: media.getDuration(),
    };
  }, []);
  const timer = useStudyTimer(cid, readLive);
  const download = useMaterialDownload();
  const frameCapture = useFrameCapture();

  // Latest values for callbacks that outlive a render (unmount, AppState).
  const latest = useRef({
    activeNode,
    activeNodeText,
    courseTitle,
    timer,
    checkpoint: async (): Promise<void> => undefined,
  });

  /** Crash-recovery checkpoint (replaces the legacy native session context). */
  const checkpoint = useCallback(async () => {
    const { activeNode: node, timer: currentTimer } = latest.current;
    const session = currentTimer.session;

    if (node?.href == null || session.startedAt === null) {
      return;
    }

    const live = readLive();

    if (live.positionSeconds !== undefined && live.positionSeconds > 0) {
      session.updatePlaybackPosition(live.positionSeconds);
    }

    if (live.mediaDurationSeconds !== undefined) {
      session.updateMediaDuration(live.mediaDurationSeconds);
    }

    playbackRef.current.lastCheckpointAt = Date.now();
    await writeActiveMaterialSession(services.storage.keyValues, {
      accountId: await services.storage.activeProfile.get(),
      routePath: materialRoutePath(cid, node.identifier),
      cid,
      activityId: node.identifier,
      href: node.href,
      startedAt: session.startedAt,
      lastActiveAt: new Date().toISOString(),
      positionSeconds: session.lastKnownPlaybackPosition,
      mediaDurationSeconds: session.lastKnownMediaDuration,
      wasPlaying: playbackRef.current.playing,
      materialName: latest.current.activeNodeText,
      courseName: latest.current.courseTitle,
    });
  }, [cid, readLive, services]);

  useEffect(() => {
    latest.current = {
      activeNode,
      activeNodeText,
      courseTitle,
      timer,
      checkpoint,
    };
  });

  /** Reports the visit of `node` (legacy `saveStudyTimeWithRetry`). */
  const saveStudyTime = useCallback(
    async (node: CourseMaterialNode | null): Promise<void> => {
      if (node?.href == null) {
        return;
      }

      await checkpoint();
      const ok = await latest.current.timer.sendStudyTime(
        node.identifier,
        node.href,
      );

      playerRef.current?.stop();

      if (ok) {
        await clearActiveMaterialSession(services.storage.keyValues);
        void queryClient.invalidateQueries({
          queryKey: ['courses', cid],
          refetchType: 'none',
        });
      }
    },
    [checkpoint, cid, queryClient, services],
  );

  const ensureCellularPlaybackAllowed = useCallback(async () => {
    if (!preferences.cellularPlaybackWarningEnabled) {
      return true;
    }

    if (!(await isOnCellularNetwork())) {
      return true;
    }

    setCellularOpen(true);

    return new Promise<boolean>((resolve) => {
      cellularResolveRef.current = resolve;
    });
  }, [preferences.cellularPlaybackWarningEnabled]);

  const resolveCellularPrompt = async (
    allowed: boolean,
    dontAskAgain: boolean,
  ) => {
    setCellularOpen(false);

    if (dontAskAgain) {
      try {
        await runtime.updatePreferences({
          cellularPlaybackWarningEnabled: false,
        });
      } catch {
        // The user is simply asked again next time.
      }
    }

    cellularResolveRef.current?.(allowed);
    cellularResolveRef.current = null;
  };

  const checkPlaybackProgress = useCallback(
    async (identifier: string) => {
      setResume(null);

      try {
        const { progress } = await services.course.getPlaybackProgress(
          cid,
          identifier,
        );
        const position = Number(progress?.positionSeconds ?? 0);

        if (
          !Number.isNaN(position) &&
          position >= MIN_RESUME_POSITION_SECONDS
        ) {
          setResume({
            position,
            label: formatDurationLabel(position),
          });
        }
      } catch {
        setResume(null);
      }
    },
    [cid, services],
  );

  // Once the node's content (and path) arrived: cellular check, then start
  // timing and offer to resume (legacy loadNodeData + startTracking).
  const contentData = content.data;
  const pathSettled = path.isFetched;

  useEffect(() => {
    if (
      contentData === undefined ||
      !pathSettled ||
      readyScoid === activeScoid
    ) {
      return;
    }

    let cancelled = false;
    const media = hasPlayableMedia(contentData);

    void (async () => {
      const allowed = media ? await ensureCellularPlaybackAllowed() : true;

      if (cancelled) {
        return;
      }

      if (!allowed) {
        leftRef.current = true;
        router.replace(`/courses/${encodeURIComponent(cid)}`);

        return;
      }

      setReadyScoid(activeScoid);
      latest.current.timer.startTracking(!!activeHref);

      if (activeHref !== null) {
        void checkpoint();

        if (media && !immersiveRef.current) {
          void checkPlaybackProgress(activeScoid);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeHref,
    activeScoid,
    checkPlaybackProgress,
    checkpoint,
    cid,
    contentData,
    ensureCellularPlaybackAllowed,
    pathSettled,
    readyScoid,
  ]);

  // HUNGU cookies must be in the WebView store before the HTML loads.
  const baseUrl = displayedContent?.baseUrl ?? null;

  useEffect(() => {
    if (baseUrl === null) {
      return;
    }

    let cancelled = false;

    void seedHunguWebViewCookies(services, baseUrl).then(() => {
      if (!cancelled) {
        setCookiesReadyFor(baseUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, services]);

  // App going to the background: checkpoint (the durable "beacon").
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void checkpoint();
      }
    });

    return () => subscription.remove();
  }, [checkpoint]);

  // Leaving without the back button (swipe back, replaced route): report
  // in the background like the legacy page-hide beacon. Runs from
  // `beforeRemove` (player still mounted, so the live position is readable)
  // and, as a fallback, from the unmount cleanup; `leftRef` makes it once.
  const keyValues = services.storage.keyValues;
  const navigation = useNavigation();

  const reportLeaveInBackground = useCallback(() => {
    const {
      activeNode: node,
      timer: currentTimer,
      checkpoint: writeCheckpoint,
    } = latest.current;

    currentTimer.stopTimer();

    if (leftRef.current || node?.href == null) {
      return;
    }

    leftRef.current = true;

    const href = node.href;

    void (async () => {
      await writeCheckpoint();

      if (await currentTimer.sendStudyTime(node.identifier, href)) {
        await clearActiveMaterialSession(keyValues);
        // The course screen underneath is still mounted: refetch now so the
        // directory shows the new progress.
        void queryClient.invalidateQueries({ queryKey: ['courses', cid] });
      }
    })();
  }, [cid, keyValues, queryClient]);

  useEffect(
    () =>
      // expo-router types the route-less navigation object without it.
      (navigation as unknown as BeforeRemoveSource).addListener(
        'beforeRemove',
        reportLeaveInBackground,
      ),
    [navigation, reportLeaveInBackground],
  );

  useEffect(() => reportLeaveInBackground, [reportLeaveInBackground]);

  const handleBack = useCallback(async () => {
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      await saveStudyTime(latest.current.activeNode);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }

    timer.stopTimer();
    leftRef.current = true;

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/courses/${encodeURIComponent(cid)}`);
    }
  }, [cid, saveStudyTime, timer]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (playerRef.current?.exitFullscreen()) {
          return true;
        }

        void handleBack();

        return true;
      },
    );

    return () => subscription.remove();
  }, [handleBack]);

  const handleNodeSelect = useCallback(
    async (identifier: string) => {
      if (identifier === activeScoid || savingRef.current) {
        return;
      }

      const previousNode = latest.current.activeNode;

      if (previousNode?.href) {
        savingRef.current = true;
        setIsSaving(true);

        try {
          await saveStudyTime(previousNode);
        } finally {
          savingRef.current = false;
          setIsSaving(false);
        }

        // The tablet sidebar shows the durations.
        void queryClient.invalidateQueries({
          queryKey: courseKeys.learningTimes(cid),
        });
      }

      timer.stopTimer();
      playbackRef.current.playing = false;
      setResume(null);
      setSubpage(null);
      setReloadError(null);
      setCaptureError(null);
      setReadyScoid(null);
      finishedScoidRef.current = null;
      setActiveScoid(identifier);
      router.setParams({ scoid: identifier });
    },
    [activeScoid, cid, queryClient, saveStudyTime, timer],
  );

  /** 沉浸式播放: on to the next material, or finish after the last one. */
  const advanceImmersive = useCallback(() => {
    if (!immersiveRef.current || savingRef.current) {
      return;
    }

    if (next) {
      void handleNodeSelect(next.identifier);
    } else {
      setImmersiveRequested(false);
      useToastStore.getState().show('沉浸式播放已結束');
    }
  }, [handleNodeSelect, next]);
  const advanceImmersiveRef = useRef(advanceImmersive);

  useEffect(() => {
    immersiveRef.current = immersive;
    advanceImmersiveRef.current = advanceImmersive;
  });

  const handleMediaEnded = useCallback(() => {
    // Both the player and the embed progress can report the end.
    if (
      !immersiveRef.current ||
      finishedScoidRef.current === latest.current.activeNode?.identifier
    ) {
      return;
    }

    finishedScoidRef.current = latest.current.activeNode?.identifier ?? null;
    advanceImmersiveRef.current();
  }, []);

  const handleImmersiveChange = (enabled: boolean) => {
    if (enabled && !isSubscribed) {
      router.push('/courses/account/subscription');

      return;
    }

    setImmersiveRequested(enabled);

    if (enabled) {
      setResume(null);
    }
  };

  const handleProgress = useCallback(
    (progress: PlaybackProgress) => {
      lastPositionRef.current = progress.currentTime;
      timer.updatePlaybackPosition(progress.currentTime);
      timer.updateMediaDuration(progress.duration);

      const wasPlaying = playbackRef.current.playing;

      playbackRef.current.playing = progress.playing;

      if (
        wasPlaying !== progress.playing ||
        Date.now() - playbackRef.current.lastCheckpointAt >
          CHECKPOINT_INTERVAL_MS
      ) {
        void checkpoint();
      }
    },
    [checkpoint, timer],
  );

  const handleYoutubeProgress = useCallback(
    (currentTime: number, duration: number) => {
      handleProgress({
        currentTime,
        duration,
        rate: 1,
        playing: currentTime > 0,
      });

      // The embed has no ended event: finishing is reported as progress.
      if (hasReachedEnd(currentTime, duration)) {
        handleMediaEnded();
      }
    },
    [handleMediaEnded, handleProgress],
  );

  const openExternal = useCallback(async (url: string) => {
    const tronclass = tronclassAppUrl(url);

    if (tronclass !== null) {
      try {
        if (await Linking.canOpenURL(tronclass)) {
          await Linking.openURL(tronclass);

          return;
        }
      } catch {
        // Fall through to the in-app browser.
      }
    }

    if (/^https?:/i.test(url)) {
      openInAppBrowser(url);
    } else if (/^(mailto|tel):/i.test(url)) {
      void openExternalUrl(url);
    }
  }, []);

  const handleContentLink = useCallback(
    async (href: string) => {
      const action = resolveContentLink(nodes, activeScoid, activeHref, href);

      if (action.kind === 'select') {
        await handleNodeSelect(action.identifier);

        return;
      }

      if (action.kind === 'reload') {
        setSubpage(null);
        void content.refetch();

        return;
      }

      if (action.kind === 'subpage') {
        setIsSubpageLoading(true);

        try {
          const parsed = await runtime.run('material.parsed', () =>
            services.course.getParsedMaterialContent(action.url),
          );

          setSubpage({ scoid: activeScoid, content: parsed });
        } catch {
          await openExternal(action.url);
        } finally {
          setIsSubpageLoading(false);
        }

        return;
      }

      await openExternal(action.url);
    },
    [
      activeHref,
      activeScoid,
      content,
      handleNodeSelect,
      nodes,
      openExternal,
      runtime,
      services,
    ],
  );

  const handleReload = useCallback(async () => {
    if (isReloading) {
      return;
    }

    setIsReloading(true);
    setReloadError(null);
    const urlBefore = displayedContent?.videoUrl ?? null;

    try {
      const [contentResult] = await Promise.all([
        content.refetch(),
        resources.refetch(),
      ]);

      setSubpage(null);

      if (contentResult.isError) {
        setReloadError('重新載入失敗，請稍後再試。');
      }

      // A changed URL remounts the player (keyed by URL).
      if (
        contentResult.data?.videoUrl === urlBefore &&
        urlBefore !== null &&
        !isYoutube
      ) {
        await playerRef.current?.reload();
      }
    } catch (error) {
      setReloadError(
        error instanceof Error && error.message
          ? error.message
          : '重新載入失敗，請稍後再試。',
      );
    } finally {
      setIsReloading(false);
    }
  }, [content, displayedContent, isReloading, isYoutube, resources]);

  const handleCaptureFrame = useCallback(async () => {
    if (isCapturingFrame) {
      return;
    }

    setIsCapturingFrame(true);
    setCaptureError(null);

    try {
      const accounts = await runtime.run('accounts.list', () =>
        services.account.list(),
      );
      const studentId = accounts.find((account) => account.isActive)?.username;

      if (!studentId) {
        setCaptureError('找不到目前的帳號，無法產生截圖。');

        return;
      }

      const frame = await playerRef.current?.captureFrame();

      if (!frame) {
        setCaptureError('目前沒有可擷取的影片畫面');

        return;
      }

      await frameCapture.capture({
        thumbnail: frame.thumbnail,
        seconds: frame.seconds,
        studentId,
        courseName: courseTitle,
        materialName: activeNodeText,
      });
    } catch (error) {
      setCaptureError(
        asServiceError(error)?.message ??
          (error instanceof Error && error.message
            ? error.message
            : '截圖失敗，請稍後再試。'),
      );
    } finally {
      setIsCapturingFrame(false);
    }
  }, [
    activeNodeText,
    courseTitle,
    frameCapture,
    isCapturingFrame,
    runtime,
    services,
  ]);

  const handleFontScaleChange = useCallback(
    async (requested: number) => {
      const nextScale = clampFontScale(requested);

      if (Math.abs(nextScale - effectiveFontScale) < Number.EPSILON) {
        return;
      }

      setFontScale(nextScale);
      setIsSavingFontScale(true);

      try {
        const saved = await services.materialPreference.setFontScale(nextScale);

        queryClient.setQueryData(materialKeys.fontScale, saved);
      } catch {
        // Keep the local scale; legacy only logged the failure.
      } finally {
        setIsSavingFontScale(false);
      }
    },
    [effectiveFontScale, queryClient, services],
  );

  const handleResume = () => {
    const position = resume?.position;

    setResume(null);

    if (position !== undefined && position > 0) {
      (youtubeRef.current ?? playerRef.current)?.seekTo(position);
    }
  };

  const isContentLoading =
    content.isPending ||
    isSubpageLoading ||
    (contentData !== undefined && readyScoid !== activeScoid);
  const contentError = content.error ?? resources.error;
  const isReady = readyScoid === activeScoid && displayedContent !== undefined;
  const showPlayer =
    isReady && hasPlayableMedia(displayedContent) && courses.isFetched;

  const hasMedia = hasPlayableMedia(displayedContent);
  const isIdleMaterial = isReady
    ? !hasMedia
    : !!contentError && displayedContent === undefined;
  const countingDown = immersive && isIdleMaterial;

  // Materials without video / audio stay for a while, then move on.
  useEffect(() => {
    if (!countingDown) {
      return;
    }

    let remaining = IMMERSIVE_IDLE_SECONDS;

    const timerId = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        clearInterval(timerId);
        advanceImmersiveRef.current();

        return;
      }

      setIdleSecondsLeft(remaining);
    }, 1000);

    return () => {
      clearInterval(timerId);
      setIdleSecondsLeft(null);
    };
  }, [countingDown, activeScoid]);

  // Half-folded iPhone Duo in portrait (horizontal fold): the video fills the top half and
  // its seek bar and controls sit in the bottom half, where a thumb reaches.
  const foldedVideo =
    foldFrame !== null &&
    foldAxis === 'horizontal' &&
    showPlayer &&
    !isAudio &&
    !isYoutube;

  // Landscape with a vertical fold: directory and content become two panes either side of
  // the hinge instead of a sidebar that could cross it.
  const splitAroundFold =
    !foldedVideo &&
    foldFrame !== null &&
    foldAxis === 'vertical' &&
    width > height;

  // The seek bar sits where the interactive swipe-back would start, so while the folded
  // layout shows it the swipe is off; the header's back button still leaves the page.
  useEffect(() => {
    const source = navigation as unknown as BeforeRemoveSource;

    if (!foldedVideo) {
      return undefined;
    }

    source.setOptions?.({ gestureEnabled: false });

    return () => source.setOptions?.({ gestureEnabled: true });
  }, [foldedVideo, navigation]);

  const renderPlayer = (content: ParsedMaterialContent, fill: boolean) =>
    isYoutube ? (
      <YoutubeEmbed
        key={content.embedVideoUrl}
        ref={youtubeRef}
        embedUrl={content.embedVideoUrl as string}
        title={activeNodeText}
        onProgress={handleYoutubeProgress}
        onExternalLink={(url) => void openExternal(url)}
      />
    ) : (
      <MaterialPlayer
        key={content.videoUrl}
        ref={playerRef}
        videoUrl={content.videoUrl as string}
        isAudio={isAudio}
        title={activeNodeText}
        courseTitle={courseTitle}
        fill={fill}
        getStartAt={fill ? () => lastPositionRef.current : undefined}
        onProgress={(progress) => {
          handleProgress(progress);

          if (fill) {
            setPlayback(progress);
          }
        }}
        onEnded={handleMediaEnded}
      />
    );

  const playerSection = showPlayer ? (
    <View className="bg-theme-100 px-3 pb-2 pt-3 dark:bg-zinc-950">
      {displayedContent ? renderPlayer(displayedContent, false) : null}
    </View>
  ) : (
    <View />
  );

  const detailBlocks = (
    <View className="gap-4 px-3 pt-2">
      {isContentLoading && !isReady ? (
        <MaterialSkeleton />
      ) : contentError && displayedContent === undefined ? (
        <ErrorRetry
          error={contentError}
          retrying={content.isFetching}
          onRetry={() => {
            void content.refetch();
            void resources.refetch();
          }}
        />
      ) : displayedContent !== undefined ? (
        <MaterialViewer
          content={displayedContent}
          resources={resources.data ?? []}
          cookiesReady={
            displayedContent.baseUrl !== null &&
            cookiesReadyFor === displayedContent.baseUrl
          }
          fontScale={effectiveFontScale}
          isSavingFontScale={isSavingFontScale}
          isDark={isDark}
          palette={palette}
          canOpenInAppBrowser={activeHref !== null}
          isReloading={isReloading}
          reloadError={reloadError}
          showVideoTools={showPlayer && !isAudio && !isYoutube}
          videoRate={videoRate}
          isCapturingFrame={isCapturingFrame}
          captureError={captureError}
          isDownloading={download.isDownloading}
          downloadProgress={download.progress}
          downloadError={download.error}
          onOpenInAppBrowser={() => {
            if (activeHref !== null) {
              openInAppBrowser(activeHref);
            }
          }}
          onReload={() => void handleReload()}
          onCaptureFrame={() => void handleCaptureFrame()}
          onVideoRateChange={(rate) => playerRef.current?.setRate(rate)}
          onDownload={() => {
            if (displayedContent.downloadUrl) {
              void download.download({
                cid,
                url: displayedContent.downloadUrl,
                descriptor: displayedContent.download,
                fileName: buildDownloadFileName({
                  downloadFileName: displayedContent.downloadFileName,
                  downloadFileExtension: displayedContent.downloadFileExtension,
                  isPdf: displayedContent.isPdf,
                  title: activeNodeText,
                }),
              });
            }
          }}
          onFontScaleChange={(scale) => void handleFontScaleChange(scale)}
          onLinkPress={(href) => void handleContentLink(href)}
          onImagePress={(src, alt) =>
            setLightbox({
              src,
              alt,
              baseUrl: displayedContent.baseUrl ?? src,
            })
          }
        />
      ) : null}

      {!isContentLoading && (previous || next) ? (
        <View className="flex-row gap-3">
          <AdjacentButton
            node={previous}
            direction="previous"
            onPress={() => {
              if (previous) {
                void handleNodeSelect(previous.identifier);
              }
            }}
          />
          <AdjacentButton
            node={next}
            direction="next"
            onPress={() => {
              if (next) {
                void handleNodeSelect(next.identifier);
              }
            }}
          />
        </View>
      ) : null}

      {!isTablet && !splitAroundFold ? (
        <Pressable
          testID="material-switch-button"
          accessibilityRole="button"
          onPress={() => setDirectoryOpen(true)}
          className="items-center rounded-2xl border border-theme-200 bg-white p-3 active:bg-theme-50 dark:border-zinc-700 dark:bg-zinc-900 dark:active:bg-zinc-800"
        >
          <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
            切換教材
          </Text>
        </Pressable>
      ) : null}

      <View className="rounded-2xl border border-theme-200 bg-white/90 px-4 dark:border-zinc-700 dark:bg-zinc-900">
        <ToggleSwitch
          label="沉浸式播放"
          labelAccessory={isSubscribed ? null : <PremiumBadge />}
          value={immersive}
          onValueChange={handleImmersiveChange}
        />
      </View>
    </View>
  );

  const contentScroll = (
    <ScrollView
      stickyHeaderIndices={[0]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {playerSection}
      {detailBlocks}
    </ScrollView>
  );

  return (
    <Screen testID="material-screen" ignoreTopInset ignoreBottomInset>
      <PageHeader
        title={courseTitle}
        subtitle={activeNodeText || '檢視教材'}
        onBack={() => void handleBack()}
        isLoading={
          path.isPending ||
          isContentLoading ||
          (course === null && courses.isPending)
        }
        right={
          activeHref ? (
            <View
              accessible
              accessibilityLabel={`學習計時 ${formatStudyClock(timer.viewingSeconds)}`}
              className="flex-row items-center gap-2 rounded-full bg-theme-100 px-3 py-1 dark:bg-zinc-700"
            >
              <MaterialIcon
                name="clock"
                size={16}
                className="text-theme-800 dark:text-zinc-200"
              />
              {/* NativeWind drops `tabular-nums` (font-variant-numeric). */}
              <Text
                style={{ fontVariant: ['tabular-nums'] }}
                className="text-xs font-medium text-theme-800 dark:text-zinc-200"
              >
                {formatStudyClock(timer.viewingSeconds)}
              </Text>
            </View>
          ) : null
        }
      />

      {foldedVideo ? (
        <FoldSplit
          first={
            <View className="flex-1 bg-black">
              {displayedContent ? renderPlayer(displayedContent, true) : null}
            </View>
          }
          second={
            <View className="flex-1">
              <ScrollView
                contentContainerStyle={{ paddingBottom: 24, paddingTop: 12 }}
              >
                {detailBlocks}
              </ScrollView>
              <VideoControlBar
                playing={playback?.playing ?? false}
                currentTime={playback?.currentTime ?? 0}
                duration={playback?.duration ?? 0}
                rate={playback?.rate ?? videoRate}
                onTogglePlay={() => playerRef.current?.togglePlay()}
                onSkip={(delta) =>
                  playerRef.current?.seekTo(
                    (playerRef.current?.getCurrentTime() ?? 0) + delta,
                  )
                }
                onSeek={(seconds) => playerRef.current?.seekTo(seconds)}
                onRateChange={(rate) => playerRef.current?.setRate(rate)}
              />
            </View>
          }
        />
      ) : splitAroundFold ? (
        <FoldSplit
          first={
            <View
              testID="material-sidebar"
              className="my-3 ml-3 flex-1 overflow-hidden rounded-2xl border border-theme-200 bg-white/85 dark:border-zinc-700 dark:bg-zinc-900/85"
            >
              <MaterialDirectory
                selectedCid={cid}
                scrollTarget="active"
                nodes={learningTimes.data ?? []}
                isLoading={learningTimes.isPending}
                activeNodeIdentifier={activeScoid}
                lastSeenIdentifier={lastSeen.data?.activityId ?? null}
                lastSeenPositionSeconds={lastSeen.data?.positionSeconds}
                lastSeenDurationSeconds={lastSeen.data?.mediaDurationSeconds}
                onNodeSelect={(identifier) => void handleNodeSelect(identifier)}
              />
            </View>
          }
          second={contentScroll}
        />
      ) : isTablet ? (
        <View className="flex-1 flex-row">
          <View
            testID="material-sidebar"
            className="my-3 ml-3 overflow-hidden rounded-2xl border border-theme-200 bg-white/85 dark:border-zinc-700 dark:bg-zinc-900/85"
            style={{ width: width >= 1280 ? 352 : 320 }}
          >
            <MaterialDirectory
              selectedCid={cid}
              scrollTarget="active"
              nodes={learningTimes.data ?? []}
              isLoading={learningTimes.isPending}
              activeNodeIdentifier={activeScoid}
              lastSeenIdentifier={lastSeen.data?.activityId ?? null}
              lastSeenPositionSeconds={lastSeen.data?.positionSeconds}
              lastSeenDurationSeconds={lastSeen.data?.mediaDurationSeconds}
              onNodeSelect={(identifier) => void handleNodeSelect(identifier)}
            />
          </View>
          <View className="min-w-0 flex-1">{contentScroll}</View>
        </View>
      ) : (
        contentScroll
      )}

      <MaterialDirectorySheet
        visible={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        selectedCid={cid}
        nodes={learningTimes.data ?? []}
        isLoading={learningTimes.isPending}
        activeNodeIdentifier={activeScoid}
        lastSeenIdentifier={lastSeen.data?.activityId ?? null}
        lastSeenPositionSeconds={lastSeen.data?.positionSeconds}
        lastSeenDurationSeconds={lastSeen.data?.mediaDurationSeconds}
        onNodeSelect={(identifier) => void handleNodeSelect(identifier)}
      />
      {frameCapture.composer}
      <SavingProgressToast visible={isSaving} />
      <ImmersiveCountdownToast
        secondsLeft={
          countingDown ? (idleSecondsLeft ?? IMMERSIVE_IDLE_SECONDS) : null
        }
        hasNext={next !== null}
        onSkip={() => advanceImmersive()}
        onStop={() => setImmersiveRequested(false)}
      />
      <ResumePrompt
        label={resume?.label ?? null}
        onResume={handleResume}
        onRestart={() => setResume(null)}
      />
      <CellularPrompt
        visible={cellularOpen}
        onResolve={(allowed, dontAskAgain) =>
          void resolveCellularPrompt(allowed, dontAskAgain)
        }
      />
      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </Screen>
  );
}
