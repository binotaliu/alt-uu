import { fixture } from './lib.mjs';

const R = 'Unit/Diagnostics/DiagnosticRedactorTest.php';
const CLS = 'App\\Services\\Diagnostics\\DiagnosticRedactor';
const REDACTED = '[已遮蔽]';
const secretKeys = ['password', 'ticket', 'session_idx', 'cookies', 'Set-Cookie', 'authorization', 'access_token', 'refreshToken', 'apiKey', 'signedPayload', 'receipt', 'APP_KEY'];
const idKeys = ['username', 'studentId', 'displayName', 'nickname', 'email'];
const cases = [];
const add = (name, op, input, expect, salt = 'test-salt') => cases.push({ name, op, salt, input, expect });

secretKeys.forEach((k) => add(`drops secret-bearing key: ${k}`, 'redact', { [k]: 'super-secret-value' }, { [k]: REDACTED, valueNotContains: 'super-secret-value' }));
idKeys.forEach((k) => add(`pseudonymizes personal identifier key: ${k}`, 'redact', { [k]: 'u1001' }, { [k]: { startsWith: 'user#', notContains: 'u1001' } }));
add('keeps our own local account id', 'redact', { accountId: 42, account_id: 7 }, { accountId: 42, account_id: 7 });
add('produces a stable handle for the same identifier', 'pseudonymizeStable', ['u1001', 'u1001', 'U1001'], { equalHandles: [[0, 1], [2, 1]], note: 'pseudonymize("u1001") twice equal; "U1001" equals "u1001" (case-insensitive)' });
add('produces different handles across installs', 'pseudonymizeSalts', { value: 'u1001', saltA: 'salt-a', saltB: 'salt-b' }, { handlesDiffer: true });
add('redacts nested structures recursively', 'redact', { session: { ticket: 'abc123', profile: { username: 'u1001', displayName: '測試教師甲' }, cookies: { WM: 'deadbeef' } }, status: 500 }, { 'session.ticket': REDACTED, 'session.cookies': REDACTED, 'session.profile.username': { startsWith: 'user#' }, 'session.profile.displayName': { startsWith: 'user#' }, status: 500 });
add('sweeps secrets out of free-text response bodies', 'redactText', '{"code":403,"ticket":"abc123xyz","username":"u1001","message":"access denied"}', { notContains: ['abc123xyz', 'u1001'], contains: ['access denied', '403'] });
add('pseudonymizes account handles anywhere in free text', 'redactText', 'Login failed for u123456 after 3 attempts', { notContains: ['u123456'], contains: ['user#', 'after 3 attempts'] });
add('pseudonymizes bare e-mail addresses in free text', 'redactText', 'contact student@nou.edu.tw for details', { notContains: ['student@nou.edu.tw'], contains: ['user#'] });
add('strips credential query parameters from urls but keeps the diagnostic part', 'redactUrl', 'https://uu.nou.edu.tw/xmlapi/index.php?action=getCourseList&ticket=SECRET123&ua=Mozilla&page=2', { notContains: ['SECRET123'], contains: ['uu.nou.edu.tw/xmlapi/index.php', 'action=getCourseList', 'page=2'] });
add('leaves an ordinary message untouched', 'redactText', '讀取作業列表失敗。', { equals: '讀取作業列表失敗。' });
add('redactSecrets drops credentials from html source but leaves identifiers and structure alone', 'redactSecrets', '<meta name="viewport" content="width=1"><a href="https://uu.nou.edu.tw/x?ticket=abc123&page=2">u</a><script>var cfg = {"password":"hunter2"};</script> user u1001 mail@example.com', { contains: ['<meta name="viewport"', 'page=2', 'u1001', 'mail@example.com'], notContains: ['abc123', 'hunter2'] });
add('redactSecrets returns empty text unchanged', 'redactSecrets', '', { equals: '' });
add('redactText masks a credential in a URL query string inside free text', 'redactText', '<a href="https://uu.nou.edu.tw/learn/x.php?ticket=abc123&page=2&session_idx=idx9">go</a>', { contains: ['page=2', 'uu.nou.edu.tw/learn/x.php'], notContains: ['abc123', 'idx9'] });

fixture({
    domain: 'diagnostics', name: 'redactor-cases', ext: 'json',
    input: cases.map(({ name, op, salt, input }) => ({ name, op, salt, input })),
    source: `${R}:12-150`, cls: CLS,
    note: `op = redact(array) | redactText | redactUrl | redactSecrets | pseudonymizeStable | pseudonymizeSalts. Salt "test-salt" unless given. REDACTED constant = "${REDACTED}". Golden holds the exact PHP output (including pseudonym handles for salt "test-salt").`,
    cases: cases.map(({ name, op, salt, input, expect }) => ({ name, input: { op, salt, input }, expected: expect })),
    golden: { kind: 'redactor', file: 'redactor-cases.json' },
});
