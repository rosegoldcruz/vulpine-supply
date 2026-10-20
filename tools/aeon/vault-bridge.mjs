// Runs on the vault host. Uses the established shared flock and redaction helpers.
import { readFileSync, readdirSync, lstatSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { safePath, redact, assertSafe, atomicWrite } from '/opt/vulpine-platform/scripts/vault-memory.mjs';
const vault = '/opt/pai-obsidian/obsidian-vault';
const hash = s => createHash('sha256').update(s).digest('hex');
if (!process.argv.includes('--locked')) {
  const p = spawnSync('flock', ['-n', '-E', '75', vault + '/.aeon/continuity.lock', process.execPath, ...process.argv.slice(1), '--locked'], { stdio: 'inherit' });
  process.exit(p.status ?? 1);
}
const [action, input] = process.argv.slice(2);
const state = safePath(vault, '.aeon/engineering');
mkdirSync(state, { recursive: true, mode: 0o700 });
const journal = state + '/pending.json';
function recover() {
  if (!existsSync(journal)) return;
  for (const op of JSON.parse(readFileSync(journal, 'utf8'))) {
    if (!/^(sources\/aeon-sessions\/vulpine-engineering\/[a-f0-9]{12}\.md|index\.md|log\.md)$/.test(op.path)) throw new Error('Invalid journal scope');
    const path = safePath(vault, op.path);
    const current = existsSync(path) ? hash(readFileSync(path)) : null;
    if (current === hash(op.content)) continue;
    if (current !== op.before) throw new Error('Concurrent vault edit: preserve journal and reconcile');
    atomicWrite(path, op.content);
  }
  unlinkSync(journal);
}
recover();
if (readdirSync(vault + '/.aeon/transactions').length) throw new Error('Existing continuity transaction pending; recover through its owning checkout first');
if (action === 'snapshot') {
  const rows = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const full = resolve(dir, name), st = lstatSync(full);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { walk(full); continue; }
      const path = relative(vault, full);
      const bytes = readFileSync(full);
      const md = extname(full).toLowerCase() === '.md';
      // Existing privacy boundary: immutable raw/personal captures get metadata only.
      const selected = /^(projects|concepts|companies|entities|commands|skills)\//.test(path) || ['SCHEMA.md','CLAUDE.md'].includes(path);
      const text = md && selected && st.size < 180000 ? redact(bytes.toString('utf8')) : '';
      const metadata = { size: st.size, modified: st.mtime.toISOString(), attachment: !md,
        frontmatter: text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? null,
        links: [...text.matchAll(/\[\[([^\]]+)\]\]|\]\(([^)]+)\)/g)].map(m => m[1] ?? m[2]),
        source_host: 'vulpine', vault_root: vault, content_indexed: !!text };
      rows.push({ path, sha256: hash(bytes), category: /rules|CLAUDE|SCHEMA/.test(path) ? 'project_instruction' : /sessions|decisions/.test(path) ? 'historical_decision' : 'unverified_assumption', text, metadata });
    }
  }
  walk(vault);
  process.stdout.write(JSON.stringify(rows));
} else if (action === 'write-outcome') {
  const result = JSON.parse(readFileSync(input, 'utf8'));
  assertSafe(result);
  if (!/^[a-f0-9]{12}$/.test(result.job) || !Array.isArray(result.facts) || !result.facts.length || !Array.isArray(result.sources)) throw new Error('Invalid evidence record');
  for (const source of result.sources) {
    if (hash(readFileSync(safePath(vault, source.path))) !== source.sha256) throw new Error('Source changed since retrieval; reconcile before write-back');
  }
  const path = 'sources/aeon-sessions/vulpine-engineering/' + result.job + '.md';
  const date = new Date().toISOString();
  const content = `---\ntitle: AEON engineering ${result.job}\ncreated: ${date.slice(0,10)}\nupdated: ${date.slice(0,10)}\ntype: source\ntags: [aeon, vulpine, execution]\nconfidence: high\ncontested: false\npublish: false\nprivate: true\n---\n# AEON engineering ${result.job}\n\nPowered by AEON — Advanced Efficient Optimized Network.\n\n## Verified runtime facts\n${result.facts.map(x => '- ' + x).join('\n')}\n\n## Evidence\n${result.evidence.map(x => '- ' + x).join('\n')}\n\n## Decisions\n${result.decisions.map(x => '- ' + x).join('\n')}\n\n## Historical sources\n${result.sources.map(x => '- [[' + x.path.replace(/\.md$/,'') + ']] — SHA256 ' + x.sha256).join('\n')}\n\n## Unverified assumptions and blockers\n${result.blockers.map(x => '- ' + x).join('\n')}\n\n## Lessons and proposed instruction improvements\n${result.lessons.map(x => '- ' + x).join('\n')}\n`;
  const target = safePath(vault, path);
  if (existsSync(target)) {
    if (readFileSync(target, 'utf8') !== content) throw new Error('Existing outcome is immutable; use a new record');
  } else {
    const ops = [{path, before: null, content}];
    for (const [name, entry] of [['index.md', `\n- [[${path.replace(/\.md$/,'')}|AEON engineering ${result.job}]]\n`], ['log.md', `\n- ${date}: Added private engineering outcome [[${path.replace(/\.md$/,'')}]].\n`]]) {
      const old = readFileSync(safePath(vault,name), 'utf8');
      ops.push({path: name, before: hash(old), content: old + entry});
    }
    atomicWrite(journal, JSON.stringify(ops));
    recover();
  }
  console.log(JSON.stringify({ path, sha256: hash(readFileSync(target)), recorded: true }));
} else throw new Error('Usage: snapshot | write-outcome <reviewed-evidence.json>');
