import { and, between, eq, sql } from 'drizzle-orm';
import type {
    AccountActiveProfile,
    AccountCredentialsStore,
} from '../../accounts';
import { accountDailyActivities } from '../../db/schema';
import type { AltUUDatabase } from '../../db/types';
import type { Clock } from '../../platform';
import { taipeiDateString } from '../study-time/taipeiTime';

const RANGE_MONTHS = 6;

/** Legacy ActivityDayViewModel. */
export interface ActivityDay {
    date: string;
    seconds: number;
}

/** Legacy ActivityHeatmapViewModel. */
export interface ActivityHeatmap {
    days: ActivityDay[];
    currentStreak: number;
    longestStreak: number;
    longestStudyDayDate: string | null;
    longestStudyDaySeconds: number;
    hasMultipleAccounts: boolean;
}

export interface ActivityServicesDeps {
    db: AltUUDatabase;
    activeProfile: AccountActiveProfile;
    credentials: Pick<AccountCredentialsStore, 'all'>;
    clock: Clock;
}

/** GetActivityHeatmap: the last six months of study seconds per Taipei day. */
export function createActivityServices(deps: ActivityServicesDeps) {
    async function fetchSecondsByDate(
        accountId: number | null,
        rangeStart: string,
        rangeEnd: string,
    ): Promise<Map<string, number>> {
        const inRange = between(
            accountDailyActivities.activityDate,
            rangeStart,
            rangeEnd,
        );
        const rows = await deps.db
            .select({
                date: accountDailyActivities.activityDate,
                seconds: sql<number>`sum(${accountDailyActivities.totalSeconds})`,
            })
            .from(accountDailyActivities)
            .where(
                accountId === null
                    ? inRange
                    : and(
                          inRange,
                          eq(accountDailyActivities.accountId, accountId),
                      ),
            )
            .groupBy(accountDailyActivities.activityDate);

        return new Map(rows.map((row) => [row.date, Number(row.seconds)]));
    }

    return {
        async getHeatmap(
            options: { allAccounts?: boolean } = {},
        ): Promise<ActivityHeatmap> {
            const accountId = await deps.activeProfile.get();
            const today = taipeiDateString(deps.clock.now());
            const rangeStart = addDays(subtractMonths(today, RANGE_MONTHS), 1);
            const hasMultipleAccounts =
                (await deps.credentials.all()).length > 1;
            const useAllAccounts =
                (options.allAccounts ?? false) && hasMultipleAccounts;
            const secondsByDate =
                !useAllAccounts && accountId === null
                    ? new Map<string, number>()
                    : await fetchSecondsByDate(
                          useAllAccounts ? null : accountId,
                          rangeStart,
                          today,
                      );

            const days: ActivityDay[] = [];

            for (
                let date = rangeStart;
                date <= today;
                date = addDays(date, 1)
            ) {
                days.push({ date, seconds: secondsByDate.get(date) ?? 0 });
            }

            const longestStudyDay = findLongestStudyDay(days);

            return {
                days,
                currentStreak: calculateCurrentStreak(days),
                longestStreak: calculateLongestStreak(days),
                longestStudyDayDate: longestStudyDay?.date ?? null,
                longestStudyDaySeconds: longestStudyDay?.seconds ?? 0,
                hasMultipleAccounts,
            };
        },
    };
}

export type ActivityServices = ReturnType<typeof createActivityServices>;

/** Today may be empty without breaking the streak. */
function calculateCurrentStreak(days: ActivityDay[]): number {
    const lastIndex = days.length - 1;

    if (lastIndex < 0) {
        return 0;
    }

    const startIndex = days[lastIndex].seconds > 0 ? lastIndex : lastIndex - 1;
    let streak = 0;

    for (let index = startIndex; index >= 0; index -= 1) {
        if (days[index].seconds <= 0) {
            break;
        }

        streak += 1;
    }

    return streak;
}

function calculateLongestStreak(days: ActivityDay[]): number {
    let longest = 0;
    let current = 0;

    for (const day of days) {
        if (day.seconds > 0) {
            current += 1;
            longest = Math.max(longest, current);
        } else {
            current = 0;
        }
    }

    return longest;
}

/** First day with the most seconds; null when nothing was studied. */
function findLongestStudyDay(days: ActivityDay[]): ActivityDay | null {
    let longest: ActivityDay | null = null;

    for (const day of days) {
        if (longest === null || day.seconds > longest.seconds) {
            longest = day;
        }
    }

    return longest !== null && longest.seconds > 0 ? longest : null;
}

function addDays(date: string, count: number): string {
    const shifted = new Date(`${date}T00:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + count);

    return shifted.toISOString().slice(0, 10);
}

/** Carbon 3 `subMonths` without overflow: Mar 31 minus one month is Feb 28. */
function subtractMonths(date: string, months: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1 - months, 1));
    const lastDay = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));

    return target.toISOString().slice(0, 10);
}
