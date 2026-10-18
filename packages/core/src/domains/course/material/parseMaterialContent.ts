import { decodeLegacyText } from '../encoding/legacyText';
import {
  classifyDownloadable,
  extractExtension,
  isHtmlExtension,
  type DownloadClassification,
} from '../support/materialDownloadClassifier';
import {
  phpBasename,
  resolveRelativeUrl,
  urlHost,
  urlPath,
} from '../support/phpUrl';
import { extractVideo } from '../support/videoExtractors';
import { extractYoutubeVideoId } from '../support/youtubeEmbedUrlParser';
import type { MaterialFetchDescriptor, ParsedMaterialContent } from '../types';
import { cleanMaterialHtml } from './cleanMaterialHtml';

/** Upstream access the material parser needs (HUNGU, as the signed-in user). */
export interface MaterialContentClient {
  /** HEAD request (legacy UUProxyClient::probeContentType). */
  probeContentType(
    url: string,
  ): Promise<{ status: number; contentType: string }>;
  /**
   * GET the material. Return raw bytes when possible so Big5 pages can be
   * decoded (see createHunguMaterialContentClient); a string is taken as
   * already-decoded text.
   */
  fetchMaterialContent(url: string): Promise<{
    status: number;
    contentType: string;
    body: Uint8Array | string;
  }>;
  /** Headers (incl. Cookie) for the app to fetch `url` itself. */
  materialFetchHandoff(url: string): Promise<MaterialFetchDescriptor>;
}

export interface ParseMaterialContentDeps {
  client: MaterialContentClient;
  /** `services.statics.base_url` (hosts the YouTube embed wrapper page). */
  staticsBaseUrl: string;
}

/** ParsedMaterialContentViewModel::emptyContent() */
export function emptyMaterialContent(): ParsedMaterialContent {
  return {
    videoUrl: null,
    subtitleUrl: null,
    downloadUrl: null,
    downloadProxyUrl: null,
    downloadFileName: null,
    downloadFileExtension: null,
    isPdf: false,
    htmlContent: null,
    videoProvider: 'native',
    embedVideoUrl: null,
    baseUrl: null,
    download: null,
    subtitle: null,
  };
}

/**
 * Port of ParseMaterialContent: decides whether a course material is a
 * YouTube embed, a download (PDF / archives / office files) or an HTML page,
 * and for pages extracts the video stream and the cleaned HTML.
 */
export function createParseMaterialContent(deps: ParseMaterialContentDeps) {
  const { client } = deps;

  const toYoutubeResult = (videoId: string): ParsedMaterialContent => ({
    ...emptyMaterialContent(),
    htmlContent: '',
    videoProvider: 'youtube',
    // A real-https wrapper page, so YouTube sees a genuine Referer.
    embedVideoUrl: `${deps.staticsBaseUrl.replace(/\/+$/, '')}/youtube-embed.html?v=${videoId}`,
  });

  const toDownloadResult = async (
    url: string,
    classification: DownloadClassification,
  ): Promise<ParsedMaterialContent> => ({
    ...emptyMaterialContent(),
    htmlContent: '',
    downloadUrl: url,
    downloadFileName: buildDownloadFileName(url, classification),
    downloadFileExtension:
      classification.extension !== '' ? classification.extension : null,
    isPdf: classification.isPdf,
    download: await client.materialFetchHandoff(url),
  });

  const probeContentTypeSafely = async (
    url: string,
  ): Promise<string | null> => {
    let probe: { status: number; contentType: string };

    try {
      probe = await client.probeContentType(url);
    } catch {
      return null;
    }

    if (probe.status < 200 || probe.status >= 300) {
      return null;
    }

    const contentType = probe.contentType.trim();

    return contentType !== '' ? contentType : null;
  };

  return async (
    url: string,
    baseHost: string,
  ): Promise<ParsedMaterialContent> => {
    const youtubeVideoId = extractYoutubeVideoId(url);

    if (youtubeVideoId !== null) {
      return toYoutubeResult(youtubeVideoId);
    }

    const extensionClassification = classifyDownloadable(url, '');

    if (extensionClassification !== null) {
      return toDownloadResult(url, extensionClassification);
    }

    if (!isHtmlExtension(extractExtension(url))) {
      const headContentType = await probeContentTypeSafely(url);

      if (headContentType !== null) {
        const headClassification = classifyDownloadable(url, headContentType);

        if (headClassification !== null) {
          return toDownloadResult(url, headClassification);
        }
      }
    }

    const material = await client.fetchMaterialContent(url);
    const classification = classifyDownloadable(
      url,
      material.contentType.toLowerCase(),
    );

    if (classification !== null) {
      return toDownloadResult(url, classification);
    }

    const html =
      typeof material.body === 'string'
        ? material.body
        : decodeLegacyText(material.body);
    const extracted = extractVideo(html);
    const videoUrl =
      extracted.videoUrl !== null
        ? resolveRelativeUrl(url, extracted.videoUrl)
        : null;
    let subtitleUrl: string | null = null;

    if (videoUrl !== null && extracted.subtitleUrl !== null) {
      const resolved = resolveRelativeUrl(url, extracted.subtitleUrl);

      if (resolved !== null && urlHost(resolved) === baseHost) {
        subtitleUrl = resolved;
      }
    }

    return {
      ...emptyMaterialContent(),
      videoUrl,
      subtitleUrl,
      htmlContent: cleanMaterialHtml(html, url),
      baseUrl: url,
      subtitle:
        subtitleUrl !== null
          ? await client.materialFetchHandoff(subtitleUrl)
          : null,
    };
  };
}

export type ParseMaterialContent = ReturnType<
  typeof createParseMaterialContent
>;

function buildDownloadFileName(
  url: string,
  classification: DownloadClassification,
): string {
  const basename = phpBasename(urlPath(url));

  if (basename !== '' && basename !== '.' && basename.includes('.')) {
    return basename;
  }

  const extension =
    classification.extension !== ''
      ? classification.extension
      : classification.isPdf
        ? 'pdf'
        : 'bin';

  return `download.${extension}`;
}
