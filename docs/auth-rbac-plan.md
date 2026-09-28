# Auth And RBAC Plan

Preferred identity provider: ZITADEL.

This plan defines target authorization behavior only. Authentication is not implemented in this task.

## Identity Authentication

ZITADEL owns:

- Human identity
- Login sessions
- MFA and identity assurance
- External user authentication for customers, consultants, and later suppliers
- Coarse group/role assertions made available to the application
- Organization/account identity where appropriate

ZITADEL authentication answers who the user is. It does not, by itself, decide whether that user can access a specific project, document, commission, quote, supplier price, or future supplier-facing record.

## Application Authorization

Vulpine owns resource-level authorization in application services and PostgreSQL-backed relationships.

Vulpine PostgreSQL and server-side authorization logic own:

- Local `users` record linked to ZITADEL subject
- Person and organization relationships
- Application role assignments if additional app-specific authorization is needed
- Organization memberships
- Project, contact, consultant, customer, trade, and supplier relationships
- Audit logs for sensitive operational actions

Application authorization answers:

- whether this user can access this specific project
- whether this customer may see this specific document
- whether this consultant may see this specific commission
- whether this internal user may view supplier costs
- whether this user belongs to an organization associated with the project
- whether this supplier user may access a future supplier-facing record

Required local identity columns:

- `users.zitadel_subject_id`
- `users.email`
- `users.person_id`
- `users.organization_id`
- `users.status`
- `users.last_login_at`

## Organization Membership Model

Use `organization_memberships` to support users who legitimately belong to or interact with more than one organization.

Proposed columns:

- `id`
- `organization_id`
- `user_id`
- `membership_type`
- `status`
- `created_at`
- `updated_at`

Uniqueness:

- Use unique `(organization_id, user_id, membership_type)` to prevent accidental duplicate memberships while allowing future extension if a user can hold multiple membership types.
- If the business later requires only one active membership per user/organization, add a partial unique rule for active memberships rather than removing `membership_type`.

Compatibility requirements:

- customer organizations
- trade accounts
- consultants
- internal staff
- multi-company users
- future supplier access

## Role Families

- `admin`: full platform administration.
- `sales`: GHL-backed leads/opportunities, sales follow-up, project conversion where authorized.
- `ops`: project execution, procurement, logistics, documents.
- `estimator`: takeoffs, supplier pricing, quote building, internal pricing access.
- `finance`: invoices, payments, commissions, finance reports.
- `consultant`: assigned or registered opportunities/projects and own commission data.
- `customer`: own projects, customer-safe documents, proposals, billing, delivery status.
- `supplier_later`: reserved for future supplier-facing access.

## Surface Access

| Surface | admin | sales | ops | estimator | finance | consultant | customer | supplier_later |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public site | yes | yes | yes | yes | yes | yes | yes | yes |
| Back Office dashboard | yes | yes | yes | yes | yes | no | no | no |
| Leads | yes | yes | limited | no | no | no | no | no |
| Opportunities | yes | yes | limited | no | no | assigned/register-only through portal | no | no |
| Projects | yes | assigned | yes | assigned | finance subset | assigned through portal | own through portal | later |
| Quotes | yes | sales subset | ops subset | yes | finance subset | no internal quote editor | customer-safe proposals only | no |
| Products/SKUs | yes | read | read | read/write | read costs if authorized | public/approved resources | public/approved resources | later |
| Suppliers/pricing | yes | limited read | read/write | read/write | read costs if authorized | no | no | later |
| Procurement/logistics | yes | status read | yes | read | finance subset | no | customer-safe status | later |
| Finance | yes | limited sales state | no | no | yes | own commissions | own invoices/payments | no |
| Admin | yes | no | no | no | no | no | no | no |

## Permission Classes

### Internal Cost Access

Fields:

- supplier cost
- dealer cost
- margin
- markup
- commission
- company net

Allowed roles:

- `admin`
- `estimator`
- `finance`
- `ops` only where operationally required

Denied by default:

- `sales` unless explicitly granted
- `consultant`
- `customer`
- `supplier_later`

### Customer-Safe Access

Fields:

- proposal price
- approved selections
- documents intended for customer
- invoice/payment information
- order status
- delivery status

Allowed roles:

- `admin`
- assigned internal roles
- associated `customer`
- associated trade users

### Consultant Access

Fields:

- assigned opportunities/projects
- registered opportunities
- commission data belonging to that consultant
- approved sales/project resources

Denied:

- unrelated opportunities/projects
- internal supplier cost
- company net
- other consultant commission data

## Enforcement Requirements

- Do not rely on frontend visibility controls.
- Every server-side read path must enforce permissions before querying or before returning sensitive fields.
- Use explicit field-level read models for portal/customer-safe responses.
- Internal financial fields should be excluded by default and added only through privileged service methods.
- Every mutation must record `created_by_user_id`, `updated_by_user_id`, or an equivalent actor context when possible.
- Integration/webhook mutations must use service accounts with scoped permissions and idempotency.
- Sensitive access must be enforced server-side through Vulpine application services, API handlers, server actions, or database-backed policies.
- Frontend navigation, hidden buttons, and conditional rendering are usability controls only; they are not authorization.

## Audit Requirements

Audit through `activities` for:

- Project creation from GHL
- Quote version submission
- Proposal acceptance
- Supplier price updates
- PO creation and status changes
- Invoice/payment changes
- Commission calculation and payout state changes
- File upload/download of sensitive documents where required
- Permission/role changes
