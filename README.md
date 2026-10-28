# Omni Automata (OmniMarket AI)

> **Autonomous AI-Powered Social Media Post Generator & Multi-Platform Publishing Engine**

Omni Automata is an enterprise-grade, full-stack web application built with **React 19**, **TanStack Start**, **Supabase**, and modern AI models (**DeepSeek** and **Google Gemini**). It automates the entire social media post workflow: transforming media assets and marketing prompts into platform-optimized post variants, scheduling them on an automated calendar, publishing live to **Instagram**, **Facebook**, **YouTube**, and **X (Twitter)**, and collecting post performance analytics.

---

## Table of Contents

1. [Key Features & Capabilities](#key-features--capabilities)
2. [Tech Stack & Architecture](#tech-stack--architecture)
3. [Architecture Overview](#architecture-overview)
4. [Project Directory Tree](#project-directory-tree)
5. [Detailed File-by-File Breakdown](#detailed-file-by-file-breakdown)
   - [Root Configuration Files](#root-configuration-files)
   - [Application Entry & Core (`src/`)](#application-entry--core-src)
   - [File-Based Routes (`src/routes/`)](#file-based-routes-srcroutes)
   - [UI & Layout Components (`src/components/`)](#ui--layout-components-srccomponents)
   - [Server Functions & Utilities (`src/lib/`)](#server-functions--utilities-srclib)
   - [Supabase Integrations & Edge Functions](#supabase-integrations--edge-functions)
   - [Diagnostic & Utility Scripts (`scratch/`)](#diagnostic--utility-scripts-scratch)
6. [Database Schema & Architecture (`db.sql`)](#database-schema--architecture-dbsql)
   - [Entity Descriptions](#entity-descriptions)
   - [Row Level Security (RLS) Model](#row-level-security-rls-model)
7. [Social Platform Integrations](#social-platform-integrations)
8. [Installation & Getting Started](#installation--getting-started)
   - [Prerequisites](#prerequisites)
   - [Step 1: Clone & Install](#step-1-clone--install)
   - [Step 2: Database Initialization](#step-2-database-initialization)
   - [Step 3: Environment Setup](#step-3-environment-setup)
   - [Step 4: Launch Dev Server](#step-4-launch-dev-server)
9. [Available CLI Scripts](#available-cli-scripts)
10. [Security & Production Hardening](#security--production-hardening)

---

## Key Features & Capabilities

- **AI Post Generation Studio**
  - Transforms raw prompts, media assets, and goals into platform-tailored post variants simultaneously:
    - **Instagram**: Visual captions with structured line breaks, call-to-actions (CTAs), niche/trending hashtags, and Reel hooks.
    - **YouTube**: Click-worthy video titles (<60 chars), keyword-dense video descriptions, video tags, and automated `#Shorts` classification.
    - **X (Twitter)**: High-converting, punchy text hooks strictly within character limits (<280 chars).
    - **Facebook**: Community-focused copy optimized for page distribution with structured bullet points.
  - Smart optimal publish time calculation (selects high-converting future slots relative to current UTC timestamp).
  - Dual AI engine resilience: Primary **DeepSeek Chat** with automatic failover to **Google Gemini (1.5 Flash / Pro)** and local dynamic generator.

- **Automated Queue Scheduler & Publishing Engine**
  - Content queue tracking post lifecycle states (`pending`, `published`, `failed`).
  - Built-in background ticker pulse running every 30 seconds.
  - Atomic database post locking to guarantee idempotency and prevent duplicate dispatches.
  - Temporary cloud storage mirroring for external media URLs to satisfy Meta Graph API requirements.
  - Automatic OAuth token refresh before expiry.
  - Rate-limit pacing (1.5-second drip delay between provider dispatches).

- **Unified Social Integrations**
  - **Meta (Facebook & Instagram)**: OAuth 2.0 flow with dynamic Page ID discovery, permanent Page Access Token resolution, and Instagram Business Account link validation.
  - **Instagram Reminder Mode**: Allows creators without Facebook pages to schedule posts and receive scheduled prompts via Email or Mobile Push.
  - **Google (YouTube)**: OAuth 2.0 with resumable streaming pipeline (`youtube.upload` and `youtube.readonly` scopes).
  - **X (Twitter)**: OAuth 2.0 with PKCE and offline access token rotation.

- **Post Performance Analytics & Scraping**
  - Periodic background metrics querying live platform APIs for impressions, likes, comments, shares, and subscriber/follower counts.
  - Clean analytical dashboard view displaying total published posts, scheduled items, and connected account summaries.

- **Enterprise Security & Tenant Isolation**
  - Full Supabase SSR session handling.
  - 100% database coverage with strict Row Level Security (RLS) ensuring strict multi-tenant data segregation.
  - Zero private keys bundled in client code.

---

## Tech Stack & Architecture

| Layer | Technologies |
|---|---|
| **Frontend Framework** | [React 19](https://react.dev/), [TanStack Start](https://tanstack.com/start) (Full-stack SSR) |
| **Routing** | [TanStack Router](https://tanstack.com/router) (Strict type-safe file-based routing) |
| **State & Data Fetching** | [TanStack Query v5](https://tanstack.com/query) |
| **Styling & Design** | [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons |
| **Forms & Validation** | React Hook Form, Zod |
| **Bundler & Server** | [Vite 7](https://vitejs.dev/) + [Nitro 3](https://nitro.unjs.io/) |
| **Backend & Database** | [Supabase](https://supabase.com/) (PostgreSQL 17, PostgREST, GoTrue Auth, Storage) |
| **Serverless Functions** | Supabase Edge Functions (Deno runtime) + TanStack Server Functions (`createServerFn`) |
| **AI LLM Providers** | [DeepSeek API](https://platform.deepseek.com/) & [Google AI Studio (Gemini)](https://aistudio.google.com/) |

---

## Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │          Client Browser (UI)          │
                      │  React 19 + TanStack Router + Tailwind│
                      └──────────────────┬────────────────────┘
                                         │
                         HTTPS / RPC     │   Server Functions
                                         ▼
                      ┌───────────────────────────────────────┐
                      │      TanStack Start Server (SSR)      │
                      │    Nitro Runtime / Vite Dev Server    │
                      │                                       │
                      │  • Background Queue Scheduler (30s)   │
                      │  • SSR Route Handlers                 │
                      │  • Server Functions (AI Fallbacks)    │
                      └──────────┬─────────────────┬──────────┘
                                 │                 │
              Supabase Auth / RLS│                 │ REST / Fetch
                                 ▼                 ▼
        ┌────────────────────────────────┐    ┌────────────────────────────────┐
        │        Supabase Cloud          │    │          AI Providers          │
        │                                │    │                                │
        │ • PostgreSQL 17 (4 Core Tables)│    │ • DeepSeek Chat (Primary)      │
        │ • Row Level Security (RLS)     │    │ • Google Gemini (Fallback)     │
        │ • Supabase Storage (media)     │    └────────────────────────────────┘
        │ • Edge Functions (Deno):       │
        │    - generate-campaign         │
        │    - publish-queue             │
        │    - fetch-analytics           │
        └────────────────┬───────────────┘
                         │
                         │ Platform Dispatches (OAuth 2.0)
                         ▼
        ┌────────────────────────────────────────────────────────┐
        │                  Social Media APIs                     │
        │                                                        │
        │ • Meta Graph API v19.0 (Instagram & Facebook Pages)    │
        │ • Google YouTube Data API v3 (Resumable Uploads)       │
        │ • X (Twitter) API v2 (Tweets & Metrics)                │
        └────────────────────────────────────────────────────────┘
```

---

## Project Directory Tree

```text
omni-automata-main1/
├── .env.example                   # Template environment variables with documentation
├── .gitignore                     # Git ignore rules for logs, secrets, build artifacts
├── .prettierrc                    # Prettier formatting rules
├── .prettierignore                # Ignored files for formatting
├── bun.lock                       # Bun package manager lockfile
├── bunfig.toml                    # Bun configuration options
├── components.json                # shadcn/ui configuration metadata
├── db.sql                         # Executable SQL schema for tables, triggers & RLS
├── eslint.config.js               # ESLint 9 configuration with TypeScript & React plugins
├── package.json                   # Project dependencies and script declarations
├── package-lock.json              # NPM dependency tree lockfile
├── platform.log                   # Server execution and queue log destination
├── tsconfig.json                  # TypeScript compiler options and path aliases
├── vite.config.ts                 # Vite bundler configuration with TanStack Start
├── README.md                      # Project documentation
│
├── scratch/                       # Diagnostic and maintenance scripts (local testing)
│   ├── check_accounts.js          # Queries connected social accounts from Supabase
│   ├── check_failed.js            # Inspects failed queue posts and error messages
│   ├── check_queue_state.js       # Checks pending posts vs current UTC timestamp
│   ├── diagnose_queue.js          # Comprehensive queue state and direct edge trigger test
│   ├── retry_failed.js            # Resets failed posts to pending for re-execution
│   └── test_fb.js                 # Tests Facebook Graph API tokens and debug endpoints
│
├── supabase/                      # Supabase CLI and Edge Functions
│   ├── config.toml                # Supabase local development configuration
│   ├── migrations/                # Database migrations
│   │   └── 20260529000000_omnimarket_schema.sql # Core social automation SQL schema
│   └── functions/                 # Supabase Edge Functions (Deno runtime)
│       ├── generate-campaign/     # Edge function generating multi-channel AI copy
│       │   └── index.ts
│       ├── fetch-analytics/       # Edge function scraping live follower & post metrics
│       │   └── index.ts
│       └── publish-queue/         # Hardened edge function publishing queued media
│           └── index.ts
│
└── src/                           # Application source code
    ├── main.tsx                   # Client-side bootstrap
    ├── router.tsx                 # TanStack Router instance and QueryClient binding
    ├── routeTree.gen.ts           # Auto-generated route tree from routes/ directory
    ├── server.ts                  # Server entry point, SSR wrapper, scheduler bootstrap
    ├── start.ts                   # TanStack Start middleware and server lifecycle setup
    ├── styles.css                 # Global CSS, Tailwind utilities, and theme tokens
    │
    ├── hooks/                     # Custom React hooks
    │   └── use-mobile.tsx         # Media-query hook detecting mobile viewport sizes
    │
    ├── integrations/              # Third-party service clients
    │   └── supabase/
    │       └── client.ts          # Universal Supabase client with diagnostics
    │
    ├── components/                # Reusable React components
    │   ├── app-sidebar.tsx        # Navigation sidebar with auth state and navigation
    │   ├── brand-logo.tsx         # Brand logo component with collapsible states
    │   ├── metric-card.tsx        # Dashboard metric widget with delta trends
    │   ├── platform-icon.tsx      # Social platform icons (IG, FB, YT, X) and labels
    │   ├── status-badge.tsx       # Status indicator for queue (`pending`, `published`, etc.)
    │   │
    │   ├── dashboard/             # Dashboard-specific composite widgets
    │   │   ├── activity-table.tsx     # Recent post history and performance table
    │   │   └── ai-insights-panel.tsx  # Dynamic AI post timing tips and suggestions
    │   │
    │   └── ui/                    # 46+ Radix-based atomic UI primitives (buttons,
    │       ├── button.tsx         # dialogs, tables, cards, dropdowns, inputs, sheets...)
    │       ├── card.tsx
    │       ├── dialog.tsx
    │       ├── table.tsx
    │       └── ...
    │
    ├── lib/                       # Utility libraries, logging, and backend helpers
    │   ├── config.server.ts       # Server-only environment variable loader
    │   ├── error-capture.ts       # Error interception and SSR exception tracking
    │   ├── error-page.ts          # HTML error fallback template
    │   ├── logger.ts              # File-based logger writing to platform.log
    │   ├── mock-data.ts           # Platform definitions, default metrics, and fallback data
    │   ├── queue-scheduler.ts     # In-process periodic background queue publisher
    │   ├── utils.ts               # Classname merger (`cn` utility via clsx & tailwind-merge)
    │   │
    │   └── api/                   # TanStack Start server functions (`createServerFn`)
    │       ├── campaign.functions.ts  # Server function executing AI post generation
    │       ├── logs.functions.ts      # Server functions to read and clear platform.log
    │       └── example.functions.ts   # Reference implementation for server functions
    │
    └── routes/                    # File-based application routes
        ├── README.md              # Route naming conventions and documentation
        ├── __root.tsx             # Root layout wrapping all pages (Head, QueryProvider)
        ├── _app.tsx               # Protected workspace shell with sidebar and auth gate
        ├── _app.index.tsx         # Main Dashboard: live metrics, next post, activity
        ├── _app.creator.tsx       # AI Campaign Creator: media upload, prompts, post editor
        ├── _app.queue.tsx         # Content Queue: scheduled post management & calendar
        ├── _app.integrations.tsx  # Integrations: OAuth account connect & reminder mode
        ├── auth.tsx               # Authentication: login, registration, password reset
        └── privacy.tsx            # Public Privacy Policy & Meta Data Deletion callback
```

---

## Detailed File-by-File Breakdown

### Root Configuration Files

| File | Purpose |
|---|---|
| [`.env.example`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/.env.example) | Public environment variable blueprint containing placeholder keys, variable descriptions, and provider links. |
| [`.gitignore`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/.gitignore) | Ensures secrets (`.env*`), temporary files (`scratch/`, `supabase/.temp/`), build outputs (`dist/`), and logs (`platform.log`) are never committed. |
| [`package.json`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/package.json) | Defines project metadata, script commands (`dev`, `build`), and dependencies (React 19, TanStack Start, Supabase, Radix). |
| [`vite.config.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/vite.config.ts) | Vite build configuration leveraging `@lovable.dev/vite-tanstack-config` to bundle Nitro SSR and client assets. |
| [`tsconfig.json`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/tsconfig.json) | TypeScript compiler options enabling strict mode, JSX transformation, and `@/*` path aliases. |
| [`eslint.config.js`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/eslint.config.js) | ESLint configuration enforcing code quality and React hook rules. |
| [`components.json`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/components.json) | Configuration file for shadcn/ui detailing styling paths and icon libraries. |
| [`bunfig.toml`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/bunfig.toml) | Runtime configuration for Bun execution. |
| [`db.sql`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/db.sql) | Executable SQL schema creating the 4 core social automation tables, triggers, indexes, and RLS policies. |
| [`platform.log`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/platform.log) | Local append-only log file recording background queue execution, edge function dispatches, and errors. |

---

### Application Entry & Core (`src/`)

| File | Purpose |
|---|---|
| [`src/main.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/main.tsx) | Client entry point that renders the React root and initiates router hydration. |
| [`src/server.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/server.ts) | Server entry point for TanStack Start SSR; kicks off [`startQueueScheduler()`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/lib/queue-scheduler.ts) and handles SSR error normalization. |
| [`src/start.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/start.ts) | Configures TanStack Start request middleware and global server error handling. |
| [`src/router.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/router.tsx) | Factory initializing the type-safe TanStack Router instance and attaching `QueryClient`. |
| [`src/routeTree.gen.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/routeTree.gen.ts) | Auto-generated route tree generated by TanStack Router compiler mapping files in `routes/` to type-safe URLs. |
| [`src/styles.css`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/styles.css) | Global stylesheet importing Tailwind CSS, custom design tokens, warm color palettes, and animations. |

---

### File-Based Routes (`src/routes/`)

| File | Route | Description |
|---|---|---|
| [`src/routes/__root.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/routes/__root.tsx) | — | Root route rendering the top-level HTML document, meta tags, styles, QueryClientProvider, and 404/Error fallbacks. |
| [`src/routes/_app.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/routes/_app.tsx) | `/_app/*` | Protected layout container. Checks session existence; redirects unauthenticated visitors to `/auth` and displays navigation sidebar. |
| [`src/routes/_app.index.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/routes/_app.index.tsx) | `/` | **Main Dashboard**: Displays platform connection count, published/scheduled metrics, countdown to next scheduled post, and live activity feeds. |
| [`src/routes/_app.creator.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/routes/_app.creator.tsx) | `/creator` | **Campaign Creator**: Drag-and-drop media upload (images/videos), post prompt input, platform selection, one-click AI generation, variant editor, and scheduling trigger. |
| [`src/routes/_app.queue.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/routes/_app.queue.tsx) | `/queue` | **Content Queue & Scheduler**: Displays scheduled posts, filterable by status (`pending`, `published`, `failed`), retry triggers, and post deletion. |
| [`src/routes/_app.integrations.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/routes/_app.integrations.tsx) | `/integrations` | **Platform Integrations**: Connect and disconnect YouTube, Instagram, Facebook, and X. Manages OAuth callbacks and provides Instagram Manual Reminder Mode. |
| [`src/routes/auth.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/routes/auth.tsx) | `/auth` | **Authentication Page**: Clean tabbed interface for User Login and Registration using Supabase Auth with toast notifications. |
| [`src/routes/privacy.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/routes/privacy.tsx) | `/privacy` | **Privacy Policy & Data Deletion**: Public compliance page detailing data protection policies and Meta Graph API data deletion instructions. |

---

### UI & Layout Components (`src/components/`)

- **[`app-sidebar.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/components/app-sidebar.tsx)**: Left navigation sidebar highlighting active routes, workspace status, user email, and sign-out button.
- **[`brand-logo.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/components/brand-logo.tsx)**: Brand identity asset featuring the OmniMarket AI flame icon with expanded and collapsed variants.
- **[`metric-card.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/components/metric-card.tsx)**: Reusable metric KPI card displaying count, icon, helper description, and positive/negative trend pills.
- **[`platform-icon.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/components/platform-icon.tsx)**: Helper rendering branded SVG icons and official labels for Instagram, Facebook, YouTube, and X.
- **[`status-badge.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/components/status-badge.tsx)**: Color-coded status badge for queue states (`pending`, `published`, `failed`).
- **`dashboard/`**:
  - **[`activity-table.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/components/dashboard/activity-table.tsx)**: Formatted table of recent publishing executions, target platforms, and timestamps.
  - **[`ai-insights-panel.tsx`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/components/dashboard/ai-insights-panel.tsx)**: Strategic post advice cards recommending optimal post formats, hashtags, and timing.
- **`ui/`**: 46+ accessible UI primitives built on Radix UI, including Accordion, Alert, Button, Calendar, Dialog, DropdownMenu, Progress, Select, Sheet, Table, Tabs, and Toast notifications via Sonner.

---

### Server Functions & Utilities (`src/lib/`)

- **[`api/campaign.functions.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/lib/api/campaign.functions.ts)**:
  - TanStack Server Function (`generateCampaign`) executed strictly on the server.
  - Calls Supabase Edge Function `generate-campaign` if deployed; seamlessly falls back to direct DeepSeek or Google Gemini API calls using server environment variables.
  - Includes smart keyword extraction and offline dynamic campaign generation fallback if AI APIs are unavailable or quota is exceeded.
- **[`api/logs.functions.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/lib/api/logs.functions.ts)**:
  - Server functions `getPlatformLogs` and `clearPlatformLogs` to safely stream and clear `platform.log` on demand.
- **[`queue-scheduler.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/lib/queue-scheduler.ts)**:
  - In-process background scheduler running every 30 seconds inside the server process.
  - Triggers the `publish-queue` Supabase Edge Function to evaluate and dispatch due posts.
  - Synchronizes outcomes and appends formatted status messages to `platform.log`.
- **[`logger.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/lib/logger.ts)**:
  - Safe file-based logging utility appending timestamped info and error lines to `platform.log`.
- **[`error-capture.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/lib/error-capture.ts)** & **[`error-page.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/lib/error-page.ts)**:
  - SSR error capture helpers that catch runtime exceptions and render user-friendly diagnostic HTML pages.
- **[`mock-data.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/lib/mock-data.ts)**:
  - Type definitions (`PlatformId`, `PlatformConfig`), permission specifications, and fallback metric generators.
- **[`utils.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/lib/utils.ts)**:
  - Standard `cn(...)` utility combining `clsx` and `tailwind-merge` for dynamic Tailwind classes.

---

### Supabase Integrations & Edge Functions

- **[`src/integrations/supabase/client.ts`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/src/integrations/supabase/client.ts)**:
  - Universal Supabase browser & SSR client initialization. Reads from `VITE_SUPABASE_URL` or `SUPABASE_URL` with masked console connection diagnostics.
- **`supabase/functions/generate-campaign/index.ts`**:
  - Deno Edge Function using DeepSeek API with structured JSON Schema output. Validates incoming requests and returns custom platform copy, tags, and suggested future ISO timestamps.
- **`supabase/functions/publish-queue/index.ts`**:
  - Hardened production publisher.
  - Queries past-due pending posts atomically (`status = 'pending'`, `scheduled_time <= now`).
  - Verifies and refreshes OAuth tokens for expired sessions.
  - Downloads external video/image links (e.g., Google Drive) and temporarily mirrors them to Supabase Storage so Meta Graph API can process them reliably.
  - Automatically resolves managed Facebook Page IDs and permanent Page Access Tokens.
  - Handles resumable video upload chunks to YouTube Data API v3.
  - Enforces a 1.5s rate-limit drip between platform posts.
- **`supabase/functions/fetch-analytics/index.ts`**:
  - Edge function invoked periodically or on demand.
  - Scrapes follower counts and post metrics (impressions, likes, comments, shares) from Meta Graph API, YouTube Channel API, and X API.
  - Stores aggregated metrics in the `analytics` database table.

---

### Diagnostic & Utility Scripts (`scratch/`)

The `scratch/` folder contains standalone diagnostic utilities for local maintenance and debugging:

- **[`check_accounts.js`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/scratch/check_accounts.js)**: Reads `.env` and prints all connected social accounts in the database.
- **[`check_failed.js`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/scratch/check_failed.js)**: Queries the most recent failed queue posts and outputs exact error messages.
- **[`check_queue_state.js`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/scratch/check_queue_state.js)**: Displays pending queue posts alongside current UTC time to diagnose scheduling delays.
- **[`diagnose_queue.js`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/scratch/diagnose_queue.js)**: Comprehensive diagnostic test querying all queue rows and triggering the `publish-queue` edge function directly.
- **[`retry_failed.js`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/scratch/retry_failed.js)**: Resets failed queue entries back to `pending` with `scheduled_time = now` so the scheduler immediately retries them.
- **[`test_fb.js`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/scratch/test_fb.js)**: Direct check verifying Facebook Page access tokens and permissions against the Graph API.

---

## Database Schema & Architecture (`db.sql`)

The database is built on **PostgreSQL 17** via Supabase. It features 4 dedicated tables specifically designed for social media post creation, multi-platform publishing, and performance tracking.

### Entity Descriptions

| Table Name | Description | Key Columns |
|---|---|---|
| `users` | User profile records synced with Supabase Auth (`auth.users`). Tracks free AI credits. | `id`, `email`, `ai_credits`, `created_at`, `updated_at` |
| `social_accounts` | Stored OAuth credentials and account state for connected platforms. | `id`, `user_id`, `platform_name`, `platform_account_id`, `platform_account_name`, `access_token`, `refresh_token`, `token_expires_at` |
| `content_queue` | Central social publishing queue tracking scheduled posts, media URLs, and AI-generated variants. | `id`, `user_id`, `media_url`, `platform_targets`, `ai_generated_content` (JSONB), `scheduled_time`, `status`, `error_message` |
| `analytics` | Metric records per published post across target platforms. | `id`, `post_id`, `platform`, `impressions`, `likes`, `shares`, `comments`, `updated_at` |

### Row Level Security (RLS) Model

Strict multi-tenant isolation is enforced at the database layer via PostgreSQL RLS policies:

- **`users` Table**: Users can view and update only their own profile (`auth.uid() = id`).
- **`social_accounts` Table**: Users can view, connect, and disconnect only their own social accounts (`auth.uid() = user_id`).
- **`content_queue` Table**: Users can create, update, delete, and view only their own scheduled posts (`auth.uid() = user_id`).
- **`analytics` Table**: Users can inspect metrics only for posts they own via a relational subquery checking `content_queue.user_id = auth.uid()`.
- **System Automation**: The background publishing worker uses the Supabase `service_role` key to process due posts securely across accounts while preserving strict user isolation.

---

## Social Platform Integrations

| Platform | Authentication | Publishing Capabilities | Media Format Supported |
|---|---|---|---|
| **Instagram** | Meta OAuth 2.0 / Manual Handle | Direct Auto-Publish (Reels, Posts, Stories) or Reminder Prompts | Images (JPG, PNG), Videos (MP4, MOV) |
| **Facebook** | Meta OAuth 2.0 (Page Access Token) | Feed Posts, Page Stories, Video Posts | Images (JPG, PNG), Videos (MP4) |
| **YouTube** | Google OAuth 2.0 (`youtube.upload`) | Resumable video upload pipeline, automated Shorts detection | Videos (MP4, MOV, WebM) |
| **X (Twitter)**| Twitter OAuth 2.0 with PKCE | Text hook updates, scheduled thread posts | Text hooks (<280 chars) |

---

## Installation & Getting Started

### Prerequisites

- **Node.js** (v18.0.0 or higher) or **Bun** (v1.0.0 or higher).
- A free **[Supabase](https://supabase.com/)** project account.
- An API Key from **[DeepSeek](https://platform.deepseek.com/)** or **[Google AI Studio](https://aistudio.google.com/)** (Gemini).

---

### Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/bhanuprakashbhavanam1-cmd/social_media_automation.git
cd social_media_automation


# Install dependencies using npm
npm install

# Or using Bun
bun install
```

---

### Step 2: Database Initialization

1. Open your **Supabase Dashboard** -> Select your Project.
2. Navigate to the **SQL Editor** on the left menu.
3. Open [`db.sql`](file:///c:/Users/bhanu/Desktop/Projects/Capston_Project/omni-automata-main1/db.sql) (or `supabase/migrations/20260529000000_omnimarket_schema.sql`).
4. Paste the SQL statements into the editor and click **Run** to set up the 4 tables, triggers, indexes, and RLS policies.
5. Create a Storage Bucket named `media` in Supabase Storage with public access enabled for uploaded post assets.

---

### Step 3: Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase and AI engine keys:

```env
# Supabase Configuration (Supabase Dashboard -> Project Settings -> API)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# AI Engine Key (DeepSeek or Google Gemini)
DEEPSEEK_API_KEY=your-deepseek-api-key
GEMINI_API_KEY=your-google-gemini-api-key
```

---

### Step 4: Launch Dev Server

Start the local development server:

```bash
npm run dev
# or with bun
bun dev
```

Visit `http://localhost:3000` in your browser.

1. Navigate to `/auth` to register your first workspace account.
2. Go to `/integrations` to connect your social platforms or enable Instagram Reminder Mode.
3. Open `/creator` to generate your first AI post and schedule it to the `/queue`.

---

## Available CLI Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts the Vite development server with hot module reloading and SSR support. |
| `npm run build` | Compiles full-stack production build via Vite & Nitro engine into `dist/`. |
| `npm run build:dev` | Compiles application bundle with development-mode flags for debugging. |
| `npm run preview` | Spins up a local production HTTP server to test the production bundle. |
| `npm run lint` | Runs ESLint across all TypeScript and React files. |
| `npm run format` | Runs Prettier across the codebase to ensure consistent code styling. |

---

## Security & Production Hardening

1. **Client vs. Server Key Separation**:
   - Variables prefixed with `VITE_` are client-facing and bundled into the browser bundle (e.g. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
   - Server-only keys (`DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are kept strictly on the server and are never exposed to browser bundles.
2. **PostgreSQL Row Level Security (RLS)**:
   - Every single read, insert, update, and delete operation is verified against `auth.uid()`, guaranteeing absolute tenant isolation.
3. **Idempotency & Race Condition Prevention**:
   - The queue scheduler utilizes atomic row updates with a 5-minute lock window, ensuring concurrent cron triggers do not duplicate social dispatches.
4. **Token Security**:
   - OAuth tokens are refreshed automatically before expiration.
   - For Facebook, Page Access Tokens are resolved dynamically and stored securely.