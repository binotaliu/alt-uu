import { describe, expect, it } from 'vitest';

import type { HunguPageResult } from '../../../hungu';
import { parseHomeworkItems, parseSelfExamItems } from '../coursePages';

const baseUrl = 'https://uu.example';

function page(body: string): HunguPageResult {
  return { status: 200, body } as HunguPageResult;
}

describe('closed items', () => {
  it('has no homework action URL once the pay button lost its active class', () => {
    const html = `<div class="box2" data-type="homework">
      <div class="title"><span title="作業一">作業一</span></div>
      <div class="process-btn pay" onclick="togo('1+1+t', false, this)">
        <div class="main-text">已截止</div>
      </div>
    </div>`;

    expect(parseHomeworkItems(page(html), baseUrl)[0]?.actionUrl).toBeNull();
  });

  it('has no self exam action URL once the pay button lost its active class', () => {
    const html = `<div class="box2">
      <span title="練習一">練習一</span>
      <div class="process-btn pay" onclick="togo('e1+1+t', false, this)">
        <div class="main-text">已截止</div>
      </div>
    </div>`;

    expect(parseSelfExamItems(page(html), baseUrl)[0]?.actionUrl).toBeNull();
  });
});
