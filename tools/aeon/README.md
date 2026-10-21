# AEON autonomous engineering foundation

Powered by AEON — Advanced Efficient Optimized Network.

This is the first running, deliberately narrow Vulpine engineering workflow. It
uses the existing AEON Linux host, Python 3.12, Git, Node 22, authenticated Codex
CLI, user systemd, and an isolated PostgreSQL 16 instance. It does not use the
Obsidian vault as a queue or change the production database.

## Operational contract

An objective is persisted in PostgreSQL. The supervisor decomposes this pilot
objective into builder, tester, and reviewer tasks with explicit dependencies,
then dispatches them to three persistent role processes. The builder and reviewer
are real Codex executions; the tester executes deterministic website tools.
Each role receives a separate Git worktree. Only the supervisor applies the
builder's structured output and creates commits.

The current capability is **add or repair regression tests for website security
headers and the legacy configurator redirect**. The scope allowlist is exactly
`tests/security-headers.test.ts`. The scheduler uses a fixed capability-specific
decomposition; it is not yet a general-purpose objective planner. General code
changes, other repositories and deployment adapters require deliberate extension.

Research, this scoped code change, tests, review and reversible worktree operations
are autonomous. Bounded operational authority has an empty allowlist by default.
One narrowly coded exception provisions five named Chromium library packages by
unpacking them into the private engineering runtime; it never runs `apt install`.
Production deployment, destructive operations, financial activity, external
communications and authority changes require executive approval. There is no
deployment executor in this MVP.

The supervisor checks required gate return codes and evidence hashes. It checks
screenshots' dimensions and file size independently of worker claims. Failed
gates block completion. Approval requires the exact candidate and manifest hash,
and rechecks evidence. It records permission but cannot deploy anything.

## Persistence, recovery and budgets

PostgreSQL stores jobs, tasks, attempts, incidents, decisions/events, knowledge
index entries, evidence references and approvals. The cluster is user-owned under
`runtime/pgdata`, accepts no TCP connections, and exposes its Unix socket only in
a mode-0700 directory. This keeps the production cluster out of the workflow.

The queue orders priority then creation time; a PostgreSQL advisory lock prevents
duplicate supervisors. Roles are capability-specific and replaced by a new
process when unavailable. Transient failures receive at most one process restart
and retry. A failed review or quality gate can produce one repair job, using the
actual prior findings. Interrupted tasks can resume once from a verified builder
commit; incomplete worktrees and evidence are archived rather than overwritten.
Other interruptions fail closed. Repeated identical errors produce proposed
instruction improvements in versioned execution exports; they are not silently
promoted to trusted instructions.

Defaults: four model calls per job, one repair generation (at most eight calls in
the chain), 1,800 seconds per job, model invocation deadline 480 seconds,
individual tool deadlines 300–900 seconds, 6 GiB and 200% CPU per command, and
256 tasks per command. Limits stop further execution. Actual reported model token
usage is retained; this ChatGPT-authenticated CLI does not provide an enforceable
dollar ceiling. Token accounting is post-call, not a hard in-call token cap.

systemd supervises process lifetimes and resource limits. **User-manager
filesystem/network namespace settings were experimentally found ineffective on
this host.** `restrict.c` therefore fails closed unless Linux Landlock ABI 4 is
available. It grants file-content read access only to approved runtime/source
paths and system dependencies, and writes only to the assigned worktree/evidence
directories. Offline commands may use TCP port 4317 for an isolated preview;
online Codex/npm commands may also connect to TLS and DNS ports. seccomp denies
process-memory reads/writes. Tests prove production credential files, queue
credentials, unauthorized PostgreSQL access and disallowed TCP connections are denied.

This is not a container or PID namespace. Procfs and Unix IPC remain available for
Node/Chromium child runtimes; Landlock ABI4 does not isolate metadata, signals or
UDP. Do not enable arbitrary untrusted programs or arbitrary agent
shell tools under this boundary. Codex shell, subagents, inherited configuration,
MCP configuration and web search are disabled for these structured generations.

## Obsidian

The configured organizational vault is
`/opt/pai-obsidian/obsidian-vault` on the Vulpine server. `/root/wiki` is a separate,
older vault. No Obsidian application sync configuration was found in the configured
vault's empty `.obsidian` directory. The established integration is command-based
`continuity.mjs` plus a timer exporting selected agent context; that is not evidence
of an Obsidian Sync or Syncthing connection.

`vault-bridge.mjs` runs on the vault host and imports its established path checks,
redaction and atomic-write helpers. It acquires the existing
`.aeon/continuity.lock`, fails on pending foreign transactions, avoids symlinks,
and exports file hashes, attachment metadata, frontmatter and links. To preserve
the existing privacy boundary, raw captures and personal records get metadata
only; selected organizational Markdown bodies enter semantic search.

The PostgreSQL index combines a local BGE sentence embedding's cosine similarity
with PostgreSQL English full-text ranking. Each result carries its original note
path, Obsidian URI, hash, category and index time. Runtime facts, project
instructions, historical decisions and assumptions are distinct categories.
Retrieved notes are historical context and never grant authority. Thirty-day
staleness is flagged; write-back checks the original source hashes for drift.

The bridge adds immutable private outcome records under
`sources/aeon-sessions/vulpine-engineering/`. It appends index/log entries without
rewriting existing note prose. A shared lock, before/after hashes and a durable
roll-forward journal protect concurrent writers; conflicts stop without replacing
changed content. Records distinguish verified facts, evidence, decisions,
historical sources, assumptions/blockers and lessons. `publish: false` and
`private: true` prevent these records from being treated as public knowledge.

Transport is explicitly separate. This installation's first snapshot and outcome
are transferred through the existing operator SSH connections. AEON does not yet
have a verified restricted connection to the Vulpine vault host. For unattended
refresh/write-back, connect a dedicated forced-command SSH identity to just this
bridge or an equivalently authenticated narrow transport. Do not give workers root
SSH keys. No continual cross-host synchronization is claimed.

## Commands on AEON

```sh
cd /home/aeon/factory/engineering/vulpine-supply
PY=/home/aeon/factory/engineering/runtime/venv/bin/python
$PY tools/aeon/aeon.py status
$PY tools/aeon/aeon.py search 'Vulpine AEON project continuity'
$PY tools/aeon/aeon.py enqueue --inject-failure
$PY -m unittest discover -s tools/aeon -v
systemctl --user status aeon-postgres aeon-supervisor
journalctl --user -u aeon-supervisor
```

Later objectives may revise this same scoped regression-test file; the existing
source is supplied to the builder and reviewer. Repairs are linked to their
parent evidence. Expanding to another file requires an explicit capability change.

For a fresh installation on this verified Ubuntu host: unpack Ubuntu PostgreSQL
16/server/client/libpq packages into `runtime/pg`, initialize a new cluster with
SCRAM-authenticated local access/host reject in `runtime/pgdata`, create its private socket directory,
install `requirements.txt` into a dedicated Python environment, and create the
`aeon` database. Install Playwright in `runtime/browser` and its Chromium binaries
in `runtime/browsers`; record the installed versions. Store the queue password in
`runtime/queue.pgpass`, mode 0600, outside worker read paths. Compile `restrict.c` to
`runtime/restrict` with `cc -O2 -Wall -Wextra`. Place an owner-readable copy of the
existing Codex login at `runtime/codex-auth/auth.json`, mode 0600, outside Git.
Install the supplied user units; start PostgreSQL, run `aeon.py init`, import a
verified bridge snapshot with `aeon.py index`, run all safety tests, then start
the supervisor. The first deployment uses fixed verified runtime paths rather
than an untested universal installer.

`systemctl --user stop aeon-supervisor` stops dispatch. Stop any remaining
`aeon-task-*.service` units before maintenance. PostgreSQL can be stopped
independently without touching production. Preserve `runtime/pgdata`, job
evidence and private credentials when moving or backing up this installation.
Services are enabled for the AEON user manager; verify user lingering before
claiming unattended operation across logouts/reboots.

## Quality evidence and publication

The pilot executes a clean dependency install without lifecycle scripts, all
website tests, type checking, a full Next build, and local desktop/mobile browser
checks. Browser requests are limited to the preview and no forms are submitted.
The scoped security gate checks the changed-path allowlist and credential-like
content; security-header tests run as part of the test suite. This is not a full
dependency/CVE audit or penetration test. Database integration tests needing
credentials may be skipped and must be disclosed separately.

After independently checking the evidence, publish a branch and pull request for
human review. This repository is linked to Vercel. The engineering branch must
have `git.deploymentEnabled` set to false before its first push; merging to main
is still a production deployment decision. The system does not auto-merge or
approve its own deployment. An authenticated PR publisher is a separate control
plane action, not a worker capability.
