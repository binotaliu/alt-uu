import type { DiagnosticEventViewModel } from '@altuu/core';
import { Text } from '@altuu/ui';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

const MARKER: Record<DiagnosticEventViewModel['level'], string> = {
  error: '✗',
  warning: '!',
  info: '·',
};

const TONE: Record<DiagnosticEventViewModel['level'], string> = {
  error: 'text-rose-700 dark:text-rose-300',
  warning: 'text-amber-700 dark:text-amber-300',
  info: 'text-theme-700 dark:text-zinc-400',
};

export function formatEventTime(occurredAt: string): string {
  const parsed = new Date(occurredAt);

  if (Number.isNaN(parsed.getTime())) {
    return occurredAt;
  }

  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
}

/** Legacy DiagnosticEventRow: one log line, expandable to its context JSON. */
export function DiagnosticEventRow({
  event,
}: {
  event: DiagnosticEventViewModel;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasContext = Object.keys(event.context ?? {}).length > 0;

  return (
    <View className="border-b border-theme-200 py-2 dark:border-zinc-800">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled: !hasContext }}
        disabled={!hasContext}
        onPress={() => setExpanded((value) => !value)}
        className="flex-row items-start gap-2"
      >
        <Text className={`w-3 font-mono text-xs ${TONE[event.level]}`}>
          {MARKER[event.level]}
        </Text>
        <Text className="w-16 font-mono text-xs text-theme-700 dark:text-zinc-400">
          {formatEventTime(event.occurredAt)}
        </Text>
        <View className="min-w-0 flex-1">
          <Text className="text-xs text-theme-900 dark:text-zinc-100">
            {event.summary}
          </Text>
          <View className="mt-0.5 flex-row flex-wrap gap-x-2">
            <Text className="text-xs text-theme-700 dark:text-zinc-400">
              {event.typeLabel}
            </Text>
            {event.status !== null ? (
              <Text className="font-mono text-xs text-theme-700 dark:text-zinc-400">
                {`→ ${event.status}`}
              </Text>
            ) : null}
            {event.durationMs !== null ? (
              <Text className="font-mono text-xs text-theme-700 dark:text-zinc-400">
                {`${event.durationMs}ms`}
              </Text>
            ) : null}
            {event.op ? (
              <Text className="font-mono text-xs text-theme-700 dark:text-zinc-400">
                {event.op}
              </Text>
            ) : null}
            {event.requestId ? (
              <Text className="font-mono text-xs text-theme-700 dark:text-zinc-400">
                {`#${event.requestId}`}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      {expanded && hasContext ? (
        <Text
          selectable
          className="mt-2 rounded-lg bg-theme-100 p-2 font-mono text-[11px] text-theme-800 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {JSON.stringify(event.context, null, 2)}
        </Text>
      ) : null}
    </View>
  );
}
