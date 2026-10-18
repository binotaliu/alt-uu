/**
 * Tiny URL helpers. React Native's `URL` polyfill is incomplete, so core
 * does not rely on it for resolving redirects.
 */

const ABSOLUTE_URL = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i;

/** Lowercased `host[:port]`, or '' for a relative / malformed URL. */
export function hostOf(url: string): string {
  return ABSOLUTE_URL.exec(url)?.[2]?.toLowerCase() ?? '';
}

/** `scheme://host[:port]`, or '' for a relative / malformed URL. */
export function originOf(url: string): string {
  const match = ABSOLUTE_URL.exec(url);

  return match === null ? '' : `${match[1].toLowerCase()}://${match[2]}`;
}

/** Resolves a Location header against the URL that returned it. */
export function resolveUrl(location: string, base: string): string {
  if (ABSOLUTE_URL.test(location)) {
    return location;
  }

  const origin = originOf(base);

  if (location.startsWith('//')) {
    return `${origin.split(':')[0]}:${location}`;
  }

  if (location.startsWith('/')) {
    return `${origin}${location}`;
  }

  const path = base.slice(origin.length).split(/[?#]/)[0] ?? '';

  if (location.startsWith('?')) {
    return `${origin}${path || '/'}${location}`;
  }

  const directory = path.slice(0, path.lastIndexOf('/') + 1) || '/';

  return `${origin}${directory}${location}`;
}
