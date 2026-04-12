declare namespace AltUU {
    namespace Domains {
        namespace Auth {
            namespace DataTransferObjects {
                export type LoginInputData = {
                    username: string;
                    password: string;
                };
            }
        }
        namespace Course {
            namespace DataTransferObjects {
                export type MaterialContentInputData = {
                    url: string;
                };
            }
            namespace ViewModels {
                export type CourseHomeworkItemViewModel = {
                    title: string;
                    percent: string;
                    type: string;
                    status: string | null;
                    window: string | null;
                    actionUrl: string | null;
                    resultUrl: string | null;
                    source: string;
                };
                export type CourseItemViewModel = {
                    courseId: string;
                    commonCourseId: string | null;
                    semester: string | null;
                    name: string;
                    className: string | null;
                    courseType: string | null;
                };
                export type CourseLearningTimeItemViewModel = {
                    identifier: string;
                    href: string | null;
                    text: string;
                    level: number;
                    itemDisabled: boolean;
                    duration: string | null;
                };
                export type CourseMaterialNodeViewModel = {
                    identifier: string;
                    href: string | null;
                    text: string;
                    readed: boolean;
                    level: number;
                    leaf: boolean;
                    itemDisabled: boolean;
                };
                export type CourseMaterialResourceViewModel = {
                    downloadPath: string | null;
                    relativePath: string | null;
                    updateDatetime: number;
                    size: number;
                    metadata: string;
                    filename: string | null;
                    title: string | null;
                    href: string | null;
                };
                export type CoursePathInfoViewModel = {
                    code: number;
                    message: string;
                    courseId: string;
                    baseUrl: string | null;
                    progress: number;
                    pathText: string;
                };
                export type CourseTasksCountViewModel = {
                    courseId: string;
                    pendingHomeworks: number;
                    unreadArticles: number;
                };
            }
        }
        namespace Discuss {
            namespace ViewModels {
                export type AttachmentViewModel = {
                    filename: string | null;
                    href: string | null;
                };
                export type BoardListViewModel = {
                    courseId: string;
                    boards: AltUU.Domains.Discuss.ViewModels.BoardViewModel[];
                };
                export type BoardViewModel = {
                    boardId: string;
                    boardName: string;
                    allowPost: boolean;
                    hasNewPost: boolean;
                    subjectCount: number | null;
                };
                export type NodeListViewModel = {
                    courseId: string;
                    boardId: string;
                    nodes: AltUU.Domains.Discuss.ViewModels.NodeViewModel[];
                };
                export type NodeViewModel = {
                    node: string;
                    subject: string;
                    isRead: boolean;
                    poster: string | null;
                    repliesCount: number | null;
                    likesCount: number | null;
                    isBlocked: boolean;
                    blockedReason: string | null;
                };
                export type PostListViewModel = {
                    courseId: string;
                    boardId: string;
                    nodeId: string;
                    posts: AltUU.Domains.Discuss.ViewModels.PostViewModel[];
                };
                export type PostViewModel = {
                    floor: number;
                    node: string | null;
                    subject: string | null;
                    content: string | null;
                    poster: string | null;
                    realname: string | null;
                    postDate: string | null;
                    push: number;
                    liked: boolean;
                    whisperCount: number;
                    whispers: AltUU.Domains.Discuss.ViewModels.WhisperViewModel[];
                    attachments: AltUU.Domains.Discuss.ViewModels.AttachmentViewModel[];
                    isBlocked: boolean;
                    blockedReason: string | null;
                };
                export type WhisperViewModel = {
                    wid: string | null;
                    sid: string | null;
                    creator: string | null;
                    realname: string | null;
                    content: string | null;
                    createTime: string | null;
                    createTimeDescription: string | null;
                    canDelete: boolean | null;
                };
            }
        }
        namespace StudyTime {
            namespace DataTransferObjects {
                export type StudyTimeInputData = {
                    cid: string;
                    activityId: string;
                    url: string;
                    seconds: number | null;
                    startedAt: undefined | null;
                };
            }
            namespace ViewModels {
                export type StudyTimeResultViewModel = {
                    ok: boolean;
                    seconds: number;
                    message: string | null;
                };
            }
        }
    }
}
