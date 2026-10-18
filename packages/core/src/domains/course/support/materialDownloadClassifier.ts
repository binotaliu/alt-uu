import { phpExtension, urlPath } from './phpUrl';

export interface DownloadClassification {
  extension: string;
  isPdf: boolean;
}

const BINARY_EXTENSIONS = [
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'apk',
  'ipa',
  'exe',
  'dmg',
];

const HTML_EXTENSIONS = ['html', 'htm'];

const MIME_EXTENSION_MAP: Array<[string, string]> = [
  ['application/zip', 'zip'],
  ['application/x-zip-compressed', 'zip'],
  ['application/vnd.rar', 'rar'],
  ['application/x-rar-compressed', 'rar'],
  ['application/x-7z-compressed', '7z'],
  ['application/x-tar', 'tar'],
  ['application/gzip', 'gz'],
  ['application/msword', 'doc'],
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'docx',
  ],
  ['application/vnd.ms-powerpoint', 'ppt'],
  [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'pptx',
  ],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.android.package-archive', 'apk'],
];

const PARSEABLE_NEEDLES = [
  'html',
  'text/',
  'application/xhtml',
  'application/json',
  'application/xml',
  'application/javascript',
];

/** Lower-cased extension of the URL path (`pathinfo` semantics). */
export function extractExtension(url: string): string {
  return phpExtension(urlPath(url)).toLowerCase();
}

export function isHtmlExtension(extension: string): boolean {
  return HTML_EXTENSIONS.includes(extension);
}

/** Port of MaterialDownloadClassifier::classifyDownloadable. */
export function classifyDownloadable(
  url: string,
  rawContentType: string,
): DownloadClassification | null {
  const contentType = rawContentType.trim().toLowerCase();
  const extension = extractExtension(url);

  if (extension === 'pdf' || contentType.includes('application/pdf')) {
    return { extension: extension !== '' ? extension : 'pdf', isPdf: true };
  }

  if (BINARY_EXTENSIONS.includes(extension)) {
    return { extension, isPdf: false };
  }

  if (
    contentType !== '' &&
    !PARSEABLE_NEEDLES.some((needle) => contentType.includes(needle))
  ) {
    return {
      extension: extension !== '' ? extension : guessExtension(contentType),
      isPdf: false,
    };
  }

  return null;
}

function guessExtension(contentType: string): string {
  return (
    MIME_EXTENSION_MAP.find(([mime]) => contentType.includes(mime))?.[1] ?? ''
  );
}
