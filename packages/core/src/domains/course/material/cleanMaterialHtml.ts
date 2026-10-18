import type { AnyNode, ChildNode, Element } from 'domhandler';
import { Element as DomElement, isComment, isTag, isText } from 'domhandler';
import { removeElement } from 'domutils';
import { parseDocument } from 'htmlparser2';
import { findElements, hasClassToken } from '../support/html';
import { resolveRelativeUrl } from '../support/phpUrl';
import { purifyNodes } from './purifier';

const SKIPPED_URL_PREFIXES = [
  'data:',
  'javascript:',
  'mailto:',
  'tel:',
  'blob:',
];
const EMPTY_CANDIDATES = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'p',
  'blockquote',
  'div',
]);
const DOCUMENT_ONLY = new Set(['html', 'head', 'body']);

/**
 * Port of ParseMaterialContent::cleanHtml, minus the material-proxy
 * rewrite: players, scripts and styles are removed, `src` / `href` become
 * absolute upstream URLs, empty headings / paragraphs / divs are dropped
 * and the `<body>` content goes through the purifier.
 *
 * Intentional difference from legacy: same-host `src` URLs stay absolute
 * upstream URLs (legacy wrapped them in `/material-proxy/<base64url>`); the
 * app renders this HTML in a WebView whose cookie store carries the HUNGU
 * session, with {@link ParsedMaterialContent.baseUrl} as the page origin.
 */
export function cleanMaterialHtml(html: string, baseUrl: string): string {
  const document = parseDocument(html);
  const all = (): Element[] => findElements(document.children, () => true);

  for (const element of all()) {
    if (
      ['script', 'style', 'link'].includes(element.name) ||
      element.attribs.id === 'player' ||
      hasClassToken(element, 'flowplayer')
    ) {
      removeElement(element);
    }
  }

  for (const element of all()) {
    delete element.attribs.style;

    if ('src' in element.attribs) {
      const resolved = resolveUnlessSkipped(element.attribs.src, baseUrl);

      if (resolved !== null) {
        element.attribs.src = resolved;
      }
    }

    if (element.name === 'a' && 'href' in element.attribs) {
      element.attribs.target = '_blank';
      element.attribs.rel = 'noopener noreferrer';
      const resolved = resolveUnlessSkipped(element.attribs.href, baseUrl);

      if (resolved !== null) {
        element.attribs.href = resolved;
      }
    }
  }

  insertImplicitTableBodies(all());
  removeEmptyElements(document.children);

  return purifyNodes(trimNodes(bodyNodes(document.children)));
}

function resolveUnlessSkipped(raw: string, baseUrl: string): string | null {
  const url = raw.trim();

  if (
    url === '' ||
    SKIPPED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))
  ) {
    return null;
  }

  return resolveRelativeUrl(baseUrl, url);
}

/** The HTML5 parser legacy used puts bare `<tr>` rows into a `<tbody>`. */
function insertImplicitTableBodies(elements: Element[]): void {
  for (const table of elements.filter((element) => element.name === 'table')) {
    const children: ChildNode[] = [];
    let body: Element | null = null;

    for (const child of table.children) {
      const isRow = isTag(child) && child.name === 'tr';

      if (isRow && body === null) {
        body = new DomElement('tbody', {}, []);
        body.parent = table;
        children.push(body);
      }

      if (
        body !== null &&
        (isRow || (isText(child) && child.data.trim() === ''))
      ) {
        child.parent = body;
        body.children.push(child);
        continue;
      }

      body = null;
      children.push(child);
    }

    table.children = children;
    relink(children);

    for (const element of children) {
      if (isTag(element)) {
        relink(element.children);
      }
    }
  }
}

function relink(nodes: ChildNode[]): void {
  nodes.forEach((node, index) => {
    node.prev = nodes[index - 1] ?? null;
    node.next = nodes[index + 1] ?? null;
  });
}

/** Legacy removeEmptyElementsDom, repeated until nothing changes. */
function removeEmptyElements(roots: AnyNode[]): void {
  for (;;) {
    const empty = findElements(
      roots,
      (element) =>
        EMPTY_CANDIDATES.has(element.name) &&
        !element.children.some(
          (child) =>
            isTag(child) ||
            (isText(child) && stripWhitespace(child.data) !== ''),
        ),
    );

    if (empty.length === 0) {
      return;
    }

    empty.forEach((element) => removeElement(element));
  }
}

function stripWhitespace(value: string): string {
  return value.replace(/[\s\u00a0\u3000]+/gu, '').replace(/&nbsp;/g, '');
}

/**
 * `<body>` children, or for fragments without one the document content
 * minus `<head>` (the HTML5 parser legacy used always created a body).
 */
function bodyNodes(roots: ChildNode[]): ChildNode[] {
  const body = findElements(roots, (element) => element.name === 'body')[0];

  if (body !== undefined) {
    return body.children;
  }

  const result: ChildNode[] = [];

  for (const node of roots) {
    if (isTag(node) && DOCUMENT_ONLY.has(node.name)) {
      if (node.name !== 'head') {
        result.push(...bodyNodes(node.children));
      }

      continue;
    }

    if (isTag(node) && ['title', 'meta'].includes(node.name)) {
      continue;
    }

    if (isTag(node) || isText(node) || isComment(node)) {
      result.push(node);
    }
  }

  return result;
}

/** PHP `trim()` of the serialised body. */
function trimNodes(nodes: ChildNode[]): ChildNode[] {
  const result = [...nodes];
  const blank = /^[ \t\n\r\0\v]*$/;

  while (result.length > 0 && isText(result[0])) {
    const text = result[0];
    const trimmed = text.data.replace(/^[ \t\n\r\0\v]+/, '');

    if (!blank.test(trimmed)) {
      result[0] = cloneText(text, trimmed);
      break;
    }

    result.shift();
  }

  while (result.length > 0 && isText(result[result.length - 1])) {
    const text = result[result.length - 1];

    if (!isText(text)) {
      break;
    }

    const trimmed = text.data.replace(/[ \t\n\r\0\v]+$/, '');

    if (trimmed !== '') {
      result[result.length - 1] = cloneText(text, trimmed);
      break;
    }

    result.pop();
  }

  return result;
}

function cloneText(node: ChildNode, data: string): ChildNode {
  const clone = node.cloneNode() as ChildNode & { data: string };
  clone.data = data;

  return clone;
}
