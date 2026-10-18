import type { AnyNode } from 'domhandler';
import { isComment, isTag, isText } from 'domhandler';
import { phpBasename } from '../support/phpUrl';
import { sanitizeCssDeclarations } from './purifierCss';

/**
 * Port of the HTMLPurifier configuration the legacy ParseMaterialContent
 * used (`config/purifier.php` default settings merged with the material
 * overrides):
 *
 * - HTML.Allowed: div,b,strong,i,em,u,a[href|title],ul,ol,li,p,br,span,
 *   img[width|height|alt|src],audio[controls|src],
 *   video[controls|src|width|height],source[src|type],
 *   iframe[src|width|height|allowfullscreen|frameborder],table,
 *   tr/th/td[rowspan|colspan],tbody,thead,tfoot
 * - style / CSS: none survive (CSS.AllowedProperties is empty)
 * - script/style contents are dropped, other unknown tags are unwrapped
 * - URI.AllowedSchemes (HTMLPurifier default): http, https, mailto, ftp,
 *   nntp, news, tel; iframes only with `^(https?://|/)` sources
 * - HTML.TargetBlank + TargetNoreferrer/Noopener on external links
 * - AutoFormat.AutoParagraph and AutoFormat.RemoveEmpty
 *
 * It works on a parsed tree instead of HTMLPurifier's token stream, so it
 * reproduces the legacy output for the material shapes covered by the
 * goldens (see purifier.test.ts) rather than every HTMLPurifier corner case.
 */

export type PurifierNode = PurifierText | PurifierElement;

export interface PurifierText {
  type: 'text';
  data: string;
}

export interface PurifierElement {
  type: 'element';
  name: string;
  attributes: Array<[string, string]>;
  children: PurifierNode[];
}

export type AttributeKind =
  'text' | 'uri' | 'iframe-uri' | 'length' | 'bool' | 'frameborder' | 'style';

/**
 * One HTMLPurifier configuration: the `HTML.Allowed` element / attribute
 * map plus the options that differ between the legacy callers.
 */
export interface PurifierProfile {
  allowed: Record<string, Record<string, AttributeKind>>;
  /** HTML.TargetBlank (+ noreferrer / noopener) on external links. */
  targetBlank: boolean;
  /** CSS.AllowedProperties, used by `style` attributes. */
  cssProperties: ReadonlySet<string>;
}

const CELL_ATTRIBUTES: Record<string, AttributeKind> = {
  rowspan: 'text',
  colspan: 'text',
};

const MATERIAL_ALLOWED: PurifierProfile['allowed'] = {
  div: {},
  b: {},
  strong: {},
  i: {},
  em: {},
  u: {},
  a: { href: 'uri', title: 'text' },
  ul: {},
  ol: {},
  li: {},
  p: {},
  br: {},
  span: {},
  img: { width: 'length', height: 'length', alt: 'text', src: 'uri' },
  audio: { controls: 'bool', src: 'uri' },
  video: { controls: 'bool', src: 'uri', width: 'length', height: 'length' },
  source: { src: 'uri', type: 'text' },
  iframe: {
    src: 'iframe-uri',
    width: 'length',
    height: 'length',
    allowfullscreen: 'bool',
    frameborder: 'frameborder',
  },
  table: {},
  tr: CELL_ATTRIBUTES,
  th: CELL_ATTRIBUTES,
  td: CELL_ATTRIBUTES,
  tbody: {},
  thead: {},
  tfoot: {},
};

/** The material profile: no styles, tables and iframes, external links open in a new window. */
export const MATERIAL_PROFILE: PurifierProfile = {
  allowed: MATERIAL_ALLOWED,
  targetBlank: true,
  cssProperties: new Set(),
};

/** Attributes serialised as a bare name (HTML `Bool`). */
const BOOLEAN_ATTRIBUTES = new Set(['controls', 'allowfullscreen']);

/** Core.HiddenElements + HTML.ForbiddenElements: removed with contents. */
const HIDDEN = new Set(['script', 'style', 'link']);
const VOID = new Set(['br', 'img', 'source']);
const INLINE = new Set([
  'a',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'br',
  'span',
  'img',
  'iframe',
]);
const BLOCK = new Set(['div', 'p', 'ul', 'ol', 'table', 'video', 'audio']);
const INLINE_ONLY = new Set(['p', ...INLINE]);
/** Elements whose content model allows `<p>` (AutoParagraph targets). */
const PARAGRAPH_CONTAINERS = new Set(['div', 'li', 'td', 'th']);
const TABLE_SECTIONS = new Set(['thead', 'tbody', 'tfoot']);
const ALLOWED_SCHEMES = new Set([
  'http',
  'https',
  'mailto',
  'ftp',
  'nntp',
  'news',
  'tel',
]);
const BROWSABLE_SCHEMES = new Set(['http', 'https', 'ftp']);
const SAFE_IFRAME = /^(https?:\/\/|\/)/;

/** Sanitises a node list and returns the HTML (HTMLPurifier `clean`). */
export function purifyNodes(
  nodes: AnyNode[],
  profile: PurifierProfile = MATERIAL_PROFILE,
): string {
  const filtered = fixContent('#root', filterNodes(nodes, profile));
  const withoutEmpty = filtered.map((node) => {
    if (node.type === 'element') {
      removeEmptyWithin(node);
      paragraphDescendants(node);
    }

    return node;
  });
  const paragraphed = autoParagraph(withoutEmpty, true);

  return serializeNodes(removeEmpty(paragraphed, '#root'));
}

// ---------------------------------------------------------------------------
// RemoveForeignElements + attribute validation

function filterNodes(
  nodes: AnyNode[],
  profile: PurifierProfile,
): PurifierNode[] {
  const result: PurifierNode[] = [];

  for (const node of nodes) {
    if (isText(node)) {
      pushText(result, node.data);
      continue;
    }

    if (!isTag(node) || isComment(node)) {
      continue;
    }

    const name = node.name.toLowerCase();

    if (HIDDEN.has(name)) {
      continue;
    }

    const children = filterNodes(node.children, profile);
    const rules = profile.allowed[name];

    if (rules === undefined) {
      for (const child of children) {
        pushNode(result, child);
      }

      continue;
    }

    const element = validateElement(
      name,
      node.attribs,
      rules,
      children,
      profile,
    );

    if (element !== null) {
      pushNode(result, element);
    }
  }

  return result;
}

function validateElement(
  name: string,
  attribs: Record<string, string>,
  rules: Record<string, AttributeKind>,
  children: PurifierNode[],
  profile: PurifierProfile,
): PurifierElement | null {
  const attributes: Array<[string, string]> = [];

  for (const [rawName, rawValue] of Object.entries(attribs)) {
    const attributeName = rawName.toLowerCase();
    const kind = rules[attributeName];

    if (kind === undefined) {
      continue;
    }

    const value = validateAttribute(kind, rawValue, profile);

    if (value !== null) {
      attributes.push([attributeName, value]);
    }
  }

  const element: PurifierElement = {
    type: 'element',
    name,
    attributes,
    children: VOID.has(name) ? [] : children,
  };

  if (name === 'img') {
    const src = getAttribute(element, 'src');

    if (src === null) {
      return null;
    }

    if (getAttribute(element, 'alt') === null) {
      attributes.push(['alt', phpBasename(src)]);
    }
  }

  if (name === 'a' && profile.targetBlank) {
    applyTargetBlank(element);
  }

  if (name === 'iframe') {
    element.children = [];
  }

  return element;
}

function validateAttribute(
  kind: AttributeKind,
  raw: string,
  profile: PurifierProfile,
): string | null {
  const value = parseCdata(raw);

  switch (kind) {
    case 'text':
      return value;
    case 'bool':
      return '';
    case 'style': {
      const css = sanitizeCssDeclarations(value, profile.cssProperties);

      return css === '' ? null : css;
    }
    case 'frameborder':
      return value === '0' || value === '1' ? value : null;
    case 'length':
      return validateLength(value);
    case 'uri':
      return validateUri(value);
    case 'iframe-uri': {
      const uri = validateUri(value);

      return uri !== null && SAFE_IFRAME.test(uri) ? uri : null;
    }
  }
}

/** HTMLPurifier `parseCDATA`: trim, then tabs / newlines become spaces. */
function parseCdata(value: string): string {
  return value.trim().replace(/[\n\t\r]/g, ' ');
}

function validateLength(value: string): string | null {
  const match = /^(\d+(?:\.\d+)?)(px|%)?$/i.exec(value);

  if (match === null) {
    return null;
  }

  return match[2] === '%' ? `${match[1]}%` : match[1];
}

function validateUri(value: string): string | null {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase();

  if (scheme !== undefined && !ALLOWED_SCHEMES.has(scheme)) {
    return null;
  }

  return percentEncodeUri(value);
}

/** Encodes characters that are not valid in a URI (UTF-8, like HTMLPurifier). */
function percentEncodeUri(value: string): string {
  let result = '';

  for (let index = 0; index < value.length; index++) {
    const char = value[index];

    if (char === '%') {
      result += /^[0-9a-f]{2}$/i.test(value.slice(index + 1, index + 3))
        ? '%'
        : '%25';
      continue;
    }

    if (/[A-Za-z0-9\-._~!$&'()*+,;=:@/?#[\]]/.test(char)) {
      result += char;
      continue;
    }

    const codePoint = value.codePointAt(index) ?? 0;
    const encoded = encodeURIComponent(String.fromCodePoint(codePoint));

    if (codePoint > 0xffff) {
      index += 1;
    }

    result += encoded.startsWith('%')
      ? encoded
      : `%${codePoint.toString(16).toUpperCase().padStart(2, '0')}`;
  }

  return result;
}

/**
 * HTML.TargetBlank + HTML.TargetNoreferrer + HTML.TargetNoopener: links to
 * a browsable scheme on some host open in a new window.
 */
function applyTargetBlank(element: PurifierElement): void {
  const href = getAttribute(element, 'href');

  if (href === null) {
    return;
  }

  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(href);

  if (
    match === null ||
    match[2] === '' ||
    !BROWSABLE_SCHEMES.has(match[1].toLowerCase())
  ) {
    return;
  }

  element.attributes.push(['target', '_blank'], ['rel', 'noreferrer noopener']);
}

// ---------------------------------------------------------------------------
// MakeWellFormed / FixNesting (content models)

function fixContent(
  parentName: string,
  children: PurifierNode[],
): PurifierNode[] {
  const result: PurifierNode[] = [];

  for (const child of children) {
    if (child.type === 'text') {
      pushText(result, child.data);
      continue;
    }

    child.children = fixContent(child.name, child.children);

    for (const node of hoistBlocks(child)) {
      pushNode(result, node);
    }
  }

  return applyContentModel(parentName, result);
}

/** An inline element cannot hold blocks: it is closed before the block. */
function hoistBlocks(element: PurifierElement): PurifierNode[] {
  if (!INLINE_ONLY.has(element.name)) {
    return [element];
  }

  const blockIndex = element.children.findIndex(
    (child) => child.type === 'element' && BLOCK.has(child.name),
  );

  if (blockIndex < 0) {
    return [element];
  }

  const rest = element.children.slice(blockIndex);
  element.children = element.children.slice(0, blockIndex);

  return [element, ...rest];
}

function applyContentModel(
  parentName: string,
  children: PurifierNode[],
): PurifierNode[] {
  switch (parentName) {
    case 'ul':
    case 'ol':
      return wrapListItems(children);
    case 'table':
      return orderTableSections(
        children.filter(
          (child) =>
            isWhitespaceNode(child) ||
            (child.type === 'element' &&
              (TABLE_SECTIONS.has(child.name) || child.name === 'tr')),
        ),
      );
    case 'thead':
    case 'tbody':
    case 'tfoot':
      return keepOnly(children, ['tr']);
    case 'tr':
      return keepOnly(children, ['td', 'th']);
    case 'video':
    case 'audio':
      return children.filter((child) => child.type === 'element');
    default:
      return unwrapMisplaced(children);
  }
}

function keepOnly(children: PurifierNode[], names: string[]): PurifierNode[] {
  return children.filter(
    (child) =>
      isWhitespaceNode(child) ||
      (child.type === 'element' && names.includes(child.name)),
  );
}

/** Table parts outside their context are unwrapped; `source` is dropped. */
function unwrapMisplaced(children: PurifierNode[]): PurifierNode[] {
  const result: PurifierNode[] = [];

  for (const child of children) {
    if (child.type === 'element') {
      if (child.name === 'source') {
        continue;
      }

      if (['li', 'tr', 'td', 'th', ...TABLE_SECTIONS].includes(child.name)) {
        for (const grandChild of child.children) {
          pushNode(result, grandChild);
        }

        continue;
      }
    }

    pushNode(result, child);
  }

  return result;
}

function wrapListItems(children: PurifierNode[]): PurifierNode[] {
  const result: PurifierNode[] = [];
  let pending: PurifierElement | null = null;

  for (const child of children) {
    if (child.type === 'element' && child.name === 'li') {
      pending = null;
      result.push(child);
      continue;
    }

    if (pending === null && isWhitespaceNode(child)) {
      result.push(child);
      continue;
    }

    if (pending === null) {
      pending = {
        type: 'element',
        name: 'li',
        attributes: [],
        children: [],
      };
      result.push(pending);
    }

    pushNode(pending.children, child);
  }

  return result;
}

/** HTML 4 order: thead, tfoot, then the body rows. */
function orderTableSections(children: PurifierNode[]): PurifierNode[] {
  const head = children.find(
    (child) => child.type === 'element' && child.name === 'thead',
  );
  const foot = children.find(
    (child) => child.type === 'element' && child.name === 'tfoot',
  );
  const rest = children.filter((child) => child !== head && child !== foot);

  return [
    ...(head !== undefined ? [head] : []),
    ...(foot !== undefined ? [foot] : []),
    ...rest,
  ];
}

// ---------------------------------------------------------------------------
// AutoFormat.RemoveEmpty

function isRemovableWhenEmpty(element: PurifierElement): boolean {
  if (VOID.has(element.name) || ['td', 'th'].includes(element.name)) {
    return false;
  }

  if (element.name === 'iframe' && getAttribute(element, 'src') !== null) {
    return false;
  }

  return element.children.every(isWhitespaceNode);
}

function removeEmptyWithin(element: PurifierElement): PurifierElement {
  element.children = removeEmpty(element.children, element.name);

  return element;
}

function removeEmpty(
  children: PurifierNode[],
  parentName: string,
): PurifierNode[] {
  const result: PurifierNode[] = [];
  let skipFollowingWhitespace = false;

  for (const child of children) {
    if (skipFollowingWhitespace && isWhitespaceNode(child)) {
      skipFollowingWhitespace = false;
      continue;
    }

    skipFollowingWhitespace = false;

    if (child.type === 'element') {
      removeEmptyWithin(child);

      if (isRemovableWhenEmpty(child)) {
        // Inside lists the whitespace after a removed item goes too.
        skipFollowingWhitespace = parentName === 'ul' || parentName === 'ol';
        continue;
      }
    }

    // Text around a removed element stays a separate token (no merge),
    // as in HTMLPurifier's token stream.
    result.push(child);
  }

  return result;
}

// ---------------------------------------------------------------------------
// AutoFormat.AutoParagraph

type ParagraphToken =
  | { kind: 'text'; data: string }
  | { kind: 'node'; node: PurifierElement }
  | { kind: 'start'; attributes?: Array<[string, string]> }
  | { kind: 'end' };

const P_START: ParagraphToken = { kind: 'start' };
const P_END: ParagraphToken = { kind: 'end' };
const textToken = (data: string): ParagraphToken => ({ kind: 'text', data });

function autoParagraph(
  children: PurifierNode[],
  isRoot: boolean,
): PurifierNode[] {
  const front: ParagraphToken[] = [];
  let inParagraph = false;
  const push = (...tokens: ParagraphToken[]): void => {
    for (const token of tokens) {
      front.push(token);

      if (token.kind === 'start') {
        inParagraph = true;
      } else if (token.kind === 'end') {
        inParagraph = false;
      }
    }
  };
  const last = (): ParagraphToken | undefined => front[front.length - 1];
  const queue: Array<PurifierNode | ParagraphToken> = [...children];

  while (queue.length > 0) {
    const item = queue.shift() as PurifierNode | ParagraphToken;

    if ('kind' in item) {
      push(item);
      continue;
    }

    const rest = queue.filter(
      (entry): entry is PurifierNode => !('kind' in entry),
    );

    if (item.type === 'text') {
      if (inParagraph) {
        push(...splitText(item.data, []));
      } else if (isRoot || item.data.includes('\n\n')) {
        const next = rest[0];
        const whitespace = isWhitespace(item.data);

        if (next === undefined && whitespace) {
          push(textToken(item.data));
        } else if (!whitespace || isInlineNode(next)) {
          push(...splitText(item.data, [P_START]));
        } else {
          push(textToken(item.data));
        }
      } else if (paragraphLookAhead(rest)) {
        push(P_START, textToken(item.data));
      } else {
        push(textToken(item.data));
      }

      continue;
    }

    const inline = INLINE.has(item.name);
    const empty = isRoot && isRemovableWhenEmpty(item);

    if (inParagraph && !inline) {
      push(P_END);
    }

    if (inParagraph) {
      push({ kind: 'node', node: item });
      continue;
    }

    if (inline) {
      const tokens: ParagraphToken[] = [];

      if (isRoot) {
        tokens.push(P_START);

        if (last() !== undefined && last()?.kind !== 'text') {
          tokens.unshift(textToken('\n\n'));
        }
      } else {
        const previous = last();

        if (
          previous === undefined
            ? paragraphLookAhead([...item.children, ...rest])
            : previous.kind === 'text' && previous.data.endsWith('\n\n')
        ) {
          tokens.push(P_START);
        }
      }

      push(...tokens);

      if (!empty) {
        push({ kind: 'node', node: item });
      }

      continue;
    }

    if (isRoot && last() !== undefined && last()?.kind !== 'text') {
      push(textToken('\n\n'));
    }

    if (empty) {
      continue;
    }

    if (item.name === 'p') {
      queue.unshift(
        { kind: 'start', attributes: item.attributes },
        ...item.children,
        P_END,
      );
      continue;
    }

    push({ kind: 'node', node: item });
  }

  return buildParagraphs(front);
}

function paragraphDescendants(element: PurifierElement): void {
  for (const child of element.children) {
    if (child.type === 'element') {
      paragraphDescendants(child);
    }
  }

  if (PARAGRAPH_CONTAINERS.has(element.name)) {
    element.children = autoParagraph(element.children, false);
  }
}

/** `_pLookAhead`: does a double newline come before the next block? */
function paragraphLookAhead(nodes: PurifierNode[]): boolean {
  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.data.includes('\n\n')) {
        return true;
      }

      continue;
    }

    if (!INLINE.has(node.name)) {
      return false;
    }

    if (VOID.has(node.name)) {
      continue;
    }

    if (paragraphLookAhead(node.children)) {
      return true;
    }
  }

  return false;
}

/** Literal port of `_splitText`. */
function splitText(data: string, result: ParagraphToken[]): ParagraphToken[] {
  const rawParagraphs = data.split('\n\n');

  if (rawParagraphs.length === 1) {
    result.push(textToken(data));

    return result;
  }

  const paragraphs: string[] = [];
  let needsStart = false;
  let needsEnd = false;

  rawParagraphs.forEach((paragraph, index) => {
    if (paragraph.replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g, '') !== '') {
      paragraphs.push(paragraph);
    } else if (index === 0) {
      if (result.length === 0) {
        result.push(P_END, textToken('\n\n'));
        needsStart = true;
      } else {
        result.unshift(textToken('\n\n'));
      }
    } else if (index + 1 === rawParagraphs.length) {
      needsEnd = true;
    }
  });

  if (paragraphs.length === 0) {
    return result;
  }

  if (needsStart) {
    result.push(P_START);
  }

  for (const paragraph of paragraphs) {
    result.push(textToken(paragraph), P_END, textToken('\n\n'), P_START);
  }

  result.pop();

  if (!needsEnd) {
    result.pop();
    result.pop();
  }

  return result;
}

function buildParagraphs(tokens: ParagraphToken[]): PurifierNode[] {
  const result: PurifierNode[] = [];
  let paragraph: PurifierElement | null = null;

  const close = (): void => {
    if (paragraph !== null) {
      result.push(paragraph);
      paragraph = null;
    }
  };

  for (const token of tokens) {
    switch (token.kind) {
      case 'start':
        close();
        paragraph = {
          type: 'element',
          name: 'p',
          attributes: token.attributes ?? [],
          children: [],
        };
        break;
      case 'end':
        close();
        break;
      case 'text':
        pushText(paragraph?.children ?? result, token.data);
        break;
      case 'node':
        (paragraph?.children ?? result).push(token.node);
        break;
    }
  }

  close();

  return result;
}

// ---------------------------------------------------------------------------
// Generator

export function serializeNodes(nodes: PurifierNode[]): string {
  return nodes.map(serializeNode).join('');
}

function serializeNode(node: PurifierNode): string {
  if (node.type === 'text') {
    return escapeText(node.data);
  }

  const attributes = node.attributes
    .map(([name, value]) =>
      BOOLEAN_ATTRIBUTES.has(name)
        ? ` ${name}`
        : ` ${name}="${escapeAttribute(value)}"`,
    )
    .join('');

  if (VOID.has(node.name)) {
    return `<${node.name}${attributes}>`;
  }

  return `<${node.name}${attributes}>${serializeNodes(node.children)}</${node.name}>`;
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// helpers

function getAttribute(element: PurifierElement, name: string): string | null {
  return element.attributes.find(([key]) => key === name)?.[1] ?? null;
}

/** HTMLPurifier `is_whitespace` (ctype_space). */
function isWhitespace(value: string): boolean {
  return /^[ \t\n\r\v\f]*$/.test(value);
}

function isWhitespaceNode(node: PurifierNode): boolean {
  return node.type === 'text' && isWhitespace(node.data);
}

function isInlineNode(node: PurifierNode | undefined): boolean {
  return node?.type === 'element' && INLINE.has(node.name);
}

function pushText(target: PurifierNode[], data: string): void {
  if (data === '') {
    return;
  }

  const previous = target[target.length - 1];

  if (previous?.type === 'text') {
    previous.data += data;
  } else {
    target.push({ type: 'text', data });
  }
}

function pushNode(target: PurifierNode[], node: PurifierNode): void {
  if (node.type === 'text') {
    pushText(target, node.data);
  } else {
    target.push(node);
  }
}
