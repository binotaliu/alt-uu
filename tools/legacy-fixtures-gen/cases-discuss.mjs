import crypto from 'node:crypto';
import { fixture } from './lib.mjs';

const UU = 'https://uu.nou.edu.tw';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const DA = 'Feature/Discuss/DiscussApiTest.php';
const D = 'discuss';
const ok = (data) => ({ code: 0, message: 'success', data });

fixture({
    domain: D, name: 'boards-list', ext: 'json',
    input: ok({ list: [{ board_id: 'B-1', board_name: '課程討論', subject_cnt: 3, is_bulletin: 0, read_flag: 0 }] }),
    source: `${DA}:13`, cls: 'AltUU\\Domains\\Discuss\\Actions\\ListBoards (via GET /api/discuss/boards?cid=1001)',
    note: 'Upstream action get-board-list. Legacy also asserts my-course-list is NOT requested.',
    cases: [{ name: 'can load discuss boards from dedicated endpoint', input: { cid: '1001' }, partial: true, expected: { courseId: '1001', 'boards[0]': { boardId: 'B-1', boardName: '課程討論', subjectCount: 3, allowPost: true, hasNewPost: true }, requests: { notSent: 'action=my-course-list', sent: 'action=get-board-list' } } }],
    golden: { kind: 'endpoint', path: '/api/discuss/boards?cid=1001', fakes: [{ match: `${UU}/xmlapi/index.php?action=get-board-list*`, file: 'boards-list.json' }] },
});

fixture({
    domain: D, name: 'posts-with-whispers',
    inputs: [
        { suffix: 'replies', ext: 'json', content: ok({ list: [{ floor: 1, node: 'N-POST-1', realname: '測試', content: '<script>alert(1)</script>hello', post_date: '2024-01-01', push: 3, hit: 1, whispercnt: 1, i_pushed: 1 }] }) },
        { suffix: 'whispers', ext: 'json', content: ok({ list: [{ wid: 'w-1', realname: '小明', content: '<script>alert(1)</script>hi', create_time_description: '1 分鐘前' }] }) },
    ],
    source: `${DA}:61`, cls: 'AltUU\\Domains\\Discuss\\Actions\\ListPosts (via GET /api/discuss/posts)',
    note: 'Upstream get-board-reply-list (.replies.json) and board-whisper-handler (.whispers.json, requested with nid=N-POST-1). Post content is HTML-sanitized, whisper content is returned verbatim.',
    cases: [{ name: 'fetches thread posts and whispers from dedicated endpoint and sanitizes content', input: { query: 'cid=1001&bid=B-1&nid=N-99' }, partial: true, expected: { courseId: '1001', boardId: 'B-1', nodeId: 'N-99', 'posts[0]': { content: '<p>hello</p>', push: 3, liked: true, whisperCount: 1, node: 'N-POST-1', 'whispers[0].content': '<script>alert(1)</script>hi' }, responseMissingKey: 'whispers' } }],
    golden: { kind: 'endpoint', path: '/api/discuss/posts?cid=1001&bid=B-1&nid=N-99', fakes: [{ match: `${UU}/xmlapi/index.php?action=get-board-reply-list*`, file: 'posts-with-whispers.replies.json' }, { match: `${UU}/xmlapi/index.php?action=board-whisper-handler*`, file: 'posts-with-whispers.whispers.json' }] },
});

fixture({
    domain: D, name: 'nodes-blocked', ext: 'json',
    input: ok({ list: [{ node: 'N-1', subject: '文章一', read: false, reply: 2 }, { node: 'N-2', subject: '文章二', read: true, reply: 0 }] }),
    source: `${DA}:226`, cls: 'AltUU\\Domains\\Discuss\\Actions\\ListNodes (via GET /api/discuss/nodes)',
    note: `Local blocked_contents row: board_hash=sha256('B-1')=${sha('B-1')}, node_hash=sha256('N-1')=${sha('N-1')}, reason 'c'.`,
    cases: [{ name: 'includes isBlocked and blockedReason in node list response', input: { query: 'cid=1001&bid=B-1', blockedContents: [{ boardId: 'B-1', nodeId: 'N-1', reason: 'c' }] }, partial: true, expected: { 'nodes[0]': { node: 'N-1', isBlocked: true, blockedReason: 'c' }, 'nodes[1]': { node: 'N-2', isBlocked: false, blockedReason: null } } }],
    golden: { kind: 'endpoint', path: '/api/discuss/nodes?cid=1001&bid=B-1', blocked: [{ board: 'B-1', node: 'N-1', reason: 'c' }], fakes: [{ match: `${UU}/xmlapi/index.php?action=get-board-node-list*`, file: 'nodes-blocked.json' }] },
});

fixture({
    domain: D, name: 'posts-blocked', ext: 'json',
    input: ok({ list: [{ floor: 1, node: 'P-1', content: 'hello', post_date: '2024-01-01', push: 0, whispercnt: 0 }, { floor: 2, node: 'P-2', content: 'world', post_date: '2024-01-02', push: 0, whispercnt: 0 }] }),
    source: `${DA}:273`, cls: 'AltUU\\Domains\\Discuss\\Actions\\ListPosts (via GET /api/discuss/posts)',
    note: `Local blocked_contents row: board_hash=sha256('B-1'), node_hash=sha256('P-2')=${sha('P-2')}, reason 'i'.`,
    cases: [{ name: 'includes isBlocked and blockedReason in post list response', input: { query: 'cid=1001&bid=B-1&nid=N-99', blockedContents: [{ boardId: 'B-1', nodeId: 'P-2', reason: 'i' }] }, partial: true, expected: { 'posts[0]': { node: 'P-1', isBlocked: false, blockedReason: null }, 'posts[1]': { node: 'P-2', isBlocked: true, blockedReason: 'i' } } }],
    golden: { kind: 'endpoint', path: '/api/discuss/posts?cid=1001&bid=B-1&nid=N-99', blocked: [{ board: 'B-1', node: 'P-2', reason: 'i' }], fakes: [{ match: `${UU}/xmlapi/index.php?action=get-board-reply-list*`, file: 'posts-blocked.json' }] },
});

const LN = 'Unit/ListNodesTest.php';
fixture({
    domain: D, name: 'nodes-read-state', ext: 'json',
    input: ok({ list: [{ node: 'N-1', subject: 'Test 1', read: false, realname: 'Tester', reply: 3, push: 10 }, { node: 'N-2', subject: 'Test 2', read: true, realname: 'Tester', reply: 1, push: 0 }] }),
    source: `${LN}:13`, cls: 'AltUU\\Domains\\Discuss\\Actions\\ListNodes',
    note: 'Action called as ($cid="1001", $bid="B-1", $keyword=""); upstream get-board-node-list with offset=0,size=50,bid=B-1,keyword=.',
    cases: [{ name: 'maps node read state from discuss API response', input: { cid: '1001', bid: 'B-1', keyword: '' }, partial: true, expected: { nodesCount: 2, 'nodes[0].isRead': false, 'nodes[1].isRead': true } }],
    golden: { kind: 'endpoint', path: '/api/discuss/nodes?cid=1001&bid=B-1', fakes: [{ match: `${UU}/xmlapi/index.php?action=get-board-node-list*`, file: 'nodes-read-state.json' }] },
});

const LP = 'Unit/ListPostsTest.php';
fixture({
    domain: D, name: 'posts-attachments', ext: 'json',
    input: ok({ list: [{ floor: 1, subject: 'Hello', content: '<p>Body</p>', attachment: [{ filename: 'file1.pdf', href: 'https://example.com/file1.pdf' }, { name: 'file2.docx', url: 'https://example.com/file2.docx' }] }] }),
    source: `${LP}:11`, cls: 'AltUU\\Domains\\Discuss\\Actions\\ListPosts',
    note: 'Action called as ($cid="1001", $bid="B-1", $nid="N-9"); attachments accept filename|name and href|url keys.',
    cases: [{ name: 'maps attachments from discuss API response into the view model', input: { cid: '1001', bid: 'B-1', nid: 'N-9' }, partial: true, expected: { postsCount: 1, 'posts[0].attachments': [{ filename: 'file1.pdf', href: 'https://example.com/file1.pdf' }, { filename: 'file2.docx', href: 'https://example.com/file2.docx' }] } }],
    golden: { kind: 'endpoint', path: '/api/discuss/posts?cid=1001&bid=B-1&nid=N-9', fakes: [{ match: `${UU}/xmlapi/index.php?action=get-board-reply-list*`, file: 'posts-attachments.json' }] },
});

// ---- mutations
const mutCalls = [
    { name: 'create post', method: 'POST', path: '/api/discuss/posts', json: { bid: 'B-1', subject: '新文章', content: '文章內容' } },
    { name: 'update post', method: 'PATCH', path: '/api/discuss/posts/P-1', json: { subject: '更新標題', content: '更新內容' } },
    { name: 'delete post', method: 'DELETE', path: '/api/discuss/posts/P-1' },
    { name: 'like post', method: 'POST', path: '/api/discuss/posts/N-1/like', json: { bid: 'B-1' } },
    { name: 'unlike post', method: 'POST', path: '/api/discuss/posts/N-1/unlike', json: { bid: 'B-1' } },
    { name: 'create whisper', method: 'POST', path: '/api/discuss/whispers', json: { bid: 'B-1', nid: 'N-1', content: '留言' } },
    { name: 'update whisper', method: 'PATCH', path: '/api/discuss/whispers/W-1', json: { bid: 'B-1', nid: 'N-1', content: '編輯留言' } },
    { name: 'delete whisper', method: 'DELETE', path: '/api/discuss/whispers/W-1', json: { bid: 'B-1', nid: 'N-1' } },
    { name: 'set read', method: 'POST', path: '/api/discuss/read/P-1' },
];
const mutUpstream = [
    { match: `${UU}/xmlapi/index.php?action=add-course-post*`, json: { code: 0, message: 'ok', data: { post_id: 'P-1' } } },
    { match: `${UU}/xmlapi/index.php?action=mod-course-post*`, json: { code: 0, message: 'ok' } },
    { match: `${UU}/xmlapi/index.php?action=del-course-post*`, json: { code: 0, message: 'ok' } },
    { match: `${UU}/mooc/controllers/forum_ajax.php*`, json: { code: 0, message: 'ok' } },
    { match: `${UU}/xmlapi/index.php?action=board-whisper-handler*`, json: { code: 0, message: 'ok', data: { list: [] } } },
    { match: `${UU}/xmlapi/index.php?action=set-forum-read*`, json: { code: 0, message: 'ok' } },
];
fixture({
    domain: D, name: 'mutations', ext: 'json',
    input: { calls: mutCalls, upstreamResponses: mutUpstream },
    source: `${DA}:145`, cls: 'AltUU\\Domains\\Discuss\\Actions\\* (create/update/delete post, like/unlike, whisper CRUD, set read)',
    note: 'Request sequence + faked upstream replies. Golden also records the upstream requests (method/url/body) the PHP made, which is the parity target for the TS port.',
    cases: [{ name: 'can create/update/delete/like discuss posts and manage whispers', partial: true, expected: { everyCallSucceeds: true, 'create post.json': { 'data.post_id': 'P-1' }, upstreamActionsHit: ['add-course-post', 'mod-course-post', 'del-course-post', '/mooc/controllers/forum_ajax.php', 'board-whisper-handler', 'set-forum-read'] } }],
    golden: { kind: 'endpoint', calls: mutCalls, recordRequests: true, fakes: mutUpstream },
});
