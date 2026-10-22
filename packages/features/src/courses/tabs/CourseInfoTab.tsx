import type {
  CourseSchoolPortalInfo,
  NouToolsCourseInfo,
  SchoolPortalClassSessionInfo,
  SchoolPortalExamInfo,
} from '@altuu/core';
import { Text } from '@altuu/ui';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useAppPreferences } from '../../services/hooks';
import type { ServiceError } from '../../services/serviceError';
import { ErrorRetry } from '../../shell/ErrorRetry';
import { openInAppBrowser } from '../../shell/openUrl';
import { ExamScopeEntries } from '../components/ExamScopeEntries';
import { Card, EmptyNotice } from '../components/primitives';
import {
  useCourseSchoolPortalInfo,
  useNouToolsCourseInfo,
} from '../courseQueries';
import {
  formatSchoolPortalClassDates,
  formatSchoolPortalTimeRange,
} from '../format';

const PREVIOUS_EXAM_BASE_URL =
  'https://noustud.nou.edu.tw/shared_tmp/work/exa/refans/';

type NouToolsCourse = NonNullable<NouToolsCourseInfo['course']>;

interface PreviousExam {
  term: string;
  midtermReferencePrimary: string | null;
  midtermReferenceSecondary: string | null;
  finalReferencePrimary: string | null;
  finalReferenceSecondary: string | null;
}

interface Textbook {
  bookTitle?: string;
  edition?: string | null;
  priceInfo?: string | null;
  referenceUrl?: string | null;
}

function formatExamTime(
  start: string | null,
  end: string | null,
): string | null {
  if (!start && !end) {
    return null;
  }

  return start && end ? `${start} - ${end}` : (start ?? end);
}

export function examLinks(
  exam: PreviousExam,
): Array<{ key: string; label: string; href: string }> {
  const candidates: Array<[string, string, string | null]> = [
    ['midterm-a', '期中正參', exam.midtermReferencePrimary],
    ['midterm-b', '期中副參', exam.midtermReferenceSecondary],
    ['final-a', '期末正參', exam.finalReferencePrimary],
    ['final-b', '期末副參', exam.finalReferenceSecondary],
  ];

  return candidates.flatMap(([key, label, href]) =>
    href ? [{ key, label, href }] : [],
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
        {title}
      </Text>
      <View className="mt-3 gap-3">{children}</View>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <View>
      <Text className="text-sm text-theme-700 dark:text-zinc-400">{label}</Text>
      <Text className="text-sm font-medium text-theme-800 dark:text-zinc-200">
        {value}
      </Text>
    </View>
  );
}

function LinkChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      className="rounded-lg border border-theme-300 px-2.5 py-1 active:bg-theme-50 dark:border-zinc-600 dark:active:bg-zinc-800"
    >
      <Text className="text-xs font-medium text-theme-700 dark:text-zinc-200">
        {label}
      </Text>
    </Pressable>
  );
}

function NouToolsSections({ course }: { course: NouToolsCourse }) {
  const textbook = course.textbook as Textbook | null;
  const previousExams = course.previousExams as unknown as PreviousExam[];

  return (
    <>
      <Section title="基本資訊">
        <Field label="學分型態" value={course.creditType || '未提供'} />
        <Field label="學分數" value={course.credits ?? '未提供'} />
        <Field label="開設學系" value={course.department || '未提供'} />
        <Field label="課程性質" value={course.nature || '未提供'} />
        <Field label="期中考日期" value={course.midtermDate || '未提供'} />
        <Field label="期末考日期" value={course.finalDate || '未提供'} />
        <Field
          label="考試時間"
          value={
            formatExamTime(course.examTimeStart, course.examTimeEnd) || '未提供'
          }
        />
      </Section>

      {textbook ? (
        <Section title="教材資訊">
          <Text className="text-sm font-medium text-theme-800 dark:text-zinc-200">
            {textbook.bookTitle}
          </Text>
          {textbook.edition ? (
            <Text className="text-sm text-theme-800 dark:text-zinc-200">
              版本：{textbook.edition}
            </Text>
          ) : null}
          {textbook.priceInfo ? (
            <Text className="text-sm text-theme-800 dark:text-zinc-200">
              價格：{textbook.priceInfo}
            </Text>
          ) : null}
          {textbook.referenceUrl ? (
            <View className="flex-row">
              <LinkChip
                label="參考連結"
                onPress={() =>
                  openInAppBrowser(textbook.referenceUrl as string)
                }
              />
            </View>
          ) : null}
        </Section>
      ) : null}

      <Section title="考古題">
        {previousExams.length === 0 ? (
          <View className="items-center rounded-xl border border-dashed border-theme-300 bg-theme-50 px-4 py-6 dark:border-zinc-600 dark:bg-zinc-800">
            <Text className="text-sm font-semibold text-theme-800 dark:text-zinc-200">
              本課程無考古題
            </Text>
            <Text className="mt-1 text-center text-sm text-theme-700 dark:text-zinc-400">
              可能的原因：本課程是新開課程，或本課程為全遠距微學分課程。
            </Text>
          </View>
        ) : (
          previousExams.map((exam) => (
            <View
              key={exam.term}
              className="rounded-lg border border-theme-200 p-3 dark:border-zinc-700"
            >
              <Text className="text-sm font-semibold text-theme-800 dark:text-zinc-200">
                {exam.term}
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {examLinks(exam).map((link) => (
                  <LinkChip
                    key={`${exam.term}-${link.key}`}
                    label={link.label}
                    onPress={() =>
                      openInAppBrowser(`${PREVIOUS_EXAM_BASE_URL}${link.href}`)
                    }
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </Section>
    </>
  );
}

function ClassSessionSection({ info }: { info: SchoolPortalClassSessionInfo }) {
  return (
    <Section title="上課資訊">
      {info.teacher ? <Field label="授課教師" value={info.teacher} /> : null}
      {info.classType ? (
        <Field label="班級類型" value={info.classType} />
      ) : null}
      {info.classTime ? (
        <Field
          label="上課時間"
          value={formatSchoolPortalTimeRange(info.classTime) ?? info.classTime}
        />
      ) : null}
      {info.classCode ? (
        <Field label="授課班級代碼" value={info.classCode} />
      ) : null}
      {info.classDates ? (
        <View>
          <Text className="text-sm text-theme-700 dark:text-zinc-400">
            授課日期
          </Text>
          {formatSchoolPortalClassDates(info.classDates).map((entry, index) => (
            <Text
              key={index}
              className="text-sm font-medium text-theme-800 dark:text-zinc-200"
            >
              {entry}
            </Text>
          ))}
        </View>
      ) : null}
    </Section>
  );
}

function ExamInfoSections({ info }: { info: SchoolPortalExamInfo }) {
  return (
    <>
      {info.schedules.length > 0 ? (
        <Section title="考試時間">
          {info.schedules.map((schedule) => (
            <View
              key={schedule.category}
              className="rounded-lg border border-theme-200 p-3 dark:border-zinc-700"
            >
              <Text className="text-sm font-semibold text-theme-800 dark:text-zinc-200">
                {schedule.category}
              </Text>
              <View className="mt-1 gap-1">
                {schedule.date ? (
                  <Text className="text-sm text-theme-700 dark:text-zinc-300">
                    日期：{schedule.date}
                  </Text>
                ) : null}
                {schedule.time ? (
                  <Text className="text-sm text-theme-700 dark:text-zinc-300">
                    時間：
                    {formatSchoolPortalTimeRange(schedule.time)}
                  </Text>
                ) : null}
                {schedule.room ? (
                  <Text className="text-sm text-theme-700 dark:text-zinc-300">
                    教室代號：{schedule.room}
                  </Text>
                ) : null}
                {schedule.note ? (
                  <Text className="text-sm text-theme-700 dark:text-zinc-300">
                    {schedule.note}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {info.scopes.length > 0 ? (
        <Section title="考試命題範圍">
          {info.scopes.map((scope) => (
            <View
              key={scope.category}
              className="rounded-lg border border-theme-200 p-3 dark:border-zinc-700"
            >
              <Text className="text-sm font-semibold text-theme-800 dark:text-zinc-200">
                {scope.category}
              </Text>
              <ExamScopeEntries scopes={scope.scope ? [scope.scope] : []} />
            </View>
          ))}
        </Section>
      ) : null}
    </>
  );
}

export interface CourseInfoViewProps {
  nouToolsEnabled: boolean;
  course: NouToolsCourse | null;
  isLoading: boolean;
  error: ServiceError | null;
  retrying?: boolean;
  portalInfo: CourseSchoolPortalInfo | null;
  onRetry: () => void;
}

/** Presentational body of the 課程資訊 tab. */
export function CourseInfoView({
  nouToolsEnabled,
  course,
  isLoading,
  error,
  retrying,
  portalInfo,
  onRetry,
}: CourseInfoViewProps) {
  if (isLoading) {
    return (
      <Card>
        <Text className="text-sm text-theme-700 dark:text-zinc-300">
          載入課程資訊中...
        </Text>
      </Card>
    );
  }

  if (nouToolsEnabled && error) {
    return <ErrorRetry error={error} onRetry={onRetry} retrying={retrying} />;
  }

  const classSessionInfo = portalInfo?.classSessionInfo ?? null;
  const examInfo = portalInfo?.examInfo ?? null;
  const hasSchoolPortalInfo =
    classSessionInfo !== null ||
    (examInfo !== null &&
      (examInfo.schedules.length > 0 || examInfo.scopes.length > 0));

  return (
    <View className="gap-4">
      {!nouToolsEnabled ? (
        <EmptyNotice>
          開啟「NOU 小幫手整合」可以檢視更完整的課程資訊，請至「設定」頁面開啟。
        </EmptyNotice>
      ) : null}
      {course ? <NouToolsSections course={course} /> : null}
      {classSessionInfo ? (
        <ClassSessionSection info={classSessionInfo} />
      ) : null}
      {examInfo ? <ExamInfoSections info={examInfo} /> : null}
      {!course && !hasSchoolPortalInfo ? (
        <EmptyNotice>
          NOU 小幫手與教務系統目前都沒有這門課的可用資訊。
        </EmptyNotice>
      ) : null}
    </View>
  );
}

/**
 * 課程資訊: NOU Tools course info (the service already returns nothing when
 * the integration is off) plus the school portal's class and exam info.
 */
export function CourseInfoTab({ cid }: { cid: string }) {
  const nouToolsEnabled = useAppPreferences().nouToolsIntegrationEnabled;
  const nouTools = useNouToolsCourseInfo(cid, true);
  const portal = useCourseSchoolPortalInfo(cid, true);

  return (
    <CourseInfoView
      nouToolsEnabled={nouToolsEnabled}
      course={nouTools.data?.course ?? null}
      isLoading={nouTools.isPending || portal.isPending}
      error={nouTools.error}
      retrying={nouTools.isFetching}
      portalInfo={portal.data ?? null}
      onRetry={() => {
        void nouTools.refetch();
        void portal.refetch();
      }}
    />
  );
}
