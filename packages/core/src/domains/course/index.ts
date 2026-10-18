export * from './types';
export {
    createCourseServices,
    DEFAULT_HUNGU_BASE_URL,
    type CourseServices,
    type CourseServicesDeps,
} from './services';
export { clearCoursePathInfoCache } from './coursePath';
export { matchCourseType } from './listCourses';
export {
    createHunguMaterialContentClient,
    type HunguMaterialContentClientDeps,
} from './material/hunguMaterialContentClient';
export type { MaterialContentClient } from './material/parseMaterialContent';
export { cleanMaterialHtml } from './material/cleanMaterialHtml';
export {
    normalizeCourseName,
    normalizeTermCode,
} from './support/courseNameMatcher';
export { extractYoutubeVideoId } from './support/youtubeEmbedUrlParser';
export { decodeLegacyText } from './encoding/legacyText';
