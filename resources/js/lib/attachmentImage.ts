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

/**
 * Extracts a lowercase file extension from a filename or URL path, ignoring
 * query strings and fragments.
 */
function extractExtension(value: string): string | null {
    const withoutQuery = value.split(/[?#]/, 1)[0] ?? value;
    const match = /\.([a-z0-9]+)$/i.exec(withoutQuery);

    return match ? match[1].toLowerCase() : null;
}

/**
 * Determines whether an attachment is an image based on its filename,
 * falling back to the URL path when no filename is available. Attachment
 * view models don't carry a MIME type, so extension sniffing is the only
 * signal we have.
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
