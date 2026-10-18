import fs from 'node:fs';
import path from 'node:path';
import { OUT, registry, phpCases } from './lib.mjs';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ['cases-course-material', 'cases-course-api', 'cases-portal', 'cases-discuss', 'cases-moderation', 'cases-misc', 'cases-hungu', 'cases-diag']) {
    await import(`./${f}.mjs`);
}
fs.writeFileSync(new URL('./manifest.json', import.meta.url), JSON.stringify({ out: OUT, cases: phpCases }, null, 2));
fs.writeFileSync(new URL('./registry.json', import.meta.url), JSON.stringify(registry, null, 2));
const byDomain = {};
for (const r of registry) byDomain[r.domain] = (byDomain[r.domain] ?? 0) + 1;
console.log(byDomain, registry.length, 'fixtures,', phpCases.length, 'golden cases');
await import('./readme.mjs');
for (const f of fs.readdirSync(new URL('./static/', import.meta.url))) fs.copyFileSync(new URL(`./static/${f}`, import.meta.url), `${OUT}/${f}`);
