import { Text, Icon } from '@altuu/ui';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { RefreshControlProps } from 'react-native';

import { Skeleton } from './components/primitives';
import { formatClock } from './format';
import {
  buildDirectoryNodes,
  visibleDirectoryNodes,
  type DirectoryDisplayNode,
  type DirectorySourceNode,
} from './materialTree';

export interface MaterialDirectoryProps {
  selectedCid: string;
  nodes: readonly DirectorySourceNode[];
  isLoading?: boolean;
  activeNodeIdentifier?: string | null;
  lastSeenIdentifier?: string | null;
  lastSeenPositionSeconds?: number | null;
  lastSeenDurationSeconds?: number | null;
  /**
   * Called when a material row is pressed. Defaults to opening
   * `/courses/[cid]/[scoid]`.
   */
  onNodeSelect?: (identifier: string, href: string | null) => void;
  /** Layout classes for the root: `flex-1` to fill a sized parent, `shrink` to hug the content. */
  className?: string;
  refreshControl?: ReactElement<RefreshControlProps>;
}

function openMaterial(cid: string, identifier: string): void {
  router.push(
    `/courses/${encodeURIComponent(cid)}/${encodeURIComponent(identifier)}`,
  );
}

function lastSeenLabel(
  position: number | null | undefined,
  duration: number | null | undefined,
): string {
  if (position == null || duration == null || duration <= 0) {
    return '上次看到';
  }

  return `上次看到 ${formatClock(Math.min(position, duration))} / ${formatClock(duration)}`;
}

/** Every list row pads itself so a pinned folder's background covers the gap. */
const rowClassName = 'px-3 py-[5px]';

function nodeTitle(node: DirectoryDisplayNode): string {
  return node.text || node.identifier || '未命名節點';
}

/**
 * Collapsible material tree (legacy MaterialDirectory). It owns its scrolling
 * so folder rows can stick to the top of the list (`stickyHeaderIndices`),
 * the next folder pushing the previous one out like the legacy `sticky`.
 */
export function MaterialDirectory({
  selectedCid,
  nodes,
  isLoading = false,
  activeNodeIdentifier = null,
  lastSeenIdentifier = null,
  lastSeenPositionSeconds,
  lastSeenDurationSeconds,
  onNodeSelect,
  className = 'flex-1',
  refreshControl,
}: MaterialDirectoryProps) {
  const directoryNodes = useMemo(() => buildDirectoryNodes(nodes), [nodes]);
  const directoryIds = useMemo(
    () =>
      directoryNodes
        .filter((node) => node.isDirectory)
        .map((node) => node.internalId),
    [directoryNodes],
  );
  const activeAncestors = useMemo(() => {
    const active = directoryNodes.find(
      (node) =>
        node.targetIdentifier === activeNodeIdentifier &&
        !!node.href &&
        !node.itemDisabled,
    );

    return new Set(active?.ancestorDirectoryIds ?? []);
  }, [directoryNodes, activeNodeIdentifier]);
  const [collapsedRaw, setCollapsed] = useState<Set<string>>(new Set());

  // Drop stale ids and keep the active node's ancestors open.
  const collapsed = useMemo(() => {
    const valid = new Set(directoryIds);

    return new Set(
      [...collapsedRaw].filter(
        (id) => valid.has(id) && !activeAncestors.has(id),
      ),
    );
  }, [collapsedRaw, directoryIds, activeAncestors]);

  const visible = visibleDirectoryNodes(directoryNodes, collapsed);
  const allExpanded = collapsed.size === 0;
  const allCollapsed = directoryIds.length === collapsed.size;

  const toggle = (node: DirectoryDisplayNode) => {
    const next = new Set(collapsed);

    if (next.has(node.internalId)) {
      next.delete(node.internalId);
    } else {
      next.add(node.internalId);
    }

    setCollapsed(next);
  };

  const select = (node: DirectoryDisplayNode) => {
    if (onNodeSelect) {
      onNodeSelect(node.targetIdentifier, node.href);
    } else {
      openMaterial(selectedCid, node.targetIdentifier);
    }
  };

  const rows: ReactElement[] = [];
  const stickyIndices: number[] = [];

  if (isLoading) {
    [0, 1, 2, 3].forEach((row) =>
      rows.push(
        <View key={`skeleton-${row}`} className={rowClassName}>
          <Skeleton className="h-10 rounded-xl" />
        </View>,
      ),
    );
  } else if (directoryNodes.length === 0) {
    rows.push(
      <View key="empty" className={rowClassName}>
        <View className="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 dark:border-zinc-600 dark:bg-zinc-800">
          <Text className="text-sm text-theme-700 dark:text-zinc-300">
            此課程目前沒有教材目錄可顯示。
          </Text>
        </View>
      </View>,
    );
  }

  visible.forEach((node) => {
    const indent = node.level * 14;

    if (node.isDirectory) {
      const isCollapsed = collapsed.has(node.internalId);
      const inActivePath = activeAncestors.has(node.internalId);

      stickyIndices.push(rows.length);
      rows.push(
        // Opaque so rows scrolling underneath the pinned folder stay hidden.
        <View
          key={node.internalId}
          className={`${rowClassName} bg-white dark:bg-zinc-900`}
        >
          <Pressable
            testID="material-folder"
            accessibilityRole="button"
            accessibilityState={{ expanded: !isCollapsed }}
            onPress={() => toggle(node)}
            style={{ marginLeft: indent }}
            className={`min-h-10 flex-row items-center justify-between gap-2 rounded-2xl border bg-white px-4 dark:bg-zinc-900 ${
              inActivePath
                ? 'border-theme-700 dark:border-zinc-500'
                : 'border-theme-100 active:bg-theme-50 dark:border-zinc-700/70 dark:active:bg-zinc-800'
            }`}
          >
            <Text
              numberOfLines={2}
              className="min-w-0 flex-1 text-sm font-semibold text-theme-900 dark:text-zinc-100"
            >
              {nodeTitle(node)}
            </Text>
            <Icon
              name={isCollapsed ? 'chevron-right' : 'chevron-down'}
              size={16}
              className="text-theme-700 dark:text-zinc-400"
            />
          </Pressable>
        </View>,
      );

      return;
    }

    if (node.href && !node.itemDisabled) {
      const isActive = node.targetIdentifier === activeNodeIdentifier;
      const isLastSeen =
        !!lastSeenIdentifier && node.targetIdentifier === lastSeenIdentifier;

      rows.push(
        <View key={node.internalId} className={rowClassName}>
          <View style={{ marginLeft: indent }}>
            <Pressable
              testID="material-node"
              accessibilityRole="button"
              onPress={() => select(node)}
              className={`min-h-10 flex-row items-center justify-between gap-2 border px-4 py-2 ${
                isLastSeen && !isActive ? 'rounded-t-2xl' : 'rounded-2xl'
              } ${
                isActive
                  ? 'border-theme-700 bg-theme-100 dark:border-zinc-500 dark:bg-zinc-700'
                  : 'border-theme-200 bg-white active:bg-theme-50 dark:border-zinc-700/70 dark:bg-zinc-900 dark:active:bg-zinc-800'
              }`}
            >
              <Text
                numberOfLines={2}
                className={`min-w-0 flex-1 text-sm text-theme-700 dark:text-zinc-300 ${node.isSyntheticLink ? 'font-medium' : ''}`}
              >
                {nodeTitle(node)}
              </Text>
              <View
                className={`shrink-0 flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${
                  node.duration
                    ? 'bg-emerald-100 dark:bg-emerald-900'
                    : 'bg-slate-100 dark:bg-zinc-700'
                }`}
              >
                <Icon
                  name="clock"
                  size={14}
                  className={
                    node.duration
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-600 dark:text-zinc-300'
                  }
                />
                <Text
                  className={`text-xs ${
                    node.duration
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-600 dark:text-zinc-300'
                  }`}
                >
                  {node.duration ?? '未觀看'}
                </Text>
              </View>
            </Pressable>
            {isLastSeen && !isActive ? (
              <View className="rounded-b-2xl border border-t-0 border-sky-500 bg-sky-100 px-2 py-1.5 dark:bg-sky-900">
                <Text className="text-center text-xs text-sky-700 dark:text-sky-300">
                  {lastSeenLabel(
                    lastSeenPositionSeconds,
                    lastSeenDurationSeconds,
                  )}
                </Text>
              </View>
            ) : null}
          </View>
        </View>,
      );

      return;
    }

    rows.push(
      <View key={node.internalId} className={rowClassName}>
        <View style={{ marginLeft: 12 + indent }} className="py-2.5">
          <Text
            numberOfLines={1}
            className="text-base font-semibold text-theme-900 dark:text-zinc-100"
          >
            {nodeTitle(node)}
          </Text>
        </View>
      </View>,
    );
  });

  return (
    <View className={className}>
      <View className="flex-row items-center justify-between gap-3 border-b border-theme-200 bg-white px-4 pb-3 pt-3 dark:border-zinc-700/80 dark:bg-zinc-900">
        <View className="flex-row items-center gap-2">
          <Icon
            name="folder"
            size={18}
            className="text-theme-800 dark:text-zinc-200"
          />
          <Text className="text-sm font-semibold text-theme-800 dark:text-zinc-200">
            教材目錄
          </Text>
        </View>
        {directoryIds.length > 0 ? (
          <View className="flex-row items-center gap-1">
            <Pressable
              accessibilityRole="button"
              disabled={allExpanded}
              onPress={() => setCollapsed(new Set())}
              className={`rounded-full border border-theme-200 bg-white px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-900 ${allExpanded ? 'opacity-50' : ''}`}
            >
              <Text className="text-xs font-medium text-theme-700 dark:text-zinc-200">
                全部展開
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={allCollapsed}
              onPress={() => setCollapsed(new Set(directoryIds))}
              className={`rounded-full border border-theme-200 bg-white px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-900 ${allCollapsed ? 'opacity-50' : ''}`}
            >
              <Text className="text-xs font-medium text-theme-700 dark:text-zinc-200">
                全部收合
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView
        testID="material-directory-scroll"
        className="grow-0"
        contentContainerClassName="pb-3 pt-1"
        stickyHeaderIndices={stickyIndices}
        refreshControl={refreshControl}
      >
        {rows}
      </ScrollView>
    </View>
  );
}
