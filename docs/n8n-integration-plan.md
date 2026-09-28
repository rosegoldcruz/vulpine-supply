# n8n Integration Plan

n8n is orchestration, not the database of record.

Authoritative state remains in:

- GoHighLevel for sales CRM state.
- Vulpine PostgreSQL for operational state.
- Hetzner Storage Box for file bytes with PostgreSQL metadata.

## Workflow Standards

Every workflow must define:

- event source
- payload
- destination
- authentication requirement
- idempotency requirement
- retries
- dead-letter/failure behavior

All n8n-triggered writes back to Vulpine must call validated Vulpine server-side application services. n8n must not write directly to core PostgreSQL tables unless a future operational decision explicitly permits tightly scoped service credentials.

## Integration Reliability Model

Inbound events from n8n or systems routed through n8n must be recorded through `integration_events` when they can mutate Vulpine state.

Required inbound behavior:

- record `provider`, `external_event_id`, `event_type`, payload, status, attempt count, timestamps, and errors
- enforce unique `(provider, external_event_id)`
- support states `received`, `processing`, `processed`, `failed`, and `ignored`
- process duplicate deliveries safely without duplicate side effects

Outbound events from authoritative Vulpine mutations must use `outbox_events` when delivery matters.

Pattern:

1. business mutation occurs
2. authoritative Vulpine database record is committed
3. corresponding `outbox_events` row is committed in the same database transaction
4. worker/orchestrator processes the outbox event
5. n8n or another integration target receives the event
6. success/failure state is recorded

Critical outbound integrations must not depend on an unsafe pattern where the database is changed and an external HTTP call is assumed to succeed afterward without durable retry state.

## Workflow: Website Submission

Flow:

```text
Website submission
-> GHL
-> Vulpine integration reference
-> notification
```

Event source:

- Vulpine website intake API.

Payload:

- normalized contact fields
- project intent fields
- attribution fields
- consent fields
- returned GHL contact/opportunity IDs

Destination:

- GHL
- Vulpine `integration_links`
- Vulpine `outbox_events` for durable follow-up/notification delivery where required
- notification channel

Authentication:

- server-to-n8n webhook secret or signed request.

Idempotency:

- key derived from intake request ID or normalized contact + submitted timestamp + source; mutating inbound callbacks use `integration_events`.

Retries:

- retry transient GHL/n8n failures.

Failure behavior:

- preserve existing lead capture fallback until migration is complete.
- send internal alert if GHL creation fails.

## Workflow: Qualified GHL Opportunity

Flow:

```text
Qualified GHL opportunity
-> create Vulpine project
```

Event source:

- GHL webhook or n8n polling workflow.

Payload:

- GHL opportunity ID
- GHL contact/company IDs
- qualification stage
- assigned owner
- project metadata

Destination:

- Vulpine project service.

Authentication:

- signed Vulpine API request from n8n.

Idempotency:

- unique by `ghl_opportunity_id`, with webhook delivery guarded by `integration_events`.

Retries:

- retry Vulpine API transient failures.

Dead-letter:

- record failed event/outbox state with payload, error, and retry count.

## Workflow: Project File Uploaded

Flow:

```text
Project file uploaded
-> storage
-> database metadata
-> Hermes indexing event
```

Event source:

- Vulpine file service.

Payload:

- file ID
- project ID
- document type
- visibility flags
- storage key
- checksum

Destination:

- Hermes indexing endpoint where authorized.

Authentication:

- Vulpine-to-n8n secret or service token.

Idempotency:

- unique by file ID and checksum.

Failure behavior:

- file remains stored and usable even if indexing fails.
- indexing failure creates task/notification for retry.

## Workflow: Proposal Submitted

Flow:

```text
Proposal submitted
-> GHL update
-> follow-up automation
```

Event source:

- Vulpine quote/proposal service.

Payload:

- quote ID
- quote version ID
- proposal file ID
- proposal amount
- expiration
- project/GHL references

Destination:

- GHL opportunity note/stage/custom fields
- GHL follow-up automation

Idempotency:

- unique by quote version ID; outbound delivery is represented by an `outbox_events` row.

Failure behavior:

- proposal state in Vulpine remains authoritative.
- GHL sync failure is visible as integration exception.
- failed outbound delivery remains retryable through `outbox_events`.

## Workflow: Proposal Accepted

Flow:

```text
Proposal accepted
-> GHL Won
-> Vulpine procurement-ready state
-> operations notification
```

Event source:

- Vulpine proposal acceptance service.

Payload:

- quote version ID
- project ID
- accepted by
- accepted timestamp
- deposit requirement
- GHL opportunity ID

Destination:

- GHL
- Vulpine project/order state
- internal notification

Idempotency:

- unique by quote version ID and acceptance state; outbound GHL/n8n updates are represented by `outbox_events`.

Failure behavior:

- Vulpine acceptance remains authoritative.
- failed GHL update is retryable.
- retry state and errors are recorded on the related outbox event.

## Workflow: Shipment Exception

Flow:

```text
Shipment exception
-> task / notification / external communication
```

Event source:

- Vulpine logistics service.

Payload:

- shipment ID
- delivery ID if available
- exception type
- severity
- affected project/order
- photos/documents if any

Destination:

- Vulpine task/notification service
- optional external communication provider

Idempotency:

- unique by shipment ID + exception type + event timestamp/source event ID.

Failure behavior:

- exception remains recorded in Vulpine.
- notification failure creates internal task.
