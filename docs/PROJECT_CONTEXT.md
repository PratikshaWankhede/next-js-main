# Project context (Next.js CRM)

This document is the **high-level map** of the repository: tech stack, folder layout, data model, main API surface, integrations, automation, and where to read more. Use it as onboarding or AI context alongside the focused spec in [`LEAD_FLOW.md`](./LEAD_FLOW.md).

---

## 1. What this project is

- **Purpose:** A **tattoo-studio style CRM** built on the [shadcn-admin](https://github.com/Its-Nyein/shadcn-admin) template: leads, stages, follow-ups, chat (WhatsApp / Instagram / in-app), SLA, notifications, analytics (admin), lead routing, booking reminders, and AI-assisted summaries and scoring.
- **Runtime:** [Next.js](https://nextjs.org/) **16** (App Router), **React 19**, **TypeScript**.
- **Database:** [MongoDB](https://www.mongodb.com/) via the native driver (`mongodb` package)—collections are defined in TypeScript in `db/collections.ts` (not a separate ORM schema for app data).
- **Auth:** [NextAuth.js](https://next-auth.js.org/) v4 with **Credentials** provider, **JWT** sessions, [MongoDB adapter](https://authjs.dev/reference/adapter/mongodb), bcrypt password verification (`lib/nextauth.ts`).

---

## 2. Tech stack (from `package.json`)

| Area               | Choices                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| UI                 | React 19, Tailwind CSS 4, Radix UI, shadcn-style components (`components/ui`), Tabler / Lucide icons |
| Forms / validation | react-hook-form, Zod                                                                                 |
| Tables / DnD       | TanStack Table, dnd-kit                                                                              |
| Charts             | Recharts                                                                                             |
| AI                 | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`) — see `lib/ai/`                             |
| Realtime           | `ws` server (`lib/ws/server.ts`, script `ws:server`) + client contexts for notifications             |
| Email              | Nodemailer (`lib/notifications/email.ts`)                                                            |
| Push               | web-push (`lib/notifications/web-push.ts`)                                                           |

**Scripts of note:** `dev`, `build`, `start`, `db:seed`, `ws:server`, `cron:followups`, `cron:sla`, `cron:notifications` (see [§7 Automation](#7-automation-cron-and-background-jobs)).

---

## 3. Repository folder structure

Top-level layout (excluding `node_modules`, `.next`, `.git`):

| Path               | Role                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `app/`             | Next.js App Router: pages, layouts, API routes                                                                              |
| `app/(dashboard)/` | Authenticated CRM UI (sidebar, header); `isAuthenticated()` in layout                                                       |
| `app/(auth)/`      | Sign-in, sign-up, password reset flows                                                                                      |
| `app/(errors)/`    | Error/status pages (403, 404, 500, maintenance, etc.)                                                                       |
| `app/api/`         | REST-style route handlers (`route.ts`)                                                                                      |
| `components/`      | Shared UI: `ui/` (primitives), `crm/`, `ai-elements/`, layout pieces                                                        |
| `config/`          | Theme and app config helpers                                                                                                |
| `constants/`       | Static data (e.g. `sidebar-data.ts`)                                                                                        |
| `contexts/`        | React providers (auth, theme, sidebar, notifications socket, etc.)                                                          |
| `db/`              | Mongo connection (`index.ts`), collection name constants and TS types (`collections.ts`), migrations under `db/migrations/` |
| `docs/`            | Project documentation (`LEAD_FLOW.md`, this file)                                                                           |
| `features/`        | Feature modules (leads, kanban, chat, analytics, auth, calendar, …)                                                         |
| `helpers/`         | Small utilities (e.g. UUID generation)                                                                                      |
| `hooks/`           | Custom hooks                                                                                                                |
| `lib/`             | Core logic: auth, AI, cron, integrations (WhatsApp/Instagram), notifications, storage (S3), RBAC, validations               |
| `public/`          | Static assets                                                                                                               |
| `scripts/`         | One-off / maintenance scripts (seed user, etc.)                                                                             |
| `types/`           | Shared TS types (e.g. NextAuth module augmentation)                                                                         |
| `utils/`           | General utilities                                                                                                           |

**Parallel route groups under `app/(dashboard)/`:** The CRM uses routes such as `/leads`, `/follow-ups`, `/kanban`, `/calendar`, `/analytics`, `/settings/*`, etc. Some template/demo folders may still exist under `app/(dashboard)/crm/` or `admin/` in the tree—**the primary lead experience is under `/leads` and `/leads/[id]`** unless your team routes otherwise.

---

## 4. Application logic (how pieces fit)

### 4.1 Authentication and authorization

- **Session:** JWT; user id and **role** are loaded from DB in JWT callback (`lib/nextauth.ts`).
- **Roles:** `admin` \| `sales` \| `follow_up_candidate` (`lib/rbac.ts`).
- **Dashboard gate:** `app/(dashboard)/layout.tsx` redirects unauthenticated users to `/sign-in`.
- **API protection:** Routes use `getSessionWithRole` / `requireAuth` / `requireAdmin` and `canAccessLead()` so **sales** and **follow_up_candidate** users only see leads assigned to them unless **admin**.

### 4.2 Leads and pipeline

- **Stages, transitions, post-booking rules:** Documented in detail in [`docs/LEAD_FLOW.md`](./LEAD_FLOW.md) (stage map, allowed transitions, referral action, automation intent).
- **Stage changes:** `app/api/leads/[id]/stage/route.ts` (and related history/timeline writes).
- **Lead document shape:** `LeadDoc` and related enums in `db/collections.ts` (sources, SLA, AI fields, booking, no-show, referral links, etc.).
- **UI:** Lead list and detail live under `app/(dashboard)/leads/` and `features/leads/`.

### 4.3 Messaging and channels

- **In-app chat:** Conversations/messages collections; APIs under `app/api/chats/[leadId]/` (fetch, send, reactions). Uploads may use S3 (`lib/storage/s3.ts`, `CHAT_UPLOADS`).
- **WhatsApp:** Webhook `app/api/webhooks/whatsapp/route.ts`; outbound helpers `lib/integrations/whatsapp.ts`. Can broadcast to WS for live UI updates.
- **Instagram:** Webhook `app/api/webhooks/instagram/route.ts` (Meta verify + signed POST), profile enrichment `lib/instagram-lead-profile.ts`, optional logging to `instagram_webhook_logs`.

### 4.4 Lead ingestion and routing

- **Routing rules:** `lead_routing_rules` / `whatsapp_numbers` collections (`db/collections.ts`); settings UI and APIs under `app/api/settings/lead-routing/`.
- **Resolver:** Inbound messages are tied to or create leads via logic such as `lib/lead-resolver.ts` (used from webhooks).

### 4.5 Follow-ups and SLA

- **Follow-ups:** Collection `follow_ups`; list/complete APIs; missed follow-ups drive notifications and some stage side-effects (`lib/cron/follow-ups.ts`).
- **SLA:** Settings in `app_settings` / dedicated SLA docs; cron `lib/cron/sla.ts`; analytics under `app/api/analytics/sla/`.

### 4.6 AI features

- Lead summary, score, insights, reply suggestions under `app/api/ai/*` with supporting modules in `lib/ai/` (model selection via `AI_PROVIDER`, `OPENAI_API_KEY`, etc. in `lib/ai/model.ts`).

### 4.7 Notifications and alerts

- In-app notifications collection + read routes; optional email/WhatsApp delivery; WebSocket broadcast for real-time UI (`lib/notifications/create-notification.ts`, contexts).
- **Alerts** (admin-oriented) under `app/api/alerts` and dashboard `/alerts`.

### 4.8 Analytics

- Admin-focused dashboards: funnel, channels, SLA, follow-ups, sales performance, AI impact (`features/analytics/`, `app/api/analytics/*`). Client pages often check `GET /api/me` for `role === "admin"`.

---

## 5. Data model (MongoDB collections)

Canonical names and TypeScript types live in **`db/collections.ts`**. Summary:

| Collection (constant)                                                  | Purpose                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------- |
| `user`, `session`, `account`, `verification`                           | NextAuth / user accounts                              |
| `leads`                                                                | Core CRM leads                                        |
| `lead_stage_history`, `lead_reassignment_logs`, `lead_timeline`        | Audit and timeline                                    |
| `follow_ups`                                                           | Scheduled follow-up tasks                             |
| `chat_conversations`, `chat_messages`, `chat_uploads`                  | Chat threads and media metadata                       |
| `notifications`, `notification_preferences`, `notification_deliveries` | Notifications                                         |
| `alerts`                                                               | SLA / follow-up alerts                                |
| `sla_logs`                                                             | SLA breach logging                                    |
| `tattoo_types`                                                         | Tattoo category catalog                               |
| `instagram_webhook_logs`, `whatsapp_webhook_logs`                      | Optional inbound webhook debug logs                   |
| `app_settings`                                                         | e.g. SLA minutes                                      |
| `lead_routing_rules`, `whatsapp_numbers`                               | Inbound routing                                       |
| `app_settings` booking templates                                       | Booking message templates (see `BookingTemplatesDoc`) |

**Required env:** `MONGODB_URI` (`db/index.ts`).

---

## 6. API routes (overview)

The app exposes many handlers under `app/api/`. Grouped by concern:

| Area                 | Example paths                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Auth                 | `app/api/auth/[...nextauth]/route.ts`, password-reset under `app/api/auth/password-reset/*`           |
| Current user         | `app/api/me/route.ts`                                                                                 |
| Users                | `app/api/users`, `app/api/users/[id]`                                                                 |
| Leads                | `app/api/leads`, `app/api/leads/[id]`, stage, reassign, booking, no-show, referral, instagram-profile |
| Follow-ups           | `app/api/follow-ups`, complete                                                                        |
| Chats                | `app/api/chats/[leadId]`, `send`, `react`                                                             |
| Uploads              | `app/api/uploads`, `uploads/[id]`                                                                     |
| Webhooks             | `app/api/webhooks/instagram`, `whatsapp`, `website`, `website-form`                                   |
| Settings             | SLA, lead routing, booking templates, tattoo types                                                    |
| Notifications / push | `notifications`, `notification-preferences`, `push-subscriptions`                                     |
| Analytics            | `app/api/analytics/*`                                                                                 |
| AI                   | `app/api/ai/*`                                                                                        |
| Calendar             | `app/api/calendar/events`                                                                             |
| Alerts               | `app/api/alerts`                                                                                      |

**Legacy / alternate CRM API:** There is also a large tree under **`app/api/crm/`** (admin assignments, duplicates, pipeline metrics, jobs, etc.). Treat it as an extended or parallel API surface—confirm which endpoints the UI calls before refactoring.

---

## 7. Automation (cron and background jobs)

| Script / entry               | File                        | Role                                                                                       |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| `cron:followups`             | `lib/cron/follow-ups.ts`    | Mark overdue follow-ups missed, notifications, some lost-stage logic after multiple misses |
| `cron:sla`                   | `lib/cron/sla.ts`           | SLA checks                                                                                 |
| `cron:notifications`         | `lib/cron/notifications.ts` | Notification delivery / sweeps                                                             |
| _(no npm script by default)_ | `lib/cron/booking.ts`       | Booking day-before / same-day reminders (`runBookingCron`)                                 |
| `ws:server`                  | `lib/ws/server.ts`          | WebSocket server for broadcasting (port `WS_PORT`, default 3001)                           |

**Lifecycle automation:** [`LEAD_FLOW.md`](./LEAD_FLOW.md) references **`lib/cron/lead-lifecycle.ts`** for lost/no-show reentry rules. In this repository that file may be **empty or unused**—confirm behavior against the stage APIs and cron jobs you actually run in production.

---

## 8. Environment variables (names only)

Do not commit secrets. Commonly referenced names (non-exhaustive):

- **Core:** `MONGODB_URI`, `AUTH_SECRET`, `NEXTAUTH_URL`
- **WhatsApp:** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, optional `WHATSAPP_SKIP_SIGNATURE_VERIFICATION`, `WHATSAPP_WEBHOOK_LOGS_ENABLED`
- **Instagram / Meta:** `INSTAGRAM_VERIFY_TOKEN`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`, optional page tokens, `META_GRAPH_API_VERSION`, `INSTAGRAM_WEBHOOK_LOGS_ENABLED`, `INSTAGRAM_PROFILE_DEBUG`
- **Realtime:** `WS_BROADCAST_URL`, `WS_PORT`, `NEXT_PUBLIC_WS_URL`
- **Public app URL:** `NEXT_PUBLIC_APP_URL`, `VERCEL_URL` (Vercel)
- **S3 (uploads):** region/bucket/key vars as used in `lib/storage/s3.ts` (`S3_REGION`, etc.)
- **AI:** `AI_PROVIDER`, `AI_MODEL`, `OPENAI_API_KEY`, Google AI keys if used
- **Email:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- **Web push:** `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_EMAIL`, `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`
- **Staff mapping:** e.g. `STAFF_WHATSAPP_PHONES` (see `lib/notifications/whatsapp-internal.ts`)

---

## 9. Configuration files

- **`next.config.ts`:** Rewrites, `images.remotePatterns` for avatars and studio domain.
- **`tsconfig.json`:** Path alias `@/*` → project root (typical for imports like `@/lib/...`).
- **`.env`:** Local secrets (not documented here).

---

## 10. Related documentation

| Document                              | Contents                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`docs/LEAD_FLOW.md`](./LEAD_FLOW.md) | Stages, `NEXT_STAGE_MAP`, post-booking flow, referral, automation rules, key file pointers |
| `CONTRIBUTING.md`                     | Generic template contributing guide (upstream shadcn-admin)                                |
| `LICENSE.md`                          | License                                                                                    |

---

## 11. Maintenance notes for contributors

- **Package name:** `package.json` still shows `"name": "shadcn-admin"`; the app metadata in `app/layout.tsx` may still say “Shadcn Admin”—update if you want branding aligned with the CRM.
- **Duplicate API patterns:** Prefer one consistent API prefix (`/api/leads` vs `/api/crm/leads`) when adding features to avoid drift.
- **Lead lifecycle:** Keep [`LEAD_FLOW.md`](./LEAD_FLOW.md) updated when business rules change; use this file for **structural** context only.

---

_Last updated: 2026-03-29 — generated to centralize project context; adjust sections as the codebase evolves._
