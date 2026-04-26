# FlowFD Frontend

Next.js App Router app that serves both the marketing site and the SaaS dashboard from a single codebase.

- **Framework**: Next.js (App Router), TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **State**: TanStack Query, Firebase Firestore real-time listeners
- **i18n**: next-intl (Korean default, English)
- **Payments**: Paddle.js overlay checkout
- **Hosting**: Firebase App Hosting

---

## Quick Start

```bash
cd frontend
cp .env.example .env.local   # fill in Firebase + API keys
npm install
npm run dev                  # http://localhost:3000
```

---

## Subdomain Routing

One Next.js app handles two domains via `middleware.ts`:

| Domain | Route group | Purpose |
|--------|-------------|---------|
| `www.flowfd.com` | `app/(landing)/` | Marketing, Pricing, Legal pages |
| `app.flowfd.com` | `app/(app)/` | Dashboard, Projects, Settings |
| `app.flowfd.com/login` | `app/(auth)/` | Login, Register |

In local dev both domains point to `localhost:3000`. The middleware reads the `host` header and rewrites paths accordingly.

---

## Route Map

```
app/
├── (landing)/
│   ├── page.tsx              Landing page
│   ├── pricing/page.tsx
│   ├── terms/page.tsx
│   ├── privacy/page.tsx
│   └── refund/page.tsx
│
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
│
└── (app)/
    ├── dashboard/page.tsx
    ├── projects/
    │   ├── new/page.tsx
    │   └── [projectId]/
    │       ├── layout.tsx        Project header tabs + JobStatusPanel
    │       ├── page.tsx          Project home (CPS summary)
    │       ├── meetings/page.tsx
    │       ├── cps/page.tsx
    │       ├── prd/page.tsx
    │       ├── plan/page.tsx
    │       └── sync/page.tsx
    ├── settings/page.tsx
    └── billing/
        ├── page.tsx
        ├── plans/page.tsx
        └── success/page.tsx
```

The `[projectId]/layout.tsx` renders the project tab bar (Home · Meetings · CPS · PRD · Plan) and mounts a `JobStatusPanel` that listens to Firestore in real time to surface background job progress.

---

## Key Patterns

### API calls
All HTTP calls go through typed clients in `lib/api/`. Each file maps to one backend domain:

```
lib/api/
  projectApi.ts   meetingApi.ts   cpsApi.ts
  prdApi.ts       designApi.ts    githubApi.ts
  billingApi.ts   settingsApi.ts  authApi.ts
```

The base client (`lib/api/client.ts`) attaches the Firebase ID token as `Authorization: Bearer <jwt>` automatically.

### Real-time updates
Background jobs write progress to Firestore. The frontend listens with `onSnapshot` rather than polling, so status badges and job panels update the moment the backend writes.

### i18n
All UI strings go through `useTranslations()` — no hardcoded text. Translation files are in `messages/ko.json` and `messages/en.json`. Language preference is stored in `users/{uid}.settings.display.language`.

### Credits guard
Before triggering an analysis the frontend reads current credit balance from `GET /billing/credits` and blocks the action if insufficient, showing the balance and required amount.

---

## Component Highlights

| Component | Location | Notes |
|-----------|----------|-------|
| `JobStatusPanel` | `components/project/` | Firestore real-time job progress overlay |
| `CpsViewer` | `components/cps/` | Collapsible section viewer with confidence badges |
| `PrdViewer` | `components/prd/` | Kanban (Must/Should/Could) + document toggle |
| `MeetingForm` | `components/meeting/` | Markdown editor with file upload tab |
| `AutomationSection` | `components/settings/` | Analysis mode + auto-regenerate toggles |
| `SectionCollapse` | `components/ui/` | Generic expand/collapse card wrapper |

---

## Environment Variables

```env
# Firebase (client-side, safe to expose)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Backend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Paddle
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox
```

---

## Deployment

Pushes to `main` that touch `frontend/**` trigger Firebase App Hosting deployment automatically via GitHub Actions (`deploy-frontend.yml`).
