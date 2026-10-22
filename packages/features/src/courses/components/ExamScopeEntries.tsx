import { Text } from '@altuu/ui';
import { View } from 'react-native';

import { parseExamScope } from '../examScope';

/** Renders portal 命題範圍 strings as label / value rows. */
export function ExamScopeEntries({ scopes }: { scopes: string[] }) {
  return scopes.flatMap(parseExamScope).map((entry, index) => (
    <View key={index} className="mt-1">
      {entry.label ? (
        <Text className="text-xs font-medium text-theme-700 dark:text-zinc-400">
          {entry.label}
        </Text>
      ) : null}
      <Text className="text-sm text-theme-900 dark:text-zinc-200">
        {entry.value}
      </Text>
    </View>
  ));
}
