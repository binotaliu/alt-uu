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
export type CourseSelfExamItem =
    AltUU.Domains.Course.ViewModels.CourseHomeworkItemViewModel;

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

// Composite/frontend-only types
export interface ParsedContent {
    videoUrl: string | null;
    subtitleUrl: string | null;
    pdfUrl: string | null;
    htmlContent: string | null;
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
}

export interface NouToolsClassSession {
    date: string;
    startTime: string;
    endTime: string;
}

export interface NouToolsLiveSessionItem {
    courseId: string;
    courseName: string;
    semester: string | null;
    className: string | null;
    classCode: string | null;
    type: string | null;
    typeLabel: string | null;
    teacherName: string | null;
    link: string | null;
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
