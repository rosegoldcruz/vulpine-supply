# AEON private group-chat console

This adapter lives in the existing `tools/aeon` package. It reuses its Python
runtime, authenticated Codex CLI, restricted execution helper, PostgreSQL queue,
job/task/event contracts and three engineering workers. It does not start another
supervisor or change website routes, production services, the engineering edit
scope or the deployment adapter. A narrow foundation fix makes worker retries
share their original deadline rather than restarting the remaining timeout.

## What executes

Ordinary text invokes the real Codex CLI with a JSON output schema, read-only
sandbox, no inherited user configuration, shell disabled, web disabled and
multi-agent tools disabled. Role-specific prompts receive the recent conversation,
earlier role replies, live factory jobs and recent events. These are advisory
model replies, not claims that the role ran tools. The existing factory builder
and reviewer invoke Codex; its tester runs actual website commands.

`@Orchestrator`, `@Builder` (`@Coder` alias), `@Tester`, `@Reviewer` and `@everyone`
route real chat invocations. Everyone runs sequentially so later roles can address
earlier replies. Rooms are persistent conversation contexts within one private
operator account; they are not tenant isolation boundaries or separate credentials.

`/status` records a live queue snapshot. `/run` creates a persistent action preview
for the existing website security-regression workflow. Confirming it queues the
fixed objective and three tasks atomically, bound to the preview's source commit
and scope. Rejecting it queues nothing. Replays and stale approvals fail closed.
This is permission to run a test-only engineering job, never production approval.
The adapter does not write the factory's deployment approvals table.

The only engineering edit scope remains `tests/security-headers.test.ts`. The
planner remains the foundation's fixed builder → tester → reviewer workflow.
Researcher, Designer, arbitrary shell, file edits through chat, financial actions,
external messaging, deployments and authority changes are unavailable. Unsupported
endpoints reject rather than simulating success. An active factory job is not
cancelled by a chat control. The only cancellation control cancels queued chat
turns and says so explicitly.

## Runtime and access

- Service: `systemctl --user status aeon-console`
- Listen address: `127.0.0.1:8766` on AEON, accessed through SSH port forwarding.
- Runtime: `/home/aeon/factory/engineering/runtime/venv/bin/python`
- Source: `/home/aeon/factory/engineering/vulpine-supply/tools/aeon/console.py`
- Private state/logs: `/home/aeon/factory/engineering/runtime/chat`
- Operator token: `runtime/chat/operator-token`, mode 0600; never commit or publish.
- Existing supervisor is untouched. Restart only `aeon-console` to update this UI.

Forward `127.0.0.1:8766` to AEON's `127.0.0.1:8766`, then open
`http://127.0.0.1:8766/`. Paste the operator token into the login form. Authentication
uses an HTTP-only SameSite=Strict cookie. The token never goes in a URL or browser
localStorage. The delivery includes a Windows launcher that opens the tunnel and
copies the token to the clipboard. Clear the clipboard after login if desired.

The HTTP service uses Python's standard library and is deliberately private; do
not expose it directly to the internet. Public/multiuser deployment requires a
production gateway with TLS, individual operator identity, session revocation,
per-user authorization and stronger connection limits. This implementation makes
no claim to those capabilities.

## Persistence, budgets and failures

Additive tables in the isolated engineering database: `chat_rooms`,
`chat_messages`, `chat_turns`, `chat_actions`. Existing tables and data are preserved.
The server reserves at most eight queued/running turns, 40 invocation reservations
per rolling 24 hours, and a 180-second execution limit per turn. Cancelled and failed
reservations still count. Each submission has an idempotency key. No hard dollar
or in-call token ceiling is available through the existing CLI login; actual
reported token usage is recorded after each successful call. Factory jobs retain
their four-call/1,800-second budget and bounded repair behavior. Console submissions
allow only one queued/running factory job and at most three new factory jobs per
rolling 24 hours. Completed worktrees remain preserved by the foundation; automated
retention/cleanup is not implemented. This limits console-triggered disk growth
without deleting pre-existing work or evidence.

Chat failures and interrupted calls remain visible. Interrupted turns are not
automatically replayed. A transient invocation can live until its 180-second
deadline if the console dies; on restart its DB row is marked interrupted, not
successful. Requests never approve jobs from model output. Restarting the console
does not restart the factory, PostgreSQL, Hermes or the local website process.
Deploying the retry-deadline fix requires restarting only the idle engineering
supervisor after verifying its queue has no active work.

HTTP validation enforces exact loopback Host values, same-origin JSON mutations,
authenticated APIs, body limits and login throttling. There are no external UI
assets, unsafe inline scripts, raw HTML interpolation, browser-held API keys or
arbitrary file/terminal routes. Evidence paths are confined to the relevant job,
symlinks rejected, content bounded and secrets redacted. Gate logs are rehashed
against their recorded digest. Manifests are checked against the database record;
this verifies consistency, not third-party attestation. Chat logs are similarly
checked against the hash stored with each successful reply.

## API contract

All `/api/*` routes except login require the private operator token/cookie.

| Method | Route | Behavior |
|---|---|---|
| POST | `/api/login` | Authenticate; rate-limited failures; set session cookie |
| POST | `/api/logout` | Clear browser cookie; the shared operator token remains valid |
| GET | `/api/state?room=...` | Rooms, messages, turn states, actions, real jobs/tasks/events, budgets |
| POST | `/api/rooms` | Create a persistent conversation |
| POST | `/api/messages` | Persist/idempotently route advice, `/status`, or `/run` preview |
| POST | `/api/decision` | Confirm/reject pending fixed-scope factory action once |
| POST | `/api/cancel` | Cancel queued chat turn only |
| GET | `/api/evidence?job=...&key=...` | Manifest or fixed tester gate log with integrity result |
| GET | `/api/chat-evidence?turn=...` | Completed model execution log with integrity result |

## Verification and rollback

Run from `tools/aeon` with the existing Python runtime:
`python -m unittest test_console test_aeon -v`. Console tests use a fresh disposable
PostgreSQL schema; they do not call models or queue production jobs. Live acceptance
separately verifies actual CLI replies and a real factory job. Browser acceptance
uses the already installed Playwright/Chromium runtime with external requests
blocked, covering desktop/mobile, persistence, preview/reject, evidence, and XSS.

To disable access, stop and disable `aeon-console`, then close the SSH tunnel.
Leave the additive tables and runtime logs intact to preserve evidence. No rollback
of the supervisor or production website is necessary. To rotate the shared token,
stop the console, remove only its `operator-token` file, then restart; existing
browser sessions cease to authenticate.

## Source adaptation

The provided Grok demonstration supplied useful concepts: group rooms, mentions,
role perspectives, `ChatMessage`/`TaskStep` records, handoff cards and an evidence
panel. The adapter adapts those contracts and interaction patterns. Its insecure
simulation engine and provider claims are not imported. The UI is rebuilt with
local assets and text-node rendering. No xAI product compatibility is claimed.
