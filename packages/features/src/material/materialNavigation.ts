import type { CourseItem, CourseMaterialNode } from '@altuu/core';

/** Saved positions below this are not offered for resuming (legacy). */
export const MIN_RESUME_POSITION_SECONDS = 3;

/** Route of a material page (legacy `activeMaterialRoutePath`). */
export function materialRoutePath(cid: string, scoid: string): string {
  return `/courses/${encodeURIComponent(cid)}/${encodeURIComponent(scoid)}`;
}

/** Leaf nodes with an href that are not disabled, in path order. */
export function navigableNodes(
  nodes: CourseMaterialNode[],
): CourseMaterialNode[] {
  return nodes.filter((node) => node.leaf && node.href && !node.itemDisabled);
}

export interface AdjacentMaterials {
  previous: CourseMaterialNode | null;
  next: CourseMaterialNode | null;
}

/** Previous / next navigable material around `identifier`. */
export function adjacentMaterials(
  nodes: CourseMaterialNode[],
  identifier: string,
): AdjacentMaterials {
  const navigable = navigableNodes(nodes);
  const index = navigable.findIndex((node) => node.identifier === identifier);

  return {
    previous: index > 0 ? (navigable[index - 1] ?? null) : null,
    next:
      index < 0 || index >= navigable.length - 1
        ? null
        : (navigable[index + 1] ?? null),
  };
}

/**
 * Legacy `isAudioCourse`: 語音 courses play audio, except recorded
 * face-to-face sessions (錄影 + 面授), which are video.
 */
export function isAudioMaterial(
  course: Pick<CourseItem, 'courseType'> | null,
  nodeText: string,
): boolean {
  if (course?.courseType !== '語音') {
    return false;
  }

  return !(nodeText.includes('錄影') && nodeText.includes('面授'));
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** The material node whose href is `href` (same host, path and query). */
export function findNodeForHref(
  nodes: CourseMaterialNode[],
  href: string,
): CourseMaterialNode | null {
  const target = parseUrl(href);

  if (target === null) {
    return null;
  }

  return (
    nodes.find((node) => {
      const nodeUrl = node.href ? parseUrl(node.href) : null;

      return (
        nodeUrl !== null &&
        nodeUrl.host === target.host &&
        nodeUrl.pathname === target.pathname &&
        nodeUrl.search === target.search
      );
    }) ?? null
  );
}

export function isSameHost(a: string, b: string): boolean {
  const first = parseUrl(a);
  const second = parseUrl(b);

  return first !== null && second !== null && first.host === second.host;
}

/** TronClass links open in the TronClass app when it is installed. */
export function tronclassAppUrl(href: string): string | null {
  if (
    href.startsWith('https://tronclass.nou.edu.tw/') ||
    href.startsWith('https://nou.tronclass.com.tw/')
  ) {
    return `tronclass://navigate?url=${encodeURIComponent(href)}`;
  }

  return null;
}

/**
 * What tapping a link inside material HTML does (legacy
 * `handleContentLinkClick`):
 * - `reload`: the link points at the current material (multi-page material),
 * - `select`: another material of the course,
 * - `subpage`: same host as the current material, rendered in place while
 *   the study timer keeps running,
 * - `external`: anything else (TronClass app, else in-app browser).
 */
export type ContentLinkAction =
  | { kind: 'reload' }
  | { kind: 'select'; identifier: string }
  | { kind: 'subpage'; url: string }
  | { kind: 'external'; url: string };

export function resolveContentLink(
  nodes: CourseMaterialNode[],
  activeIdentifier: string,
  activeHref: string | null,
  href: string,
): ContentLinkAction {
  const node = findNodeForHref(nodes, href);

  if (node !== null) {
    return node.identifier === activeIdentifier
      ? { kind: 'reload' }
      : { kind: 'select', identifier: node.identifier };
  }

  if (activeHref !== null && isSameHost(activeHref, href)) {
    return { kind: 'subpage', url: href };
  }

  return { kind: 'external', url: href };
}

/** Legacy `buildDownloadFilename`. */
export function buildDownloadFileName(options: {
  downloadFileName: string | null;
  downloadFileExtension: string | null;
  isPdf: boolean;
  title: string;
}): string {
  if (options.downloadFileName) {
    return options.downloadFileName;
  }

  const title = options.title.trim();
  const extension =
    options.downloadFileExtension ?? (options.isPdf ? 'pdf' : 'bin');

  if (title === '') {
    return `material.${extension}`;
  }

  const normalized = title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ');

  if (normalized.toLowerCase().endsWith(`.${extension}`)) {
    return normalized;
  }

  return `${normalized}.${extension}`;
}
