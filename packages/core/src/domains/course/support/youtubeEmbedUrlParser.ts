import { parseUrl, phpBasename, phpTrim, queryParam } from './phpUrl';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const YOUTUBE_HOSTS = ['youtube.com', 'youtube-nocookie.com'];
const SHORT_HOST = 'youtu.be';
const ID_PATH_PREFIXES = ['embed', 'shorts', 'live', 'v'];

/**
 * Port of YoutubeEmbedUrlParser: recognises the URL shapes course leaves
 * use for YouTube videos and returns the video id:
 *
 * - the LMS redirector `…/learn/path/youtubeEmbed.php?v=<id>`
 * - plain YouTube URLs (youtu.be, watch, embed, shorts, live, nocookie)
 * - a YouTube URL the LMS prefixed with its content path
 *   (`…/content/999999/https://youtu.be/<id>`)
 */
export function extractYoutubeVideoId(url: string): string | null {
  const path = parseUrl(url)?.path ?? '';

  if (phpBasename(path) === 'youtubeEmbed.php') {
    return validated(queryParam(parseUrl(url)?.query ?? '', 'v'));
  }

  return extractFromYoutubeUrl(url) ?? extractFromPrefixedYoutubeUrl(path, url);
}

function extractFromPrefixedYoutubeUrl(
  path: string,
  url: string,
): string | null {
  const match = /\/(https?):\/{1,2}(.+)$/i.exec(path);

  if (match === null) {
    return null;
  }

  const query = parseUrl(url)?.query;
  const embedded = `${match[1].toLowerCase()}://${match[2]}${query !== undefined ? `?${query}` : ''}`;

  return extractFromYoutubeUrl(embedded);
}

function extractFromYoutubeUrl(url: string): string | null {
  const parts = parseUrl(url);
  const rawHost = parts?.host;

  if (rawHost === undefined) {
    return null;
  }

  const host = rawHost.toLowerCase().replace(/^(www|m|music)\./i, '');
  const segments = (parts?.path ?? '')
    .split('/')
    .filter((segment) => segment !== '');

  if (host === SHORT_HOST) {
    return validated(segments[0] ?? null);
  }

  if (!YOUTUBE_HOSTS.includes(host)) {
    return null;
  }

  if (segments[0] === 'watch') {
    return validated(queryParam(parts?.query ?? '', 'v'));
  }

  if (segments[0] !== undefined && ID_PATH_PREFIXES.includes(segments[0])) {
    return validated(segments[1] ?? null);
  }

  return null;
}

function validated(videoId: string | null): string | null {
  const trimmed = phpTrim(videoId ?? '');

  return trimmed !== '' && VIDEO_ID_PATTERN.test(trimmed) ? trimmed : null;
}
