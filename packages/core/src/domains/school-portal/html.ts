import type { AnyNode, Element } from 'domhandler';
import { isTag } from 'domhandler';
import { findAll, getAttributeValue, textContent } from 'domutils';
import { parseDocument } from 'htmlparser2';

/**
 * Shared scraping helpers for the portal's Kurogo pages (port of legacy
 * ParsesSchoolPortalHtml plus the XPath class-token queries the actions use).
 */

/** Strips the leading XML declaration so the page parses as plain HTML. */
export function stripXmlProlog(html: string): string {
  return html.replace(/^\s*<\?xml[^>]*\?>/, '');
}

export function parsePortalHtml(html: string): AnyNode[] {
  return parseDocument(stripXmlProlog(html)).children;
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/[\s\u00A0\u3000]+/gu, ' ')
    .trim();
}

export function hasClass(element: Element, className: string): boolean {
  const classes = getAttributeValue(element, 'class') ?? '';

  return classes.split(/\s+/u).includes(className);
}

/** Descendant elements (document order) matching the predicate. */
export function descendants(
  root: AnyNode | AnyNode[],
  test: (element: Element) => boolean,
): Element[] {
  const nodes = Array.isArray(root)
    ? root
    : 'children' in root
      ? root.children
      : [];

  return findAll(test, nodes);
}

export function divsWithClass(
  root: AnyNode | AnyNode[],
  className: string,
): Element[] {
  return descendants(
    root,
    (element) => element.name === 'div' && hasClass(element, className),
  );
}

export function firstTitleButtonText(item: Element): string {
  const button = descendants(
    item,
    (element) =>
      element.name === 'button' && hasClass(element, 'accordion-button'),
  )[0];

  return button === undefined ? '' : normalizeText(textContent(button));
}

export function elementChildren(element: Element): Element[] {
  return element.children.filter(isTag);
}

export function nodeText(node: AnyNode): string {
  return textContent(node);
}

/** Splits "label：value" on the first full-width colon, else the first ":". */
export function splitDetail(text: string): [string, string] {
  const normalized = normalizeText(text);
  let colon = normalized.indexOf('：');

  if (colon === -1) {
    colon = normalized.indexOf(':');
  }

  if (colon === -1) {
    return ['', normalized];
  }

  return [
    normalized.slice(0, colon).trim(),
    normalized.slice(colon + 1).trim(),
  ];
}

export function splitOnLastColon(text: string): [string, string] {
  let colon = text.lastIndexOf('：');

  if (colon === -1) {
    colon = text.lastIndexOf(':');
  }

  if (colon === -1) {
    return ['', text];
  }

  return [text.slice(0, colon).trim(), text.slice(colon + 1).trim()];
}

/** Elements that are a `year-box` or an `accordion-item`, in document order. */
export function yearBoxesAndAccordionItems(nodes: AnyNode[]): Element[] {
  return descendants(
    nodes,
    (element) =>
      hasClass(element, 'year-box') || hasClass(element, 'accordion-item'),
  );
}

export function yearLabel(yearBox: Element): string {
  const year = divsWithClass(yearBox, 'year')[0];

  return year === undefined ? '' : normalizeText(textContent(year));
}

export function detailFields(item: Element): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const detail of divsWithClass(item, 'detail')) {
    const [label, value] = splitDetail(textContent(detail));

    if (label !== '') {
      fields[label] = value;
    }
  }

  return fields;
}

export function anonymousScope(username: string | null | undefined): string {
  const trimmed = (username ?? '').trim();

  return trimmed !== '' ? trimmed : 'anonymous';
}
