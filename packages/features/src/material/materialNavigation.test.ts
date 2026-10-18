import type { CourseMaterialNode } from '@altuu/core';

import {
  adjacentMaterials,
  buildDownloadFileName,
  isAudioMaterial,
  materialRoutePath,
  navigableNodes,
  resolveContentLink,
  tronclassAppUrl,
} from './materialNavigation';

function node(
  identifier: string,
  overrides: Partial<CourseMaterialNode> = {},
): CourseMaterialNode {
  return {
    identifier,
    href: `https://uu.nou.edu.tw/base/${identifier}.htm`,
    text: `教材 ${identifier}`,
    readed: false,
    level: 2,
    leaf: true,
    itemDisabled: false,
    ...overrides,
  };
}

const nodes = [
  node('chapter', { leaf: false, href: null, level: 1 }),
  node('a'),
  node('disabled', { itemDisabled: true }),
  node('b'),
  node('c'),
];

describe('material navigation', () => {
  it('builds the route path', () => {
    expect(materialRoutePath('10 1', 'I_SCO/1')).toBe(
      '/courses/10%201/I_SCO%2F1',
    );
  });

  it('keeps only enabled leaves with an href', () => {
    expect(navigableNodes(nodes).map((item) => item.identifier)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('finds previous and next materials', () => {
    expect(adjacentMaterials(nodes, 'a')).toEqual({
      previous: null,
      next: nodes[3],
    });
    expect(adjacentMaterials(nodes, 'b')).toEqual({
      previous: nodes[1],
      next: nodes[4],
    });
    expect(adjacentMaterials(nodes, 'c').next).toBeNull();
    expect(adjacentMaterials(nodes, 'unknown')).toEqual({
      previous: null,
      next: null,
    });
  });

  it('detects audio materials of 語音 courses', () => {
    expect(isAudioMaterial({ courseType: '語音' }, '第一講')).toBe(true);
    expect(isAudioMaterial({ courseType: '語音' }, '面授錄影 第一次')).toBe(
      false,
    );
    expect(isAudioMaterial({ courseType: '影音' }, '第一講')).toBe(false);
    expect(isAudioMaterial(null, '第一講')).toBe(false);
  });
});

describe('resolveContentLink', () => {
  const activeHref = 'https://uu.nou.edu.tw/base/a.htm';

  it('reloads when the link is the current material', () => {
    expect(resolveContentLink(nodes, 'a', activeHref, activeHref)).toEqual({
      kind: 'reload',
    });
  });

  it('selects another material of the course', () => {
    expect(
      resolveContentLink(
        nodes,
        'a',
        activeHref,
        'https://uu.nou.edu.tw/base/b.htm',
      ),
    ).toEqual({ kind: 'select', identifier: 'b' });
  });

  it('renders same-host pages in place', () => {
    expect(
      resolveContentLink(
        nodes,
        'a',
        activeHref,
        'https://uu.nou.edu.tw/base/a_page2.htm',
      ),
    ).toEqual({
      kind: 'subpage',
      url: 'https://uu.nou.edu.tw/base/a_page2.htm',
    });
  });

  it('opens other hosts externally', () => {
    expect(
      resolveContentLink(nodes, 'a', activeHref, 'https://example.com/'),
    ).toEqual({ kind: 'external', url: 'https://example.com/' });
    expect(
      resolveContentLink(nodes, 'a', null, 'https://uu.nou.edu.tw/x'),
    ).toEqual({ kind: 'external', url: 'https://uu.nou.edu.tw/x' });
  });

  it('maps TronClass links to the app scheme', () => {
    expect(tronclassAppUrl('https://tronclass.nou.edu.tw/course/1')).toBe(
      'tronclass://navigate?url=https%3A%2F%2Ftronclass.nou.edu.tw%2Fcourse%2F1',
    );
    expect(tronclassAppUrl('https://example.com/')).toBeNull();
  });
});

describe('buildDownloadFileName', () => {
  const base = {
    downloadFileName: null,
    downloadFileExtension: null,
    isPdf: false,
    title: '',
  };

  it('prefers the server file name', () => {
    expect(
      buildDownloadFileName({ ...base, downloadFileName: 'ch1.pdf' }),
    ).toBe('ch1.pdf');
  });

  it('derives a safe name from the title', () => {
    expect(
      buildDownloadFileName({
        ...base,
        isPdf: true,
        title: ' 第一章:  導論/概要 ',
      }),
    ).toBe('第一章_ 導論_概要.pdf');
    expect(
      buildDownloadFileName({
        ...base,
        downloadFileExtension: 'pptx',
        title: '簡報.PPTX',
      }),
    ).toBe('簡報.PPTX');
  });

  it('falls back to material.<ext>', () => {
    expect(buildDownloadFileName(base)).toBe('material.bin');
  });
});
