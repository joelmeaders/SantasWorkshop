# Santa's Workshop Functional Requirements

## Purpose

This document defines the functional requirements for Santa's Workshop. It describes what the service must do for customers, staff, and managers, without tying those requirements to a specific interface, platform, or implementation approach.

## Audience

- Product and business analysts
- Engineers and architects designing the replacement system
- QA teams deriving scenarios and acceptance criteria
- Operations and support teams validating critical workflows

## Scope

In scope:

- Customer registration and self-service behavior
- Staff check-in, support, intake, and reporting behavior
- Shared controls, communications, lookup, and seasonal-operating capabilities required by both experiences

Out of scope:

- Visual design and layout details
- Specific implementation structure
- Purely non-functional quality targets unless they directly shape workflow behavior

## Conventions

- Requirements are written as **The service shall...** statements.
- Requirement IDs are grouped by domain:
  - `FR-SH-*` = shared platform requirements
  - `FR-CUS-*` = customer requirements
  - `FR-OPS-*` = staff and operations requirements

## Shared functional requirements

### Identity, authorization, and access control

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-SH-001 | The service must support authenticated customer access for self-service registration workflows. | Customer |
| FR-SH-002 | The service must support authenticated staff access for operational workflows. | Staff/Admin |
| FR-SH-003 | The service must restrict privileged operational workflows to authorized staff users. | Staff/Admin |
| FR-SH-004 | The service must prevent unauthenticated users from accessing private customer workflows. | Customer |
| FR-SH-005 | The service must prevent unauthorized users from accessing privileged staff workflows. | Staff/Admin |

### Runtime operating controls

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-SH-006 | The service must allow runtime control of whether public registration is enabled. | Operations |
| FR-SH-007 | The service must allow runtime control of whether new customer account creation is enabled. | Operations |
| FR-SH-008 | The service must allow runtime control of maintenance, weather closure, and registration-closure states that can block public activity. | Operations, Customer |
| FR-SH-009 | The service must allow runtime control of staff functions such as check-in, on-site registration, preregistration, and cancellation-related actions. | Operations, Staff/Admin |
| FR-SH-010 | The service must support a global public message that can be shown dynamically without a rebuild. | Operations, Customer |

### Registration lifecycle and data support

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-SH-011 | The service must maintain a customer profile for authenticated customers. | Customer, Staff/Admin |
| FR-SH-012 | The service must maintain a primary registration for authenticated self-service customers. | Customer, Staff/Admin |
| FR-SH-013 | The service must maintain child information as part of a customer's registration. | Customer, Staff/Admin |
| FR-SH-014 | The service must maintain appointment-slot information for the active program year. | Customer, Staff/Admin, Operations |
| FR-SH-015 | The service must support searchable lookup of submitted registrations for staff support and event operations. | Staff/Admin |
| FR-SH-016 | The service must maintain a check-in record that represents successful event admission. | Staff/Admin, Customer |
| FR-SH-017 | The service must isolate registrations, appointments, and reporting by program year. | All |
| FR-SH-018 | The service must retain enough appointment history to support rescheduling and cancellation workflows. | Customer, Staff/Admin |
| FR-SH-043 | The service must refresh staff lookup results immediately when practical and within a few minutes at worst after a registration changes. | Staff/Admin |

### Communications and support artifacts

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-SH-019 | The service must generate or maintain a registration confirmation artifact tied to the registration identity. | Customer, Staff/Admin |
| FR-SH-020 | The service must queue confirmation-related communication asynchronously when a registration is completed or materially changed. | Customer, Staff/Admin |
| FR-SH-021 | The service must support reminder or follow-up communication based on registration state and seasonal timing rules. | Customer, Operations |
| FR-SH-022 | The service must track whether registration-related communication has been queued, sent, or failed. | Staff/Admin, Operations |
| FR-SH-023 | The service must support manual requeueing of registration communication for support use cases. | Staff/Admin |

### Reporting and seasonal support processes

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-SH-024 | The service must produce aggregated registration reporting outputs for the active program year. | Manager, Operations |
| FR-SH-025 | The service must produce aggregated user and referral reporting outputs for the active program year. | Manager, Operations |
| FR-SH-026 | The service must produce aggregated check-in reporting outputs for the active program year. | Manager, Operations |
| FR-SH-027 | The service must maintain appointment-capacity information used to support scheduling and reporting. | Customer, Staff/Admin, Operations |
| FR-SH-028 | The service must support seasonal administrative processes such as user-access maintenance, exports, and recurring operational updates. | Operations |

### Additional policy-driven shared requirements

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-SH-035 | The service must retry confirmation delivery when the failure condition is transient. | Customer, Operations |
| FR-SH-036 | The service must record confirmation-delivery failures and retry attempts. | Staff/Admin, Operations |
| FR-SH-037 | The service must notify customers within the service when confirmation delivery fails. | Customer |
| FR-SH-038 | The service must send cancellation communication when a registration is canceled. | Customer, Staff/Admin |
| FR-SH-039 | The service must maintain a dedicated cancellation log for registration cancellations. | Staff/Admin, Operations |
| FR-SH-040 | The service must support end-of-year backup and deletion of customer, registration, and check-in data while retaining reporting outputs. | Operations |
| FR-SH-041 | The service must support self-service abuse protections that address patterns such as repeated cancellation and re-registration, duplicate accounts, and false child registrations. | Customer, Operations |
| FR-SH-042 | The service must not require a waitlist workflow as part of appointment scheduling. | Customer, Staff/Admin |

## Customer functional requirements

### Entry, language, and session behavior

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-CUS-001 | The service must provide a public entry experience that offers sign-in, sign-up, and access to customer-facing information. | Customer |
| FR-CUS-002 | The service must support at least English and Spanish in the customer-facing experience. | Customer |
| FR-CUS-003 | The service must apply a default customer language on startup and allow the customer to change it. | Customer |
| FR-CUS-004 | The service must reflect registration availability and closure conditions in the customer experience. | Customer |

### Account creation, sign-in, and password recovery

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-CUS-005 | The service must allow a new customer to create an account using the identity and contact information required by the business. | Customer |
| FR-CUS-006 | The service must allow optional newsletter preference to be captured during account creation. | Customer |
| FR-CUS-007 | The service must reject or gracefully handle duplicate account creation attempts. | Customer |
| FR-CUS-008 | The service must allow an existing customer to sign in using their account credentials. | Customer |
| FR-CUS-009 | The service must redirect an already authenticated customer away from redundant entry points into the active registration area. | Customer |
| FR-CUS-010 | The service must allow a customer to recover account access without staff intervention. The request response must not reveal whether the account exists. | Customer |

### Authenticated registration area

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-CUS-011 | The service must provide an authenticated registration area that exposes registration progress, profile management, and support content. | Customer |
| FR-CUS-012 | The service must continuously derive and present registration progress state to the customer. | Customer |
| FR-CUS-013 | The service must prevent a checked-in customer from continuing through active registration-management workflows. | Customer |
| FR-CUS-014 | The service must redirect a completed registration away from draft-management steps to the confirmation experience. | Customer |
| FR-CUS-015 | The service must prevent direct access to final submission until the registration is ready. | Customer |
| FR-CUS-016 | The service must prevent access to confirmation content until a registration has been submitted. | Customer |
| FR-CUS-053 | The service must automatically validate draft registration changes before final submission. | Customer |
| FR-CUS-054 | The service must provide the customer with an overview of validation status so they can see and correct remaining issues before submission. | Customer |

### Overview and referral capture

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-CUS-017 | The service must provide an overview of registration progress and route the customer toward incomplete steps. | Customer |
| FR-CUS-018 | The service must allow the customer to record how they heard about Santa's Workshop. | Customer |
| FR-CUS-019 | The service must support selecting a referral source from a list and entering an alternate referral value when appropriate. | Customer |
| FR-CUS-020 | The service must persist the referral selection for reporting purposes. | Customer |

### Child management

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-CUS-021 | The service must provide a child-management area that lists currently registered children. | Customer |
| FR-CUS-022 | The service must allow a customer to add a child to the registration. | Customer |
| FR-CUS-023 | The service must allow a customer to edit an existing child on the registration. | Customer |
| FR-CUS-024 | The service must allow a customer to remove a child from the registration before final submission. | Customer |
| FR-CUS-025 | The service must capture the identifying information and age-based eligibility information required for each child. | Customer |
| FR-CUS-026 | The service must validate child information before it is accepted as part of the registration. | Customer |
| FR-CUS-027 | The service must keep child information associated with the customer's registration. | Customer |

### Appointment selection

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-CUS-028 | The service must present enabled appointment slots for the active program year to authenticated customers. | Customer |
| FR-CUS-029 | The service must display appointment information in a way that allows customers to compare availability. | Customer |
| FR-CUS-030 | The service must allow the customer to choose a single appointment slot before submission. | Customer |
| FR-CUS-031 | The service must associate the selected appointment with the current registration. | Customer |

### Submission and confirmation

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-CUS-032 | The service must provide a final review step before registration submission. | Customer |
| FR-CUS-033 | The service must permit submission only when the registration contains the minimum required data for a valid reservation. | Customer |
| FR-CUS-034 | The service must mark the registration as submitted when completion succeeds. | Customer |
| FR-CUS-035 | The service must make submitted registrations available to authorized staff support and event operations. | Staff/Admin |
| FR-CUS-036 | The service must queue confirmation delivery when a registration is successfully submitted. | Customer |
| FR-CUS-037 | The service must provide a confirmation experience that shows the submitted reservation details and confirmation artifact. | Customer |
| FR-CUS-038 | The service must provide access to event-information content from the confirmation experience. | Customer |

### Post-submission maintenance

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-CUS-039 | The service must allow a submitted registration to change appointments when the customer is eligible to do so and operating controls allow it. | Customer |
| FR-CUS-040 | The service must prevent appointment changes after check-in has occurred. | Customer |
| FR-CUS-041 | The service must retain the new appointment and enough prior appointment context to support operational continuity when a reservation is rescheduled. | Customer, Staff/Admin |
| FR-CUS-042 | The service must queue follow-up communication when a submitted reservation is rescheduled. | Customer |
| FR-CUS-043 | The service must allow a customer to cancel their own registration through self-service. | Customer |
| FR-CUS-052 | The service must preserve the same confirmation identifier and QR artifact across customer cancellation and later re-registration, while blocking check-in during cancellation. | Customer |

### Profile maintenance and help

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-CUS-044 | The service must provide a profile area for authenticated customers. | Customer |
| FR-CUS-045 | The service must allow the customer to change core profile information needed for support and registration continuity. | Customer |
| FR-CUS-046 | The service must allow the customer to change the account email address after appropriate identity verification. | Customer |
| FR-CUS-047 | The service must allow the customer to change the account password after appropriate identity verification. | Customer |
| FR-CUS-048 | The service must keep support-relevant registration information aligned with material profile changes. | Customer, Staff/Admin |
| FR-CUS-049 | The service must provide a help or support area inside the authenticated customer experience. | Customer |

### Check-in side effects

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-CUS-050 | The service must treat successful check-in as a terminal state for active self-service registration management in the current season. | Customer |
| FR-CUS-051 | When check-in is detected, the service must notify the customer and end the active self-service session. | Customer |

## Staff and operations functional requirements

### Entry and navigation

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-OPS-001 | The service must provide a staff sign-in experience for authorized operators. | Staff/Admin |
| FR-OPS-002 | The service must route an authenticated, authorized staff user into the operational workspace. | Staff/Admin |
| FR-OPS-003 | The service must provide a landing experience that exposes the major staff workflows. | Staff/Admin |
| FR-OPS-004 | The service must adapt available staff workflows based on runtime operating controls. | Staff/Admin, Operations |
| FR-OPS-005 | The service must allow staff to sign out. | Staff/Admin |

### Search and lookup

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-OPS-006 | The service must provide a search hub for staff lookup workflows. | Staff/Admin |
| FR-OPS-007 | The service must allow lookup by guardian name and location information. | Staff/Admin |
| FR-OPS-008 | The service must allow lookup by email address. | Staff/Admin |
| FR-OPS-009 | The service must allow lookup by confirmation or registration code. | Staff/Admin |
| FR-OPS-010 | The service must display matching search results and allow staff to continue into support or check-in actions. | Staff/Admin |
| FR-OPS-011 | The service must support fast lookup behavior appropriate for event-day operations. | Staff/Admin |

### Check-in workflow

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-OPS-012 | The service must provide a scan-based entry point for check-in. | Staff/Admin |
| FR-OPS-013 | The service must process scanned confirmation values into registration lookup operations. | Staff/Admin |
| FR-OPS-014 | The service must allow recovery from scan failures by directing staff into alternate lookup workflows. | Staff/Admin |
| FR-OPS-015 | The service must stage the selected registration into a review context before final check-in is attempted. | Staff/Admin |
| FR-OPS-016 | The service must provide a review step where staff can inspect registration, child, and appointment information before check-in. | Staff/Admin |
| FR-OPS-017 | The service must allow staff to perform check-in without edits when the reviewed data is acceptable. | Staff/Admin |
| FR-OPS-018 | The service must allow staff to perform a modified check-in path when corrections are required. | Staff/Admin |
| FR-OPS-019 | The service must provide a confirmation step after successful check-in. | Staff/Admin |
| FR-OPS-020 | The service must clear transient in-progress check-in context after the workflow is complete. | Staff/Admin |

### Reservation maintenance during operations

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-OPS-021 | The service must allow staff to edit child information during the review flow when correction is required. | Staff/Admin |
| FR-OPS-022 | The service must allow staff to change a submitted registration's appointment during the review flow when permitted. | Staff/Admin |
| FR-OPS-023 | The service must allow authorized staff to cancel or undo a submitted registration. | Staff/Admin |
| FR-OPS-024 | The service must surface attempted duplicate check-ins to staff instead of silently overwriting or ignoring them. | Staff/Admin |
| FR-OPS-025 | The service must display enough information for staff to resolve a duplicate-check-in situation. | Staff/Admin |

### Staff-created preregistration

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-OPS-026 | The service must provide a preregistration workflow where authorized staff can create a customer account and completed registration on the customer's behalf. | Staff/Admin |
| FR-OPS-027 | The service must capture the identity, household, child, referral, preference, and appointment information needed for a completed preregistration. | Staff/Admin |
| FR-OPS-028 | The service must perform duplicate-account handling before or during staff-created preregistration. | Staff/Admin |
| FR-OPS-029 | The service must create the support and communication artifacts needed for a completed preregistration. | Staff/Admin |

### On-site registration

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-OPS-030 | The service must provide an on-site registration workflow for walk-in customers. | Staff/Admin |
| FR-OPS-031 | The service must allow staff to capture core family and child information for a walk-in customer. | Staff/Admin |
| FR-OPS-032 | The service must complete on-site intake as an immediate operational registration-plus-check-in workflow. | Staff/Admin |
| FR-OPS-033 | The service must keep walk-in intake operationally distinct from preregistration to support tracking needs and fast event-day processing. | Staff/Admin |

### Communication support

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-OPS-034 | The service must provide a support tool that lets staff locate a customer and request a resend of registration communication. | Staff/Admin |
| FR-OPS-035 | The service must validate that a target registration is eligible for resend before queueing a new communication. | Staff/Admin |

### Reporting and dashboards

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-OPS-036 | The service must provide a registration statistics view for staff roles that are authorized to access reporting. | Staff/Admin, Manager |
| FR-OPS-037 | The service must provide a check-in statistics view for staff roles that are authorized to access reporting. | Staff/Admin, Manager |
| FR-OPS-038 | The service must provide a user and referral statistics view for staff roles that are authorized to access reporting. | Staff/Admin, Manager |
| FR-OPS-039 | The service must allow reporting views to filter or select by program year. | Staff/Admin, Manager |
| FR-OPS-040 | The service must present enough registration, appointment, check-in, referral, and geographic summary information to support seasonal operations review. | Staff/Admin, Manager |
| FR-OPS-041 | The service must support differentiated staff permissions so that some staff can register and check in customers without being granted access to reporting functions. | Staff/Admin |

## Alternate, exception, and operational requirements

| ID | Requirement | Primary actors |
| --- | --- | --- |
| FR-SH-029 | The service must surface a meaningful customer-facing recovery path when account creation fails because the account already exists. | Customer |
| FR-SH-030 | The service must block or recover from invalid child data entry rather than allowing invalid registration completion. | Customer, Staff/Admin |
| FR-SH-031 | The service must prevent or reject reservation changes that violate post-check-in rules. | Customer, Staff/Admin |
| FR-SH-032 | The service must preserve staff visibility into duplicate check-in attempts instead of failing silently. | Staff/Admin |
| FR-SH-033 | The service must continue to support alternate lookup recovery paths when scanning is unavailable or fails. | Staff/Admin |
| FR-SH-034 | The service must continue to expose closure or maintenance state immediately when runtime operating conditions change. | Customer, Staff/Admin, Operations |
