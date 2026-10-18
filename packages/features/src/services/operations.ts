/**
 * Operation keys, ported from the legacy `lib/operations.ts` (plus keys for
 * calls legacy only told apart by URL, or not at all: account add / rename /
 * remove / reauth, data export, school portal grades / exam agenda / info). A key is passed
 * to `diagnostics.trackOperation` for every service call and yields the short
 * code shown next to error messages ("載入課程失敗 [CRS-U500]"), so a
 * screenshot alone says which part of the app failed.
 */

export interface Operation {
    /** Short uppercase code shown inline, e.g. CRS. */
    code: string;
    /** zh-TW description shown in the detail panel and the log viewer. */
    label: string;
}

export const OPERATIONS = {
    'courses.list': { code: 'CRS', label: '課程列表' },
    'courses.tasksCount': { code: 'CTC', label: '課程任務統計' },
    'courses.path': { code: 'CPTH', label: '教材目錄' },
    'courses.content': { code: 'MCNT', label: '教材內容' },
    'courses.resources': { code: 'MRES', label: '教材資源' },
    'courses.learningTimes': { code: 'CLT', label: '學習時數' },
    'courses.homeworks': { code: 'CHW', label: '作業' },
    'courses.selfExams': { code: 'CSE', label: '自我練習' },
    'courses.grade': { code: 'CGRD', label: '成績' },
    'courses.lastSeenMaterial': { code: 'CLSM', label: '最後觀看教材' },
    'courses.schoolPortalInfo': { code: 'CSPI', label: '課程校務資訊' },
    'schoolPortal.grades': { code: 'SPGR', label: '歷年成績' },
    'schoolPortal.examAgenda': { code: 'SPEX', label: '考試資訊' },
    'material.parsed': { code: 'MPRS', label: '教材解析' },
    'playback.progress': { code: 'PLAY', label: '播放進度' },
    'discuss.boards': { code: 'DBRD', label: '討論板' },
    'discuss.nodes': { code: 'DNOD', label: '討論主題' },
    'discuss.posts': { code: 'DPST', label: '討論文章' },
    'discuss.whispers': { code: 'DWSP', label: '悄悄話' },
    'discuss.read': { code: 'DRD', label: '討論已讀狀態' },
    'nouTools.liveSessions': { code: 'LIVE', label: '視訊面授' },
    'nouTools.schoolCalendar': { code: 'CAL', label: '學校行事曆' },
    'nouTools.courseInfo': { code: 'CINF', label: '課程資訊' },
    'accounts.list': { code: 'ACCT', label: '帳號列表' },
    'accounts.activity': { code: 'AACT', label: '學習活動' },
    'accounts.switch': { code: 'ASW', label: '切換帳號' },
    'accounts.add': { code: 'AADD', label: '新增帳號' },
    'accounts.rename': { code: 'ARNM', label: '修改帳號暱稱' },
    'accounts.remove': { code: 'ARMV', label: '移除帳號' },
    'accounts.reauth': { code: 'ARAU', label: '重新驗證帳號' },
    'auth.login': { code: 'LGIN', label: '登入' },
    'auth.logout': { code: 'LGUT', label: '登出' },
    'auth.profile': { code: 'PROF', label: '個人資料' },
    'auth.bootstrap': { code: 'BOOT', label: '啟動驗證' },
    'app.config': { code: 'CFG', label: 'App 設定' },
    'app.preferences': { code: 'PREF', label: '偏好設定' },
    'app.status': { code: 'STAT', label: '版本與公告' },
    'subscription.status': { code: 'SUBS', label: '訂閱狀態' },
    'subscription.products': { code: 'SPRD', label: '訂閱方案' },
    'subscription.purchase': { code: 'SBUY', label: '購買訂閱' },
    'subscription.restore': { code: 'SRST', label: '恢復購買' },
    'moderation.report': { code: 'MRPT', label: '檢舉內容' },
    'moderation.block': { code: 'MBLK', label: '封鎖使用者' },
    'moderation.sync': { code: 'MSYN', label: '同步封鎖清單' },
    'attachments.tasks': { code: 'ATT', label: '附件下載' },
    'dataExport.import': { code: 'IMPT', label: '資料匯入' },
    'dataExport.export': { code: 'EXPT', label: '資料匯出' },
    'studyTime.record': { code: 'STUD', label: '學習時數回報' },
    'diagnostics.connectivity': { code: 'DIAG', label: '連線診斷' },
    'diagnostics.log': { code: 'DLOG', label: '診斷記錄' },
    'diagnostics.material': { code: 'DMAT', label: '教材來源檢視' },
    unknown: { code: 'APP', label: '未知請求' },
} as const satisfies Record<string, Operation>;

export type OperationKey = keyof typeof OPERATIONS;

export function isOperationKey(value: string): value is OperationKey {
    return value in OPERATIONS;
}

export function operationFor(key: string): Operation {
    return isOperationKey(key) ? OPERATIONS[key] : OPERATIONS.unknown;
}
