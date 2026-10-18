import type {
  CourseMaterialResource,
  CoursePath,
  MaterialFontScalePreference,
  ParsedMaterialContent,
} from '@altuu/core';

import { useServiceQuery } from '../services/useServiceQuery';

/**
 * Query keys of the material page. They share the `['courses', …]` prefix
 * with the course area (whose `useCourses` list the page reads) so
 * invalidating a course refreshes both.
 */
export const materialKeys = {
  path: (cid: string) => ['courses', cid, 'path'] as const,
  content: (cid: string, scoid: string) =>
    ['courses', cid, 'content', scoid] as const,
  resources: (cid: string, scoid: string) =>
    ['courses', cid, 'resources', scoid] as const,
  fontScale: ['material', 'fontScale'] as const,
};

export function useMaterialCoursePath(cid: string) {
  return useServiceQuery<CoursePath>({
    op: 'courses.path',
    queryKey: materialKeys.path(cid),
    queryFn: (services) => services.course.getCoursePath(cid),
  });
}

/** Parsed content of a node; never served stale (signed media URLs expire). */
export function useMaterialContent(cid: string, scoid: string) {
  return useServiceQuery<ParsedMaterialContent>({
    op: 'courses.content',
    queryKey: materialKeys.content(cid, scoid),
    queryFn: (services) => services.course.getNodeContent(cid, scoid),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useMaterialResources(cid: string, scoid: string) {
  return useServiceQuery<CourseMaterialResource[]>({
    op: 'courses.resources',
    queryKey: materialKeys.resources(cid, scoid),
    queryFn: (services) => services.course.getNodeResources(cid, scoid),
    staleTime: 0,
  });
}

/** Failures keep the default scale (legacy). */
export function useMaterialFontScale() {
  return useServiceQuery<MaterialFontScalePreference>({
    op: 'app.preferences',
    queryKey: materialKeys.fontScale,
    queryFn: async (services) => {
      try {
        return await services.materialPreference.getFontScale();
      } catch {
        return { scale: 1 };
      }
    },
    staleTime: Infinity,
  });
}
