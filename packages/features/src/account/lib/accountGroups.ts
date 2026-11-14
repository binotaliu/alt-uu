export interface AccountGroup<T> {
  /** `null` for rows that carry no account (the active-account request). */
  accountId: number | null;
  label: string;
  items: T[];
}

/** Splits rows of an all-accounts request per account, in first-seen order. */
export function groupByAccount<
  T extends { accountId?: number; accountLabel?: string },
>(items: readonly T[]): AccountGroup<T>[] {
  const groups = new Map<number | null, AccountGroup<T>>();

  for (const item of items) {
    const accountId = item.accountId ?? null;
    const group = groups.get(accountId) ?? {
      accountId,
      label: item.accountLabel ?? '',
      items: [],
    };

    group.items.push(item);
    groups.set(accountId, group);
  }

  return [...groups.values()];
}
