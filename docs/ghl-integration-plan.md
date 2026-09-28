# GoHighLevel Integration Plan

GoHighLevel owns CRM state. Vulpine must not duplicate CRM functionality in PostgreSQL.

## Website Intake Contract

Website project intake must eventually:

1. Validate request.
2. Normalize contact data.
3. Create or update GHL Contact.
4. Create or update GHL Opportunity.
5. Populate required custom fields.
6. Preserve attribution.
7. Attach intake/project metadata.
8. Retain returned GHL identifiers.
9. Trigger any required orchestration event.

## Outbound Payload From Website To GHL Service

Canonical fields:

- `source`
- `page_url`
- `name`
- `email`
- `phone`
- `company`
- `project_type`
- `project_location`
- `address`
- `city`
- `state`
- `zip`
- `message`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `sms_consent`
- `sms_consent_text`
- `sms_consent_timestamp`
- `user_agent`
- `ip`

Future fields:

- `property_type`
- `unit_count`
- `timeline`
- `budget_range`
- `desired_products`
- `uploaded_file_ids`

## Required GHL References

Vulpine stores returned references either directly on relevant records or in `integration_links`:

- `ghl_location_id`
- `ghl_contact_id`
- `ghl_company_id`
- `ghl_opportunity_id`
- `ghl_pipeline_id`

## GHL Custom Fields

Exact names and IDs are unresolved until GHL is inspected/configured.

Required future fields:

- `UNRESOLVED_NAME`: project type
- `UNRESOLVED_NAME`: project location
- `UNRESOLVED_NAME`: unit count
- `UNRESOLVED_NAME`: desired materials/categories
- `UNRESOLVED_NAME`: attribution source
- `UNRESOLVED_NAME`: original page URL
- `UNRESOLVED_NAME`: Vulpine project ID after qualification

## Inbound Events From GHL

Supported event types:

- opportunity qualified
- stage changed
- opportunity won
- opportunity lost
- contact updated
- appointment booked

Required webhook behavior:

- Verify request authenticity.
- Normalize event payload.
- Insert or find an `integration_events` row using `provider='ghl'` and the GHL event ID before applying mutations.
- Resolve existing integration links.
- Apply only allowed state transitions.
- Record activity.
- Return success for duplicate already-processed events.
- Preserve failed event payloads and errors for traceability and retry analysis.

`integration_events` required states:

- `received`
- `processing`
- `processed`
- `failed`
- `ignored`

Uniqueness:

- `(provider, external_event_id)` prevents duplicate webhook processing.

## Project Creation Trigger

A Vulpine Project is created when a GHL Opportunity reaches the approved qualification trigger.

The exact trigger is unresolved:

- `UNRESOLVED_NAME`: qualified pipeline stage ID
- `UNRESOLVED_NAME`: qualified event type or custom field

Rules:

- Repeated webhook deliveries must not create duplicate projects.
- `integration_links` must enforce uniqueness for `provider='ghl'`, `external_object_type='opportunity'`, and `external_object_id`.
- Project creation should be idempotent by GHL opportunity ID and guarded by `integration_events`.
- If a project already exists for the GHL opportunity, update references/activity rather than inserting another project.

## Outbound Updates To GHL

Critical outbound updates to GHL must use `outbox_events` when they are triggered by authoritative Vulpine mutations.

Pattern:

1. Business mutation occurs in Vulpine.
2. Authoritative PostgreSQL record is committed.
3. Corresponding `outbox_events` row is committed in the same transaction.
4. Worker/orchestrator processes the outbox event.
5. GHL receives the update directly or through n8n.
6. Success/failure state is recorded on the outbox event.

Do not rely on unsafe code paths where Vulpine changes the database and then assumes a following external HTTP call to GHL succeeds without durable retry state.

## Back Office Leads And Opportunities

Back Office navigation may include `Leads` and `Opportunities`, but those pages are GHL-backed views.

Allowed local storage:

- integration references
- sync timestamps
- durable conversion audit
- Vulpine project link once qualified

Not allowed:

- local duplicate CRM pipeline
- local duplicate sales activity store replacing GHL
- local duplicate SMS/email nurture state
