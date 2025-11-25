
## Tempora AI Calendar

Tempora is an AI-assisted calendar and scheduling app built on Next.js.  
It combines a rich multi-view calendar, an operations-ready admin panel, and an AI “copilot” that can inspect and modify a user’s schedules.

---

### Getting started

#### Prerequisites

- **Node.js**: **>= 20.0.0**
- **Package manager**: **pnpm** (recommended; this repo is configured for `pnpm@10`)
- **Database**: Postgres instance reachable via `DATABASE_URL`
- **Environment file**: The team-provided `.env` (or equivalent) for this project

#### 1. Install dependencies

From the project root:

```bash
pnpm install
```

#### 2. Configure environment variables

You've been provided an environment file separately.

- **Copy** the provided file to the project root as `.env` (or `.env.local` if you prefer)


#### 3. Set up the database (only for a fresh instance)

If you are pointing at the **shared team database**, it has already been migrated and seeded — you can skip this step.

If you are bringing up your **own local Postgres instance** for the first time, apply the Prisma schema and seed the initial data:

```bash
pnpm db:push    # or pnpm db:migrate if you are maintaining migrations
pnpm db:seed
```

This will create the core tables (`users`, `friendships`, `schedules`, `events`) and seed sample data from `prisma/seed-data`.

#### 4. Run the development server

```bash
pnpm dev
```

Then open `http://localhost:3000` in your browser.

#### 5. Useful scripts

- **Lint**: `pnpm lint`
- **Unit tests**: `pnpm test`
- **E2E tests (Playwright)**: `pnpm e2e:headless`
- **Storybook**: `pnpm storybook`

---

### Application overview

- **Calendar experience**
  - Authenticated users can review their schedules in rich **month, week, and day** views (`/calendar`).
  - Events are grouped per schedule and color-coded; key statistics are surfaced (total events, active days, etc.).

- **Tempora Copilot (AI assistant)**
  - A docked chatbot that appears over the UI, labeled **“Tempora Copilot”**.
  - Backed by **OpenAI gpt-5-mini** via LangChain tools.
  - Can **list schedules, inspect events, create/update/delete events**, and summarize timelines for the **currently authenticated** user only.

- **Admin Control Center**
  - Accessible only to authenticated users with `user.type === "ADMIN"`.
  - Provides a **table-style CRUD view** for `users`, `friendships`, `schedules`, and `events`.
  - Inline editing with an *Edit mode* toggle, backed by `/api/admin/data` and `/api/admin/update`.

- **Authentication**
  - Uses **NextAuth v5 (Auth.js)** with Prisma-backed users.
  - Protects the calendar, admin panel, and AI tools so they operate strictly on the signed-in user’s data.

---

### Tech stack

- **Framework**
  - **Next.js 15** (App Router, TypeScript, `app/` directory)
  - **React 19**

- **Styling & UI**
  - **Tailwind CSS v4**
  - **HeroUI** for application components (cards, tables, buttons, etc.)
  - **Radix UI** primitives (tooltips, dialogs, etc.)
  - Custom visual components for calendar experiences and animated backgrounds (`MovingBlob`, etc.)

- **Backend & data**
  - **PostgreSQL** database
  - **Prisma** ORM (`prisma/schema.prisma`, `prisma/seed.ts`)
  - **Next.js Route Handlers** under `app/api/*` for auth, admin endpoints, health, and chatbot

- **Auth & security**
  - **NextAuth v5** with Prisma adapter and session-based access control
  - Role-aware admin surface (`USER` vs `ADMIN`)

- **AI & automation**
  - **OpenAI** via `@langchain/openai`
  - **LangChain** tools to read/update schedules and events in a safe, validated way

- **Tooling & quality**
  - **TypeScript** with strict config and `ts-reset`
  - **ESLint 9** + **Prettier**
  - **Vitest** + **React Testing Library** for unit/component tests
  - **Playwright** for end-to-end tests
  - **Storybook 8** for isolated UI development
  - **OpenTelemetry** integration for observability (via `@vercel/otel`)

---

### License

MIT
