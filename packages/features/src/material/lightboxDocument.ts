export interface LightboxImage {
  src: string;
  alt: string;
  /** Page URL the image came from (Referer / cookie context). */
  baseUrl: string;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/** Viewer page: pinch / double-tap zoom up to 4x (legacy MAX_SCALE). */
export function lightboxDocument(image: LightboxImage): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=4, user-scalable=yes">
<style>html,body{margin:0;height:100%;background:#000;}body{display:flex;align-items:center;justify-content:center;}img{max-width:100%;max-height:100%;object-fit:contain;}</style>
</head><body><img src="${escapeAttribute(image.src)}" alt="${escapeAttribute(image.alt)}"></body></html>`;
}
