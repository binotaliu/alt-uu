import './generated.d.ts';

// Course ViewModels
export type CourseItemViewModel =
    AltUU.Domains.Course.ViewModels.CourseItemViewModel;
export type CourseTasksCount =
    AltUU.Domains.Course.ViewModels.CourseTasksCountViewModel;
export type MaterialNode =
    AltUU.Domains.Course.ViewModels.CourseMaterialNodeViewModel;
export type MaterialResource =
    AltUU.Domains.Course.ViewModels.CourseMaterialResourceViewModel;
export type CoursePathInfo =
    AltUU.Domains.Course.ViewModels.CoursePathInfoViewModel;
export type CourseLearningTimeItem =
    AltUU.Domains.Course.ViewModels.CourseLearningTimeItemViewModel;
export type CourseHomeworkItem =
    AltUU.Domains.Course.ViewModels.CourseHomeworkItemViewModel;
export type CourseHomeworkList =
    AltUU.Domains.Course.ViewModels.CourseHomeworkListViewModel;
export type CourseSelfExamItem =
    AltUU.Domains.Course.ViewModels.CourseHomeworkItemViewModel;
export type CourseSchoolPortalInfo =
    AltUU.Domains.Course.ViewModels.CourseSchoolPortalInfoViewModel;

// School Portal ViewModels
export type SchoolPortalGrade =
    AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalGradeViewModel;
export type SchoolPortalHomeworkNotice =
    AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalHomeworkNoticeViewModel;
export type SchoolPortalClassSessionInfo =
    AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalClassSessionInfoViewModel;
export type SchoolPortalExamInfo =
    AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalExamInfoViewModel;
export type SchoolPortalExamSchedule =
    AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalExamScheduleViewModel;
export type SchoolPortalExamScope =
    AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalExamScopeViewModel;
export type SchoolPortalExamAgendaItem =
    AltUU.Domains.SchoolPortal.ViewModels.SchoolPortalExamAgendaItemViewModel;

export type CourseItem = CourseItemViewModel & {
    pendingHomeworks?: number;
    unreadArticles?: number;
};

// Discuss ViewModels
export type DiscussBoard = AltUU.Domains.Discuss.ViewModels.BoardViewModel;
export type DiscussNode = AltUU.Domains.Discuss.ViewModels.NodeViewModel;
export type DiscussPost = AltUU.Domains.Discuss.ViewModels.PostViewModel;
export type DiscussWhisper = AltUU.Domains.Discuss.ViewModels.WhisperViewModel;
export type BoardListViewModel =
    AltUU.Domains.Discuss.ViewModels.BoardListViewModel;
export type NodeListViewModel =
    AltUU.Domains.Discuss.ViewModels.NodeListViewModel;
export type PostListViewModel =
    AltUU.Domains.Discuss.ViewModels.PostListViewModel;

// StudyTime ViewModels
export type StudyTimeResult =
    AltUU.Domains.StudyTime.ViewModels.StudyTimeResultViewModel;

// Subscription ViewModels
export type SubscriptionEntitlement =
    AltUU.Domains.Subscription.ViewModels.EntitlementViewModel;
export type SubscriptionProduct =
    AltUU.Domains.Subscription.ViewModels.ProductViewModel;

// Account ViewModels
export type AccountProfile = AltUU.Domains.Account.ViewModels.AccountViewModel;

// Activity ViewModels
export type ActivityDay =
    AltUU.Domains.Activity.ViewModels.ActivityDayViewModel;
export type ActivityHeatmap =
    AltUU.Domains.Activity.ViewModels.ActivityHeatmapViewModel;

// DataPortability ViewModels/DTOs
export type DataExport =
    AltUU.Domains.DataPortability.ViewModels.DataExportViewModel;
export type DataImportResult =
    AltUU.Domains.DataPortability.ViewModels.DataImportResultViewModel;
export type PlaybackProgressImportItem =
    AltUU.Domains.DataPortability.DataTransferObjects.PlaybackProgressImportItemData;
export type AccountDailyActivityImportItem =
    AltUU.Domains.DataPortability.DataTransferObjects.AccountDailyActivityImportItemData;
export type ImportDataInput =
    AltUU.Domains.DataPortability.DataTransferObjects.ImportDataInputData;

// Composite/frontend-only types
export interface ParsedContent {
    videoUrl: string | null;
    subtitleUrl: string | null;
    downloadUrl: string | null;
    downloadProxyUrl: string | null;
    downloadFileName: string | null;
    downloadFileExtension: string | null;
    isPdf: boolean;
    htmlContent: string | null;
    videoProvider: 'native' | 'youtube';
    embedVideoUrl: string | null;
}

export interface CoursePathData {
    pathInfo: CoursePathInfo;
    materialNodes: MaterialNode[];
}

export interface DiscussData {
    courses: DiscussCourse[];
    selectedCid: string;
    boards: DiscussBoard[];
    selectedBid: string;
    nodes: DiscussNode[];
    selectedNid: string;
    posts: DiscussPost[];
}

export interface DiscussCourse {
    courseId: string;
    title: string;
}

export interface DiscussBoardSection {
    courseId: string;
    title: string;
    boards: DiscussBoard[];
}

export interface StudyTimePayload {
    cid: string;
    activityId: string;
    url: string;
    seconds: number;
    startedAt: string | null;
    positionSeconds?: number;
    mediaDurationSeconds?: number;
}

export interface NouToolsClassSession {
    date: string;
    startTime: string;
    endTime: string;
}

export interface NouToolsLiveSessionItem {
    accountId: number | null;
    accountLabel: string;
    courseId: string;
    courseName: string;
    semester: string | null;
    className: string | null;
    classCode: string | null;
    type: string | null;
    typeLabel: string | null;
    teacherName: string | null;
    link: string | null;
    backupClassroomUrl: string | null;
    startTime: string | null;
    endTime: string | null;
    sessions: NouToolsClassSession[];
}

export interface NouToolsSchoolCalendarEvent {
    name: string;
    startDate: string;
    endDate: string;
    isCountdown: boolean;
}

export interface NouToolsPreviousExam {
    term: string;
    midtermReferencePrimary: string | null;
    midtermReferenceSecondary: string | null;
    finalReferencePrimary: string | null;
    finalReferenceSecondary: string | null;
}

export interface NouToolsTextbook {
    bookTitle: string;
    edition: string | null;
    priceInfo: string | null;
    referenceUrl: string | null;
}

export interface NouToolsCourseInfo {
    courseId: string;
    courseName: string;
    className: string | null;
    nouToolsCourseId: number | null;
    descriptionUrl: string | null;
    creditType: string | null;
    credits: number | null;
    department: string | null;
    nature: string | null;
    midtermDate: string | null;
    finalDate: string | null;
    examTimeStart: string | null;
    examTimeEnd: string | null;
    textbook: NouToolsTextbook | null;
    previousExams: NouToolsPreviousExam[];
}
