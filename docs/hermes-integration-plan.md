# Hermes Integration Plan

Hermes + Obsidian is the existing RAG/knowledge system. Do not replace it.

Hermes provides retrieval and assistant context. It is not authoritative operational storage.

## Authorized Future Access

Vulpine may eventually provide Hermes controlled access to:

- project documents
- supplier documents
- product specifications
- uploaded plans/specifications
- historical operational context where authorized
- customer-safe proposal context where authorized
- approved resources and training materials

## Data Hermes Must Not Own

Hermes must not become authoritative storage for:

- financial calculations
- quote state
- project state
- order state
- commissions
- payments
- permissions
- supplier cost
- dealer cost
- margin
- markup
- company net

## Integration Boundary

Recommended pattern:

1. Vulpine stores file bytes in Hetzner Storage Box.
2. Vulpine stores metadata and authorization context in PostgreSQL.
3. Vulpine emits indexing events for approved documents.
4. Hermes indexes allowed content and stores retrieval metadata.
5. User/agent requests context through Vulpine server-side services.
6. Vulpine filters context by user authorization before exposing it to Hermes or the final response.

## Agent Mutation Rule

Any future mutation initiated by an agent must go through validated Vulpine server-side application services.

Allowed:

- agent suggests a quote change
- agent drafts a project task
- agent extracts takeoff hints from a plan
- agent summarizes supplier specs

Not allowed:

- agent directly changes quote state in PostgreSQL
- agent directly marks invoices paid
- agent directly changes commissions
- agent bypasses RBAC by querying Hermes-held content

## Indexing Events

Candidate event payload:

- `event_id`
- `file_id`
- `project_id`
- `supplier_id`
- `product_id`
- `document_type`
- `visibility_scope`
- `storage_key`
- `checksum_sha256`
- `created_at`

Idempotency:

- unique by `file_id` + `checksum_sha256`.

