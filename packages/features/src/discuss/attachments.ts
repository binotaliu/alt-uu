import { useServiceQuery } from '../services';

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
  'heic',
  'heif',
  'avif',
]);

function extractExtension(value: string): string | null {
  const withoutQuery = value.split(/[?#]/, 1)[0] ?? value;
  const match = /\.([a-z0-9]+)$/i.exec(withoutQuery);

  return match ? match[1].toLowerCase() : null;
}

/**
 * Legacy `isImageAttachment`: the filename's extension decides, falling back
 * to the URL path (attachments carry no MIME type).
 */
export function isImageAttachment(
  filename?: string | null,
  href?: string | null,
): boolean {
  const extension =
    (filename ? extractExtension(filename) : null) ??
    (href ? extractExtension(href) : null);

  return extension !== null && IMAGE_EXTENSIONS.has(extension);
}

/**
 * The request (URL + session headers) for an attachment, replacing the legacy
 * `/material-proxy/<b64>?cid=` URL. `cid` makes the session enter that course
 * first, like legacy.
 */
export function useAttachmentRequest(
  cid: string,
  href: string,
  enabled: boolean,
) {
  return useServiceQuery({
    op: 'attachments.tasks',
    queryKey: ['discuss', 'attachment-request', cid, href],
    queryFn: (services) => services.course.prepareMaterialFetch(href, { cid }),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
