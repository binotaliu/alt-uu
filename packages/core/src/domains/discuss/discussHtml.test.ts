import { describe, expect, it } from 'vitest';
import {
    adjustColorForDark,
    adjustStyleForDark,
    parseDiscussHtml,
    parseInlineStyle,
} from './discussHtml';
import { sanitizeDiscussHtml } from './sanitizeDiscussHtml';

describe('parseDiscussHtml', () => {
    it('builds a tree from sanitised output with parsed inline styles', () => {
        const html = sanitizeDiscussHtml(
            '<p style="color:red;text-align:center">a <b>b</b><br>c</p><img src="https://x.example/a.png" alt="a">',
        );
        const nodes = parseDiscussHtml(html);

        expect(nodes).toHaveLength(2);
        expect(nodes[0]).toMatchObject({
            type: 'element',
            tag: 'p',
            style: { color: '#FF0000', 'text-align': 'center' },
        });
        expect((nodes[1] as { children: unknown[] }).children[0]).toMatchObject(
            {
                tag: 'img',
                attributes: { src: 'https://x.example/a.png', alt: 'a' },
            },
        );
    });

    it('keeps entity-decoded text', () => {
        expect(parseDiscussHtml('<p>a &amp; b</p>')).toEqual([
            {
                type: 'element',
                tag: 'p',
                attributes: {},
                style: {},
                children: [{ type: 'text', text: 'a & b' }],
            },
        ]);
    });
});

describe('parseInlineStyle', () => {
    it('splits declarations and keeps quoted font lists', () => {
        expect(
            parseInlineStyle("font-family:'A B', Arial;font-weight:bold;"),
        ).toEqual({ 'font-family': "'A B', Arial", 'font-weight': 'bold' });
    });
});

describe('dark mode colours', () => {
    it('lightens dark text and darkens light backgrounds', () => {
        expect(adjustColorForDark('#000000', 'color')).toBe('#f2f2f2');
        expect(adjustColorForDark('#ffffff', 'background-color')).toBe(
            '#0d0d0d',
        );
    });

    it('leaves suitable colours alone', () => {
        expect(adjustColorForDark('#eeeeee', 'color')).toBe('#eeeeee');
        expect(adjustColorForDark('#111111', 'background-color')).toBe(
            '#111111',
        );
        expect(adjustColorForDark('notacolor', 'color')).toBe('notacolor');
    });

    it('adds a text colour to a remapped background without one', () => {
        expect(
            adjustStyleForDark({ 'background-color': '#ffffcc' }),
        ).toMatchObject({ color: '#f2f2f2' });
        expect(adjustStyleForDark({ 'text-align': 'left' })).toEqual({
            'text-align': 'left',
        });
    });
});
