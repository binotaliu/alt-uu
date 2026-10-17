import type { AnyNode, Element } from 'domhandler';
import { isTag } from 'domhandler';
import { findAll, getAttributeValue, textContent } from 'domutils';
import { parseDocument } from 'htmlparser2';

/** Parses an HTML page into top-level nodes (htmlparser2, lenient). */
export function parseHtml(html: string): AnyNode[] {
    return parseDocument(html).children;
}

/** Descendant elements in document order matching the predicate. */
export function findElements(
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

/** XPath `contains(concat(" ", normalize-space(@class), " "), " x ")`. */
export function hasClassToken(element: Element, className: string): boolean {
    return (getAttributeValue(element, 'class') ?? '')
        .split(/[ \t\n\r]+/)
        .includes(className);
}

/** XPath `contains(@class, "x")` (substring match). */
export function classContains(element: Element, needle: string): boolean {
    return (getAttributeValue(element, 'class') ?? '').includes(needle);
}

export function attr(element: Element, name: string): string | null {
    return getAttributeValue(element, name) ?? null;
}

export function hasAttr(element: Element, name: string): boolean {
    return Object.prototype.hasOwnProperty.call(element.attribs, name);
}

export function nodeText(node: AnyNode | AnyNode[]): string {
    return textContent(node);
}

/** `preg_replace('/[\s\x{00A0}\x{3000}]+/u', ' ', trim(...))` then trim. */
export function normalizeText(value: string | null | undefined): string {
    return (value ?? '')
        .trim()
        .replace(/[\s\u00a0\u3000]+/gu, ' ')
        .trim();
}

export { isTag };
