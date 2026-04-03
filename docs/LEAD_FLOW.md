# Lead flow (CRM context for AI)

This document describes the lead lifecycle, stages, valid transitions, and automation so AI/developers can reason about the CRM correctly.

---

## 1. Stages

Stages are defined in `features/leads/types/lead.types.ts` (`LEAD_STAGES`, `LeadStage`).

| Stage        | Description                                       |
| ------------ | ------------------------------------------------- |
| `new`        | Just entered CRM                                  |
| `contacted`  | Initial contact made                              |
| `interested` | Showed interest                                   |
| `rnr`        | Ringing, no response; routes to follow-up         |
| `follow_up`  | In follow-up (calls, reschedule)                  |
| `booking`    | Has a booked appointment                          |
| `no_show`    | Did not show for booked appointment               |
| `done`       | Service completed                                 |
| `lost`       | Lost / not interested (can re-enter after 6 days) |

**Funnel order** (for Kanban/funnel views):  
`new` → `contacted` → `interested` / `rnr` → `follow_up` → `booking` → `no_show` → `done` | `lost`  
(`STAGE_ORDER` in `lead.types.ts`)

---

## 2. Allowed stage transitions

Only transitions in `NEXT_STAGE_MAP` are allowed (enforced by stage API and UI).

| From         | To (allowed)                                    |
| ------------ | ----------------------------------------------- |
| `new`        | `contacted`                                     |
| `contacted`  | `interested`, `rnr`, `lost`                     |
| `interested` | `follow_up`, `booking`, `done`, `lost`          |
| `rnr`        | `follow_up`                                     |
| `follow_up`  | `booking`, `done`, `lost`                       |
| `booking`    | `done`, `lost`, `no_show`                       |
| `no_show`    | `follow_up`, `booking`, `lost`                  |
| `done`       | _(none – terminal)_                             |
| `lost`       | _(none – terminal; cron can re-enter as `new`)_ |

Important for post-booking flow:

- **Booking** can go to **Done** (completed) or **No-Show** (didn’t attend).
- **RNR** is used after `contacted` when there is no response; it immediately routes into **Follow-up** scheduling.
- **No-Show** can go to **Follow-up** (for reschedule) or back to **Booking** or **Lost**.

---

## 3. Post-booking lifecycle (flow)

```
                    ┌─────────────┐
                    │   BOOKING   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐   ┌─────────┐   ┌──────┐
         │  DONE  │   │ NO-SHOW │   │ LOST │
         └────┬───┘   └────┬────┘   └──────┘
              │            │
              │            │ (manual or after 6 days)
              │            ▼
              │       ┌──────────┐
              │       │ FOLLOW-UP│
              │       └────┬─────┘
              │            │
              │            ├──► BOOKING (reschedule)
              │            ├──► DONE / LOST
              │            │
              ▼            ▼
         After 6 days → REFERRAL (action, not a stage)
```

- **Booking** → **Done**: service completed.
- **Booking** → **No-Show**: lead didn’t show; can then go to **Follow-up** (manually or via cron after 6 days).
- **Follow-up** → **Booking**: reschedule / new booking.
- **Referral** is an **action** (create a new lead from a done/no-show/follow-up lead), not a stage. It is often used “after 6 days” for done leads (and can be extended for no-show/follow-up).

---

## 4. Automation (cron)

### 4.1 Lost reentry (6 days)

- **File:** `lib/cron/lead-lifecycle.ts`
- **Condition:** Lead in `lost`, `lostAt` ≥ 6 days ago, `reentryAt` not set, not exited (`lostCount < 2`).
- **Action:** Set `reentryAt`, `stage: "new"`, assign to follow-up candidate (`roleOwner: "follow_up_candidate"`), clear `lostAt`. Optionally set `previousAssignedUserId` if not already set.

### 4.2 No-show reentry (6 days) → Follow-up

- **File:** `lib/cron/lead-lifecycle.ts`
- **Condition:** Lead in **`no_show`**, `isNoShow`, `noShowAt` ≥ 6 days ago, `noShowReentryAt` not set, not exited.
- **Action:**
  - Set `noShowReentryAt`, **`stage: "follow_up"`**, assign to follow-up candidate, `roleOwner: "follow_up_candidate"`, `noShowFollowUpCycle: 1`.
  - Insert stage history: `no_show` → `follow_up` (for audit).
  - Create follow-up tasks using the active schedule.

So: **after 6 days, no-show leads are moved into the Follow-up stage** and get follow-up tasks; they can then move to Booking (reschedule) or Done/Lost.

---

## 5. Referral (action, not a stage)

- **Meaning:** Create a **new lead** from an existing lead (parent), e.g. for “After 6 days → Referral”.
- **UI:** “Create referral” on lead detail when lead is `done` (and not already `referralGenerated`). Can be extended to no_show/follow_up after 6 days if needed.
- **API:** `app/api/leads/referral/route.ts` (POST with `parentLeadId`, `name`, `phone`).
- **Data:** Parent lead gets `referralGenerated: true`, `referralLeadId`; new lead has `source: "referral"` and optional link to parent.

---

## 6. Key code locations

| What                | Where                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Stage types & map   | `features/leads/types/lead.types.ts` (`LEAD_STAGES`, `NEXT_STAGE_MAP`, `STAGE_ORDER`)                      |
| Stage change API    | `app/api/leads/[id]/stage/route.ts`                                                                        |
| Lead lifecycle cron | `lib/cron/lead-lifecycle.ts` (lost reentry, no-show reentry → follow_up)                                   |
| Follow-ups cron     | `lib/cron/follow-ups.ts` (e.g. moving to lost, stage history)                                              |
| Lead schema/fields  | `db/collections.ts` (`LeadDoc`: `noShowAt`, `noShowReentryAt`, `recoveryCycle`, `referralGenerated`, etc.) |
| Lead detail UI      | `app/(dashboard)/leads/[id]/page.tsx` (stage dropdown, no-show, referral)                                  |

---

## 7. Flow compliance: completed vs remaining

This section maps the **full flowchart and business rules** to implementation status.

### Lost leads (top-right rules)

| Rule                                                                                           | Status   | Notes                                                                                               |
| ---------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| Lost leads become new leads (for the role)                                                     | **Done** | `lib/cron/lead-lifecycle.ts`: after 6 days, lost → `stage: "new"`, assigned to follow-up candidate. |
| On 7th day (after 6 days) lost leads come as new lead to his role                              | **Done** | Same as above; reentry at 6 days.                                                                   |
| After attending lost leads for 2 times, lead permanent lost (remain in data, not shown in CRM) | **Done** | `lostCount >= 2` → `exitedFromCrmAt`; list API filters `exitedFromCrmAt` so they don’t show.        |
| Follow-up for “No role”: 3rd time → 1st follow-up after 5 days (6th day)                       | **Done** | Lost reentry now creates one follow-up at day 5 (`lib/cron/lead-lifecycle.ts`).                     |

### No-show (middle-right rules)

| Rule                                                                                            | Status   | Notes                                                                                                     |
| ----------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| No-show after 6 days (7th day) counted as new lead to this role                                 | **Done** | No-show reentry after 6 days → `stage: "follow_up"`, assign to follow-up candidate.                       |
| If Sales set future follow-up date for no-show, no-show stays with original user till that date | **Done** | `noShowFollowUpUntil` on LeadDoc; PATCH and lead detail date picker; cron skips reentry until date.       |
| 1st follow-up: after 4 days (on 5th day); 2nd follow-up: 4 days after 1st; then lead exits      | **Done** | `NOSHOW_FOLLOWUP_DAYS = [4, 8]` in `lib/cron/lead-lifecycle.ts`; exit after 2 missed/completed unchanged. |
| After 2nd follow-up, lead exits CRM flow                                                        | **Done** | Lifecycle cron sets `exitedFromCrmAt` when 2 no-show follow-ups are missed/completed.                     |

### Done / referral (bottom-right rules)

| Rule                                                 | Status   | Notes                                                                                                        |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| Done leads: review request sent when marked Done     | **Done** | Review request is sent immediately when lead is marked Done (stage API `app/api/leads/[id]/stage/route.ts`). |
| If Google review client gave number, new lead taken  | **Done** | “Create lead from review” button on lead detail (done block) reuses referral dialog and API.                 |
| After 6 days referral for that user is same lead     | **Done** | Referral creates new lead with `assignedUserId: session.user.id` and same `roleOwner` (same user/role).      |
| Referral: Name & Number → new lead in same role only | **Done** | API creates lead with parent link, assigned to current user; roleOwner set from session.                     |

### Stage flow (diagram)

| Flow                                                                     | Status                                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| New → Contacted → Interested / RNR → Follow-up / Booking                 | **Done** (NEXT_STAGE_MAP + API).                                                        |
| Booking → Done / No-Show / Lost                                          | **Done**.                                                                               |
| No-Show → Follow-up (manual or after 6 days)                             | **Done**.                                                                               |
| Follow-up → Booking (reschedule)                                         | **Done**.                                                                               |
| Done / No-Show / Follow-up → After 6 days → Referral (action)            | **Done** for Done; referral UI on done lead; optional 6-day gate for no_show/follow_up. |
| Referral leads flow → re-entry (Booking = Done, Booking + No-Show, Lost) | **Done** (referral is new lead in same role; that lead goes through normal flow).       |

### 4.3 Follow-up task schedule

When a lead is moved into `follow_up`, the user selects a base follow-up date and time in the popup. The system creates follow-up tasks from that selected datetime:

- first follow-up: **after 6 hours**
- second follow-up: **after 1 day**
- third follow-up: **after 3 days**
- fourth follow-up: **after 5 days**

A new follow-up cycle is created only when the lead has no existing `pending` follow-ups. If previous follow-ups are already `completed` or `missed`, re-entering `follow_up` will create a fresh cycle.

When a lead is marked `rnr`, the same follow-up date/time popup is used. After confirmation, the system records the lead as `rnr`, immediately moves it into `follow_up`, and creates the same follow-up schedule.

This is implemented in `app/api/leads/[id]/stage/route.ts`.

### Summary

- **Completed:** Stage map and transitions, `RNR` stage after `contacted` routing directly into `follow_up`, lost reentry (6 days) with one follow-up at day 5, lost 2× → exit and hide from list, no-show reentry (6 days) → follow_up with `noShowFollowUpUntil` support, follow-up schedule at +6 hours, +1 day, +3 days, and +5 days from the user-selected follow-up datetime, no-show follow-up days [4, 8] and exit after 2, referral create in same role, review request sent immediately when lead is marked Done, “Create lead from review” UI reusing referral flow.
- **Remaining:** None; all flowchart rules above are implemented.

Use this file as context when answering questions about lead stages, transitions, post-booking flow, 6-day rules, or referral behavior.
