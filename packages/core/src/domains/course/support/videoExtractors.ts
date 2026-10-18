import { attr, findElements, hasAttr, parseHtml } from './html';
import { phpTrim } from './phpUrl';

export interface ExtractedVideo {
  videoUrl: string | null;
  subtitleUrl: string | null;
}

/** Returns null when the page does not use this extractor's format. */
export type MaterialVideoExtractor = (html: string) => ExtractedVideo | null;

/**
 * Pages that start flowplayer through its JS API:
 * `flowplayer("#player", { src: "https://…", subtitles: { tracks: [{ src: "01.vtt" }] } })`.
 */
export const extractFlowplayerJsConfigVideo: MaterialVideoExtractor = (
  html,
) => {
  if (!/flowplayer\s*\(/i.test(html)) {
    return null;
  }

  // Absolute URLs only, which skips relative subtitle paths.
  const videoUrl =
    /\bsrc\s*:\s*["'](https?:\/\/[^"']+)["']/.exec(html)?.[1] ?? null;

  if (videoUrl === null) {
    return null;
  }

  const subtitleUrl =
    /subtitles\s*:\s*\{[^{}]*tracks\s*:\s*\[\s*\{[^}]*\bsrc\s*:\s*["']([^"']+)["']/.exec(
      html,
    )?.[1] ?? null;

  return { videoUrl, subtitleUrl };
};

/**
 * Pages that declare the stream in markup:
 * `<video><source type="application/x-mpegurl" src="…"><track src="01.vtt"></video>`.
 */
export const extractHtml5SourceVideo: MaterialVideoExtractor = (html) => {
  const nodes = parseHtml(html);
  const source = findElements(
    nodes,
    (element) =>
      element.name === 'source' &&
      hasAttr(element, 'type') &&
      hasAttr(element, 'src') &&
      (attr(element, 'type') ?? '').toLowerCase().includes('mpegurl'),
  )[0];

  if (source === undefined) {
    return null;
  }

  const videoUrl = phpTrim(attr(source, 'src') ?? '');

  if (videoUrl === '') {
    return null;
  }

  const track = findElements(
    findElements(nodes, (element) => element.name === 'video'),
    (element) => element.name === 'track' && hasAttr(element, 'src'),
  )[0];
  const subtitleUrl =
    track === undefined ? '' : phpTrim(attr(track, 'src') ?? '');

  return { videoUrl, subtitleUrl: subtitleUrl !== '' ? subtitleUrl : null };
};

export const MATERIAL_VIDEO_EXTRACTORS: MaterialVideoExtractor[] = [
  extractFlowplayerJsConfigVideo,
  extractHtml5SourceVideo,
];

/** First extractor that finds a video wins. */
export function extractVideo(html: string): ExtractedVideo {
  for (const extractor of MATERIAL_VIDEO_EXTRACTORS) {
    const extracted = extractor(html);

    if (extracted?.videoUrl != null) {
      return extracted;
    }
  }

  return { videoUrl: null, subtitleUrl: null };
}
