<script setup lang="ts">
import { VideoCameraIcon } from '@heroicons/vue/24/outline';
import { computed, onMounted, ref } from 'vue';
import { Browser } from '#nativephp';
import ErrorRetry from '@/components/ErrorRetry.vue';
import LiveSessionNicknameModalDialog from '@/components/LiveSessionNicknameModalDialog.vue';
import type { ApiError } from '@/lib/apiError';
import { useAccountsStore } from '@/stores/accounts';
import { useAppConfigStore } from '@/stores/appConfig';
import type { NouToolsLiveSessionItem } from '@/types';

type SessionStatus = 'upcoming' | 'ongoing' | 'ended';
type DisplayTimezone = 'taiwan' | 'local';

type FlattenedLiveSession = {
    id: string;
    accountId: number | null;
    accountLabel: string;
    courseId: string;
    courseName: string;
    className: string | null;
    classCode: string | null;
    typeLabel: string | null;
    teacherName: string | null;
    link: string | null;
    backupClassroomUrl: string | null;
    date: string;
    startTime: string;
    endTime: string;
    startAt: Date | null;
    endAt: Date | null;
    status: SessionStatus;
};

const props = defineProps<{
    liveSessions: NouToolsLiveSessionItem[];
    isLoading: boolean;
    error: string | null;
    errorDetail?: ApiError | null;
    hasMultipleAccounts: boolean;
    showAllAccounts: boolean;
}>();

const emit = defineEmits<{
    'update:showAllAccounts': [value: boolean];
    retry: [];
}>();

const accountScopeOptions = [
    { value: false, label: '目前帳號' },
    { value: true, label: '所有帳號' },
] as const;

function toDate(date: string, time: string): Date | null {
    const normalizedTime = time.includes('+') ? time : `${time}+08:00`;
    const parsed = new Date(`${date}T${normalizedTime}`);

    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
}

const taiwanTimeZone = 'Asia/Taipei';

const displayTimezone = ref<DisplayTimezone>('taiwan');
const isSavingTimezonePreference = ref(false);

const accountsStore = useAccountsStore();
const appConfigStore = useAppConfigStore();

const nicknameModalEnabled = ref<boolean>(true);
const isNicknameModalOpen = ref(false);
const pendingClassroomUrl = ref<string | null>(null);
const pendingNickname = ref('');
const pendingEmail = ref('');

const systemTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Etc/UTC';

const systemOffsetMinutes = -new Date().getTimezoneOffset();

const isSystemUtcPlus8 = computed(() => systemOffsetMinutes === 8 * 60);

const shouldShowTimezoneSelector = computed(() => !isSystemUtcPlus8.value);

const effectiveTimeZone = computed(() => {
    return displayTimezone.value === 'taiwan' ? taiwanTimeZone : systemTimeZone;
});

const timezoneOptions = [
    { value: 'taiwan', label: '台灣時區' },
    { value: 'local', label: '我的時區' },
] as const;

onMounted(async () => {
    await appConfigStore.loadPreferences();

    displayTimezone.value = appConfigStore.liveSessionsTimezone;
    nicknameModalEnabled.value = appConfigStore.liveSessionNicknameModalEnabled;

    await accountsStore.loadAccounts();
});

async function setDisplayTimezone(value: DisplayTimezone): Promise<void> {
    displayTimezone.value = value;
    isSavingTimezonePreference.value = true;

    try {
        await appConfigStore.updatePreferences({
            liveSessionsTimezone: value,
        });
    } finally {
        isSavingTimezonePreference.value = false;
    }
}

function formatUtcOffset(totalMinutes: number): string {
    const sign = totalMinutes >= 0 ? '+' : '-';
    const absoluteMinutes = Math.abs(totalMinutes);
    const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
    const minutes = String(absoluteMinutes % 60).padStart(2, '0');

    return `UTC${sign}${hours}:${minutes}`;
}

const detectedTimezoneLabel = computed(() => {
    return `${systemTimeZone} (${formatUtcOffset(systemOffsetMinutes)})`;
});

function formatMonthDay(date: Date | null, fallbackDate: string): string {
    if (!date || Number.isNaN(date.getTime())) {
        return fallbackDate;
    }

    return new Intl.DateTimeFormat('zh-TW', {
        timeZone: effectiveTimeZone.value,
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function formatWeekday(date: Date | null): string {
    if (!date || Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat('zh-TW', {
        timeZone: effectiveTimeZone.value,
        weekday: 'short',
    }).format(date);
}

function formatClock(
    date: Date | null,
    fallbackTime: string,
    fallbackDate: string,
): string {
    if (!date || Number.isNaN(date.getTime())) {
        return fallbackTime.slice(0, 5);
    }

    const shouldShowDate =
        displayTimezone.value === 'local' &&
        effectiveTimeZone.value !== taiwanTimeZone &&
        new Intl.DateTimeFormat('en-CA', {
            timeZone: effectiveTimeZone.value,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(date) !== fallbackDate;

    const timeLabel = new Intl.DateTimeFormat('zh-TW', {
        timeZone: effectiveTimeZone.value,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);

    if (!shouldShowDate) {
        return timeLabel;
    }

    const monthDayLabel = new Intl.DateTimeFormat('zh-TW', {
        timeZone: effectiveTimeZone.value,
        month: '2-digit',
        day: '2-digit',
    }).format(date);

    return `${monthDayLabel} ${timeLabel}`;
}

function getStatus(startAt: Date | null, endAt: Date | null): SessionStatus {
    if (!startAt || !endAt) {
        return 'upcoming';
    }

    const now = new Date();

    if (now < startAt) {
        return 'upcoming';
    }

    if (now > endAt) {
        return 'ended';
    }

    return 'ongoing';
}

function formatMonthLabel(date: Date | null, fallbackDate: string): string {
    if (!date || Number.isNaN(date.getTime())) {
        return fallbackDate;
    }

    return new Intl.DateTimeFormat('zh-TW', {
        timeZone: effectiveTimeZone.value,
        year: 'numeric',
        month: 'long',
    }).format(date);
}

function formatMonthKey(date: Date | null, fallbackDate: string): string {
    if (!date || Number.isNaN(date.getTime())) {
        return fallbackDate;
    }

    return new Intl.DateTimeFormat('en-CA', {
        timeZone: effectiveTimeZone.value,
        year: 'numeric',
        month: '2-digit',
    }).format(date);
}

type MonthBlock = {
    monthLabel: string;
    monthKey: string;
    sessions: FlattenedLiveSession[];
};

function groupByMonth(sessions: FlattenedLiveSession[]): MonthBlock[] {
    const groups = new Map<string, MonthBlock>();

    for (const session of sessions) {
        const monthKey = formatMonthKey(session.startAt, session.date);
        const monthLabel = formatMonthLabel(session.startAt, session.date);

        if (!groups.has(monthKey)) {
            groups.set(monthKey, {
                monthLabel,
                monthKey,
                sessions: [],
            });
        }

        groups.get(monthKey)!.sessions.push(session);
    }

    return Array.from(groups.values());
}

const flattenedSessions = computed<FlattenedLiveSession[]>(() => {
    return props.liveSessions
        .flatMap((session) => {
            return session.sessions.map((item) => {
                const startAt = toDate(item.date, item.startTime);
                const endAt = toDate(item.date, item.endTime);

                return {
                    id: `${session.accountId ?? 'NA'}-${session.courseId}-${session.classCode ?? 'NA'}-${item.date}-${item.startTime}`,
                    accountId: session.accountId,
                    accountLabel: session.accountLabel,
                    courseId: session.courseId,
                    courseName: session.courseName,
                    className: session.className,
                    classCode: session.classCode,
                    typeLabel: session.typeLabel,
                    teacherName: session.teacherName,
                    link: session.link,
                    backupClassroomUrl: session.backupClassroomUrl,
                    date: item.date,
                    startTime: item.startTime,
                    endTime: item.endTime,
                    startAt,
                    endAt,
                    status: getStatus(startAt, endAt),
                };
            });
        })
        .sort((left, right) => {
            const leftEnded = left.status === 'ended';
            const rightEnded = right.status === 'ended';

            // 已結束放到最末端
            if (leftEnded !== rightEnded) {
                return leftEnded ? 1 : -1;
            }

            if (left.startAt && right.startAt) {
                return left.startAt.getTime() - right.startAt.getTime();
            }

            return `${left.date}${left.startTime}`.localeCompare(
                `${right.date}${right.startTime}`,
            );
        });
});

const upcomingSessions = computed<FlattenedLiveSession[]>(() => {
    return flattenedSessions.value.filter(
        (session) => session.status !== 'ended',
    );
});

const endedSessions = computed<FlattenedLiveSession[]>(() => {
    return flattenedSessions.value.filter(
        (session) => session.status === 'ended',
    );
});

const groups = computed(() => [
    {
        label: '即將開始 / 進行中',
        emptyStateMessage: '目前沒有即將開始或進行中的視訊面授。',
        sessions: upcomingSessions.value,
        monthGroups: groupByMonth(upcomingSessions.value),
    },
    {
        label: '已結束',
        emptyStateMessage: '目前沒有已結束的視訊面授。',
        sessions: endedSessions.value,
        monthGroups: groupByMonth(endedSessions.value),
    },
]);

const openLink = async (url: string) => {
    try {
        const result = await Browser.open(url);

        if (!result) {
            // fallback
            window.open(url, '_blank', 'noopener');
        }
    } catch {
        // fallback
        window.open(url, '_blank', 'noopener');
    }
};

function resolveStudentIdentity(
    session: FlattenedLiveSession,
): { username: string; displayName: string } | null {
    const account = accountsStore.accounts.find(
        (candidate) => candidate.id === session.accountId,
    );

    if (account) {
        return { username: account.username, displayName: account.displayName };
    }

    if (appConfigStore.username && appConfigStore.displayName) {
        return {
            username: appConfigStore.username,
            displayName: appConfigStore.displayName,
        };
    }

    return null;
}

function handleClassroomLinkClick(url: string, session: FlattenedLiveSession) {
    if (!nicknameModalEnabled.value) {
        openLink(url);

        return;
    }

    pendingClassroomUrl.value = url;

    const identity = resolveStudentIdentity(session);
    pendingNickname.value = identity
        ? `${identity.username} ${identity.displayName}`
        : '';
    pendingEmail.value = identity
        ? `${identity.username}@webmail.nou.edu.tw`
        : '';
    isNicknameModalOpen.value = true;
}

function onNicknameModalEntered() {
    if (pendingClassroomUrl.value) {
        openLink(pendingClassroomUrl.value);
    }

    isNicknameModalOpen.value = false;
}
</script>

<template>
    <div class="space-y-4">
        <section v-if="hasMultipleAccounts" class="mx-auto max-w-lg">
            <h3 class="sr-only">顯示範圍</h3>
            <div
                class="flex rounded-xl border border-theme-200 bg-theme-50 p-1 dark:border-zinc-700 dark:bg-zinc-800"
            >
                <button
                    v-for="option in accountScopeOptions"
                    :key="String(option.value)"
                    type="button"
                    class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
                    :class="
                        showAllAccounts === option.value
                            ? 'bg-white text-theme-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                            : 'text-theme-700 hover:text-theme-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    "
                    @click="emit('update:showAllAccounts', option.value)"
                >
                    {{ option.label }}
                </button>
            </div>
        </section>

        <section
            v-if="shouldShowTimezoneSelector"
            class="mx-auto max-w-lg rounded-2xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
            <h3 class="text-sm font-semibold text-theme-900 dark:text-zinc-100">
                選擇顯示的時區
            </h3>
            <p
                class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
            >
                系統偵測到你的時區是
                {{ detectedTimezoneLabel }}，你可以選擇本頁顯示的時區。
            </p>
            <div
                class="mt-3 flex rounded-xl border border-theme-200 bg-theme-50 p-1 dark:border-zinc-700 dark:bg-zinc-800"
            >
                <button
                    v-for="option in timezoneOptions"
                    :key="option.value"
                    type="button"
                    class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
                    :class="
                        displayTimezone === option.value
                            ? 'bg-white text-theme-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                            : 'text-theme-700 hover:text-theme-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    "
                    :disabled="isSavingTimezonePreference"
                    @click="setDisplayTimezone(option.value)"
                >
                    {{ option.label }}
                </button>
            </div>
        </section>

        <div v-if="props.isLoading" class="space-y-4">
            <div
                class="rounded-2xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div
                    class="h-4 w-40 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                />
                <div
                    class="mt-3 h-3 w-48 animate-pulse rounded bg-theme-100 dark:bg-zinc-800"
                />
            </div>

            <div class="space-y-3">
                <div v-for="section in 2" :key="section" class="space-y-2">
                    <div
                        class="h-5 w-32 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                    />

                    <div
                        v-for="item in 3"
                        :key="item"
                        class="rounded-2xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                        <div class="flex items-center gap-3">
                            <div
                                class="h-16 w-16 animate-pulse rounded-lg bg-theme-100 dark:bg-zinc-800"
                            />
                            <div class="min-w-0 flex-1 space-y-2">
                                <div
                                    class="h-4 w-3/4 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                                />
                                <div
                                    class="h-3 w-1/2 animate-pulse rounded bg-theme-100 dark:bg-zinc-800"
                                />
                                <div
                                    class="h-3 w-1/3 animate-pulse rounded bg-theme-100 dark:bg-zinc-800"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <ErrorRetry
            v-else-if="props.error"
            :message="props.error"
            :retrying="props.isLoading"
            :detail="props.errorDetail"
            @retry="emit('retry')"
        />

        <div
            v-else-if="flattenedSessions.length === 0"
            class="rounded-2xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
        >
            目前沒有可顯示的視訊面授班級資訊。
        </div>

        <template v-else>
            <section
                class="space-y-3"
                v-for="group in groups"
                :key="group.label"
            >
                <header
                    class="rounded-2xl border border-theme-200 bg-theme-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <h3
                        class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        {{ group.label }}
                    </h3>
                </header>

                <div
                    v-if="group.sessions.length === 0"
                    class="rounded-2xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                >
                    {{ group.emptyStateMessage }}
                </div>

                <template v-else>
                    <div
                        v-for="monthGroup in group.monthGroups"
                        :key="monthGroup.monthKey"
                        class="space-y-2"
                    >
                        <div
                            class="px-1 py-1 text-xs font-bold text-theme-700 dark:text-zinc-200"
                        >
                            {{ monthGroup.monthLabel }}
                        </div>

                        <div
                            class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                        >
                            <article
                                v-for="session in monthGroup.sessions"
                                :key="session.id"
                                class="rounded-2xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                            >
                                <div
                                    class="flex items-start justify-between gap-3"
                                >
                                    <div
                                        class="flex min-w-0 flex-1 items-center gap-3"
                                    >
                                        <div
                                            class="flex w-20 shrink-0 flex-col items-center gap-1"
                                        >
                                            <span
                                                v-if="
                                                    hasMultipleAccounts &&
                                                    showAllAccounts &&
                                                    session.accountLabel
                                                "
                                                class="inline-block max-w-full truncate rounded-full bg-theme-100 px-2 py-0.5 text-[10px] font-medium text-theme-800 dark:bg-zinc-800 dark:text-zinc-400"
                                            >
                                                {{ session.accountLabel }}
                                            </span>
                                            <div
                                                class="flex w-full flex-col items-center justify-center rounded-lg bg-theme-100 px-2 py-2 text-center dark:bg-zinc-800"
                                            >
                                                <p
                                                    class="text-lg font-bold text-theme-700 dark:text-zinc-200"
                                                >
                                                    {{
                                                        formatMonthDay(
                                                            session.startAt,
                                                            session.date,
                                                        )
                                                    }}
                                                </p>
                                                <p
                                                    class="mt-0.5 text-base text-theme-700 dark:text-zinc-400"
                                                >
                                                    {{
                                                        formatWeekday(
                                                            session.startAt,
                                                        )
                                                    }}
                                                </p>
                                            </div>
                                        </div>

                                        <div class="min-w-0 flex-1">
                                            <div
                                                class="flex items-start justify-between gap-2"
                                            >
                                                <div class="min-w-0 flex-1">
                                                    <h4
                                                        class="line-clamp-1 text-sm font-semibold text-theme-900 dark:text-zinc-100"
                                                    >
                                                        {{ session.courseName }}
                                                    </h4>
                                                </div>

                                                <span
                                                    v-if="
                                                        session.status !==
                                                        'upcoming'
                                                    "
                                                    :class="[
                                                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                                        session.status ===
                                                        'ongoing'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
                                                    ]"
                                                >
                                                    {{
                                                        session.status ===
                                                        'ongoing'
                                                            ? '進行中'
                                                            : '已結束'
                                                    }}
                                                </span>
                                            </div>
                                            <div
                                                class="flex flex-wrap items-end justify-between gap-y-2"
                                            >
                                                <div
                                                    class="flex shrink-0 flex-col gap-1"
                                                >
                                                    <p
                                                        class="text-xs text-theme-700 dark:text-zinc-400"
                                                    >
                                                        {{
                                                            session.className ||
                                                            '未提供班級名稱'
                                                        }}
                                                        ・
                                                        {{
                                                            session.typeLabel ||
                                                            '未知班別'
                                                        }}
                                                    </p>
                                                    <p
                                                        class="text-xs text-theme-700 dark:text-zinc-400"
                                                    >
                                                        <template
                                                            v-if="
                                                                session.teacherName?.endsWith(
                                                                    '老師',
                                                                )
                                                            "
                                                        >
                                                            {{
                                                                session.teacherName.replace(
                                                                    /老師$/,
                                                                    '',
                                                                )
                                                            }}
                                                            <small class="ml-.5"
                                                                >老師</small
                                                            >
                                                        </template>
                                                        <template v-else>
                                                            {{
                                                                session.teacherName ||
                                                                '未提供'
                                                            }}
                                                        </template>
                                                    </p>
                                                    <p
                                                        class="mt-1 text-sm font-medium text-theme-800 dark:text-zinc-200"
                                                    >
                                                        {{
                                                            formatClock(
                                                                session.startAt,
                                                                session.startTime,
                                                                session.date,
                                                            )
                                                        }}
                                                        -
                                                        {{
                                                            formatClock(
                                                                session.endAt,
                                                                session.endTime,
                                                                session.date,
                                                            )
                                                        }}
                                                    </p>
                                                </div>
                                                <div
                                                    class="flex shrink-0 flex-col items-end gap-1"
                                                >
                                                    <a
                                                        v-if="session.link"
                                                        @click.prevent="
                                                            handleClassroomLinkClick(
                                                                session.link,
                                                                session,
                                                            )
                                                        "
                                                        :href="session.link"
                                                        class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-theme-300 px-3 py-1.5 text-base font-medium text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                                    >
                                                        <VideoCameraIcon
                                                            class="size-5"
                                                        />
                                                        進入教室
                                                    </a>
                                                    <a
                                                        v-if="
                                                            session.backupClassroomUrl
                                                        "
                                                        @click.prevent="
                                                            handleClassroomLinkClick(
                                                                session.backupClassroomUrl!,
                                                                session,
                                                            )
                                                        "
                                                        :href="
                                                            session.backupClassroomUrl
                                                        "
                                                        title="主教室人數已滿時可改用此備用連結"
                                                        class="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium text-theme-700 transition hover:text-theme-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                                                    >
                                                        備用教室
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>
                </template>
            </section>
        </template>

        <LiveSessionNicknameModalDialog
            :is-open="isNicknameModalOpen"
            :nickname="pendingNickname"
            :url="pendingClassroomUrl ?? ''"
            :email="pendingEmail"
            @close="isNicknameModalOpen = false"
            @entered="onNicknameModalEntered"
        />
    </div>
</template>
