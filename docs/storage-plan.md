# Storage Plan

Hetzner Storage Box will be used for project and document storage. PostgreSQL stores metadata and authorization context. Storage contains the file bytes.

Do not embed production file-storage logic directly into React components. All upload, retrieval, deletion, and download behavior must go through a server-side storage service abstraction.

## Transport Decision Boundary

Do not assume Hetzner Storage Box provides S3-native presigned URLs.

The implementation phase must inspect the actual server and Storage Box configuration and select the real supported transport from available options such as:

- SFTP
- SCP
- WebDAV
- SMB
- mounted filesystem

Do not claim which transport is active until it is verified from runtime configuration.

Preferred application boundary:

```text
Browser
-> authenticated Vulpine server API
-> StorageService
-> Hetzner Storage Box
```

Storage Box credentials must never be exposed to the browser. The `StorageService` abstraction must isolate transport-specific implementation so the rest of the application does not care whether Storage Box access uses SFTP, WebDAV, mounted storage, or another supported transport.

## File Categories

- plans
- cabinet layouts
- elevations
- takeoffs
- specifications
- finish schedules
- supplier quotes
- price books
- generated proposals
- purchase orders
- delivery documents
- proof of delivery
- damage photos
- project photos
- product/spec assets

## Metadata Table

Primary table: `files`.

Required metadata:

- `id uuid primary key`
- `organization_id uuid`
- `project_id uuid nullable`
- `supplier_id uuid nullable`
- `product_id uuid nullable`
- `sku_id uuid nullable`
- `quote_version_id uuid nullable`
- `purchase_order_id uuid nullable`
- `delivery_id uuid nullable`
- `damage_claim_id uuid nullable`
- `document_type text`
- `category text`
- `title text`
- `description text nullable`
- `storage_provider text`
- `storage_bucket text nullable`
- `storage_key text`
- `original_filename text`
- `mime_type text`
- `size_bytes bigint`
- `checksum_sha256 text nullable`
- `revision_label text nullable`
- `revision_number integer nullable`
- `is_customer_visible boolean default false`
- `is_consultant_visible boolean default false`
- `uploaded_by_user_id uuid nullable`
- `created_at timestamptz`
- `updated_at timestamptz`
- `deleted_at timestamptz nullable`

## Storage Key Strategy

Use deterministic, non-secret storage keys. Do not use original filenames as the only key.

Recommended pattern:

```text
org/{organization_id}/projects/{project_id}/{category}/{yyyy}/{mm}/{file_id}/{sanitized_filename}
org/{organization_id}/suppliers/{supplier_id}/price-books/{yyyy}/{mm}/{file_id}/{sanitized_filename}
org/{organization_id}/products/{product_id}/assets/{file_id}/{sanitized_filename}
```

Rules:

- Include UUIDs to avoid collisions.
- Preserve original filename in metadata only.
- Sanitize visible filename segments.
- Store checksum when possible for integrity and duplicate detection.
- Do not expose raw storage credentials to the browser.

## Authorization Requirements

- All download URLs must be generated server-side after permission checks.
- Customer users can only download files marked `is_customer_visible` and associated with their authorized project/account.
- Consultants can only download approved resources or files associated with assigned/registered projects.
- Supplier-facing access is deferred.
- Internal cost-sensitive documents, supplier quotes, price books, and commission documents require internal cost or finance permission.

## Retrieval Pattern

1. Client requests file metadata or download from Vulpine API.
2. Server authenticates user through ZITADEL/session.
3. Server authorizes against project, role, visibility flags, and document type.
4. Server streams the file or validates a short-lived application download token for a controlled Vulpine download endpoint.
5. Server records activity for sensitive document access where required.

Supported future download patterns:

- Server-streamed download: the Vulpine server authenticates the user, authorizes access, retrieves the file through `StorageService`, and streams it to the client.
- Short-lived application download token: the Vulpine application issues a short-lived token authorizing access to a controlled Vulpine download endpoint.

Do not describe or implement native S3-style presigned URLs unless a later implementation introduces an actual compatible storage layer that supports them.

## Upload Pattern

1. Client requests upload intent from Vulpine API with entity association and document type.
2. Server validates permissions.
3. Server creates pending metadata or returns a scoped upload target.
4. Client uploads to storage or server streams upload depending on selected implementation.
5. Server finalizes metadata with size, MIME type, checksum, uploader, and timestamps.
6. Server emits optional Hermes indexing event for authorized document categories.
