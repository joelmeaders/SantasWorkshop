# Santa's Workshop Business Requirements

## Purpose

This document defines the business requirements for Santa's Workshop as a seasonal family registration, scheduling, and event-operations service. It is intended to describe what the organization needs the product and supporting operations to accomplish, without prescribing design, architecture, or implementation details.

## Audience

- Product and business stakeholders
- Engineering and architecture teams planning the rebuild
- QA, operations, and support stakeholders
- Delivery teams translating requirements into epics, stories, and acceptance criteria

## Scope

In scope:

- Customer registration and self-service needs
- Staff and volunteer operational needs
- Seasonal scheduling, check-in, communications, and reporting needs
- Runtime operational controls needed to manage the program safely

Out of scope:

- Detailed user-interface design
- Specific implementation or platform choices
- Business domains unrelated to registration and event operations

## System purpose

Santa's Workshop requires a service that helps eligible families register children for a seasonal event, select an available appointment, receive confirmation, and arrive prepared. The organization also requires staff tools to manage exceptions, process event-day check-in, communicate with families, and review seasonal outcomes.

At the business level, the service exists to:

1. help eligible families register for the seasonal program
2. let families manage essential registration information before the event
3. give staff reliable tools to locate, validate, update, and check in attendees
4. support customer communication related to registration and event participation
5. produce operational records and reporting needed to run and evaluate the program
6. let organizers control availability and operating conditions in real time

## Stakeholders and personas

| Persona | Description | Primary goals |
| --- | --- | --- |
| Guardian / Customer | Parent or guardian managing a family registration | Create an account, register children, choose a time, receive confirmation, and arrive prepared |
| Returning Guardian | Existing user who revisits a previously created account | Sign back in, review status, update profile details, or adjust the reservation when allowed |
| Front-line Operator | Staff or volunteer supporting event-day operations | Find registrations quickly, verify details, resolve issues, and check families in efficiently |
| Registration Staff / Admin | Authorized staff creating or correcting registrations on behalf of families | Create preregistrations, manage walk-ins, resend communications, and support exception handling |
| Manager / Reporting User | Operational lead reviewing seasonal progress and results | Monitor registration and check-in activity, capacity usage, referrals, and geographic distribution |
| Operations Maintainer | Internal maintainer responsible for seasonal controls and support processes | Keep the service configured correctly, manage operating modes, and ensure seasonal support processes run |

## Business goals and outcomes

### BR-001 Seasonal registration capability

The business must be able to open, close, pause, or otherwise control a seasonal registration program without rebuilding or replacing the product.

### BR-002 Customer self-service registration

The business must provide a self-service journey that allows a guardian to create an account, maintain a household registration, submit an event reservation, and complete as many normal customer tasks as possible without staff intervention while still protecting the program from abuse.

### BR-003 Staff-assisted intake

The business must support authorized staff creating registrations on behalf of customers when self-service is insufficient, impractical, or unavailable.

### BR-004 Event-day check-in operations

The business must provide staff with tools to verify, amend when necessary, and record event-day check-ins for both preregistered and on-site families.

### BR-005 Operational flexibility

The business must be able to react to operating conditions such as maintenance windows, weather closure, and program shutdown through runtime controls.

### BR-006 Family communication

The business must provide confirmation and follow-up communication flows tied to the registration lifecycle.

### BR-007 Searchability and recoverability

The business must allow authorized staff to find a customer by multiple identifiers so that event-day operations do not depend on a single artifact.

### BR-008 Reporting and accountability

The business must capture enough information to support post-registration and post-check-in reporting by year, appointment, referral source, and geography.

### BR-009 Seasonal continuity

The business must isolate event data by program year so that one season's registrations, schedules, and reporting do not overwrite another season's records.

### BR-010 Controlled privileged access

The business must distinguish between customer actions and privileged staff actions, and must restrict privileged workflows to authorized operators.

## Business capability map

| Capability area | Business purpose | Primary actor(s) |
| --- | --- | --- |
| Account creation and sign-in | Establish identity and allow return access | Guardian |
| Family registration management | Collect child, appointment, and profile information | Guardian |
| Registration submission and confirmation | Convert a draft registration into an event reservation | Guardian |
| Post-submission maintenance | Allow limited changes after submission when policy permits | Guardian, Admin |
| Event-day lookup and check-in | Admit and process families at the event | Front-line Operator |
| Staff-created preregistration | Register families on their behalf before the event | Registration Staff |
| On-site registration | Support walk-in families who are handled directly at the event | Front-line Operator, Registration Staff |
| Communication support tooling | Resolve communication failures or lost confirmations | Registration Staff |
| Runtime operational control | Turn features on or off and communicate operating status | Operations Maintainer |
| Reporting and analytics | Measure utilization, operations, and outreach patterns | Manager / Reporting User |

## Business process lifecycle

### Pre-season and season setup

The business prepares a new program year by establishing appointment availability, operating rules, staff access, and seasonal support processes.

### Public registration phase

Customers create accounts, register children, choose an appointment, and submit a reservation.

### Pre-event maintenance phase

Customers and staff may update limited information, resend registration information, or change an appointment according to policy.

### Event-day operations phase

Staff locate, review, possibly correct, and check in families. Walk-ins must also be accommodated.

### Post-event reporting phase

The business reviews aggregated information about users, registrations, appointments, and check-ins for operational analysis and planning.

## Shared business requirements

### BR-011 Program-year isolation

The service shall organize seasonal operations around a program year so that schedules, registrations, and reporting can be managed for the active season without mixing them with prior seasons.

### BR-012 Real-time operating controls

The service shall allow runtime control of:

- whether public registration is open
- whether account creation is available
- whether maintenance mode is active
- whether the event is closed for weather
- whether specific staff workflows are enabled
- whether a temporary global message should be shown to users

### BR-013 Bilingual public messaging

The service shall support at least English and Spanish for customer-facing messaging and public operational notices.

### BR-014 Record continuity across workflows

The business shall maintain continuity between customer self-service, staff support flows, confirmation communications, and event-day operations so that staff can act on the same underlying registration identity.

### BR-015 Searchable operational lookup

The service shall support operator lookup of customer records by multiple identifiers needed for support and check-in.

### BR-016 Asynchronous communications

The service shall support asynchronous registration communication so that submission and update workflows are not blocked by message-delivery timing.

### BR-017 Seasonal statistics

The service shall maintain business reporting outputs for registrations, users, appointment utilization, and check-ins at a level sufficient for operational review.

## Customer-facing business requirements

### BR-018 Public entry

The customer experience shall provide a clear entry point to create an account, sign in, and access supporting information, while respecting operational controls.

### BR-019 Customer-owned account model

The business shall use a customer account as the unit of return access for self-service registration management.

### BR-020 Registration draft model

Before final submission, a customer shall be able to assemble and revise the main parts of a registration, including children and appointment selection.

### BR-021 Referral capture

The business shall capture how a customer heard about Santa's Workshop so referral and outreach effectiveness can be analyzed.

### BR-022 Child registration management

The business shall let a guardian add, edit, and remove children from the household registration before final submission.

### BR-023 Appointment selection

The business shall let the customer choose from enabled appointment slots associated with the active program year.

### BR-024 Submission readiness rule

A registration shall not be treated as complete until the guardian has at least one eligible child on the registration and has selected an appointment slot.

### BR-025 Confirmation artifact

After successful submission, the customer shall receive or be shown a confirmation artifact that can be used later in support and check-in workflows.

### BR-026 Limited post-submission change support

After submission, the business shall support limited changes to the reservation, including appointment changes and cancellation, when policy and operating controls allow it.

### BR-027 Checked-in lockout

Once a family has been checked in, the self-service registration flow shall no longer function as an active registration-management path for that season.

### BR-028 Profile maintenance

Customers shall be able to update key profile fields needed to keep their registration reachable and searchable.

### BR-029 Password recovery and account return

Customers shall be able to recover account access without staff intervention.

## Staff and admin business requirements

### BR-030 Authorized staff entry

The staff experience shall only be available to authenticated, authorized staff or volunteers.

### BR-031 Fast customer lookup

The staff experience shall allow operators to locate customers by multiple identifiers needed for support and check-in.

### BR-032 Review-before-check-in

Before completing check-in, staff shall be able to review the relevant customer and child information and determine whether corrections are needed.

### BR-033 Event-day correction path

The staff experience shall support limited edits during the check-in flow when staff identify issues that must be corrected before admission.

### BR-034 Duplicate check-in handling

The service shall detect and surface attempted duplicate check-ins so staff can resolve them without corrupting event records.

### BR-035 Staff-created preregistration

Authorized staff shall be able to create a completed preregistration on behalf of a customer, including children, appointment assignment, and downstream confirmation delivery.

### BR-036 Walk-in processing

Authorized staff shall be able to register and check in on-site customers through a workflow that does not depend on the customer already having a self-service account.

### BR-037 Communication support tooling

Authorized staff shall be able to trigger a resend of registration communication when needed to support customers.

### BR-038 Operational dashboards

Authorized reporting roles, including managers and selected staff, shall be able to view seasonal statistics that summarize registrations, check-ins, appointment usage, referral patterns, and geographic patterns.

### BR-039 Feature-gated staff operations

The business shall be able to enable or disable specific staff functions such as check-in, on-site registration, preregistration, and cancellation without a rebuild.

## Business constraints

### BR-040 Seasonal operating model

The business process is seasonal, with program-year configuration, appointment scheduling, seasonal reporting, and event-day check-in windows.

### BR-041 Runtime-managed operations

The organization relies on runtime operating controls and scheduled support processes to run the program and must retain those control points.

### BR-042 Shared service dependency

The customer and staff experiences are two operational views of the same registration and check-in business process and must remain aligned.

## Confirmed business policy requirements

### BR-043 Cancellation policy

Customers shall be able to cancel their own registrations through self-service, and authorized staff shall also be able to cancel registrations on behalf of customers.

### BR-044 Cancellation communication and invalidation

When a registration is canceled, the service shall send cancellation communication, invalidate any previously issued confirmation artifact, and ensure that a replacement confirmation identifier is generated so the prior artifact can no longer be reused.

### BR-045 Cancellation tracking

Every cancellation shall be recorded in a dedicated cancellation log for operational review and abuse monitoring.

### BR-046 Appointment exhaustion and overbooking policy

The business does not require strict hard-stop overbooking prevention or waitlisting. Limited overbooking may occur during periods of high registration volume.

### BR-047 Referral policy

Referral information shall be collected for reporting purposes only.

### BR-048 Eligibility policy

Child eligibility shall be determined by age only. No additional household-size or maximum-child-count business rule is required at this time.

### BR-049 End-of-year data lifecycle

At the end of each program year, after the event, seasonal customer, registration, and check-in data shall be backed up and then deleted, with seasonal statistics and reporting outputs retained.

### BR-050 Confirmation failure handling

Confirmation delivery failures caused by transient conditions shall be retried. Failures and retries shall be recorded, and customers shall be informed within the service when confirmation delivery fails.

### BR-051 Staff accountability

All staff actions that modify data shall be tracked for operational review and compliance.

### BR-052 Accessibility standard

The rebuilt customer and staff experiences shall meet WCAG AA accessibility standards.

### BR-053 Self-service with abuse protection

The service shall maximize self-service wherever practical while enforcing protections against abuse, including abuse patterns such as repeated cancellation and re-registration, duplicate accounts, and false child registrations.
