## toggl-trackr ⌛

planned 📐 (docs/prd.md) with help from **Claude Code v2.1.33; Opus 4.6**  
implemented 🧩 with help from **OpenAI Codex v0.98.0; gpt-5.1-codex-max**  
made 🧪 with ♥

---

### Table of Contents

- [Introduction](#introduction)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [a) Local](#a-local)
  - [b) With Docker Compose](#b-with-docker-compose)
- [Configuration Reference](#configuration-reference)
- [Usage](#usage)
- [Tests & Quality](#tests--quality)
- [Architecture (quick)](#architecture-quick)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

### Introduction <a id="introduction"></a>

toggl-trackr pulls your Toggl Track entries, rolls them up by week, and compares actual hours against your targets (with optional mock data when you just want to try it). You can mark individual days off in any week so the weekly target shrinks automatically. The whole thing runs as a small React + Express app that stays local unless you add your own Toggl API token.

### Screenshots <a id="screenshots"></a>

| Current Week + Plus Hours + Light Mode                                                                                        | History + Minus Hours + Dark Mode                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| <img width="1259" alt="Current Week" src="https://github.com/user-attachments/assets/a88f537a-bae8-425b-ba11-4e8c3d468a90" /> | <img  width="1259" alt="image" src="https://github.com/user-attachments/assets/46bb0986-573a-453e-8260-3015eb948752" /> |

### Tech Stack <a id="tech-stack"></a>

- Frontend: React 18, Vite, Tailwind.
- Backend: Express + TypeScript; calls Toggl API v9 (or mock data in `TEST_MODE`).
- Tooling: pnpm, eslint/prettier, tsx, Docker Compose for local container runs.

### Getting Started <a id="getting-started"></a>

#### a) Local <a id="a-local"></a>

1. Dependencies:
   ```sh
   corepack enable
   pnpm install
   ```
2. Copy `.env.example` to `.env` and adjust values:
   - `TEST_MODE`: keep `true` to use mocked data; set to `false` for live Toggl calls.
   - `TOGGL_API_TOKEN`: when live, grab your personal token from https://track.toggl.com/profile.
   - `START_DATE`: Monday of the first week you want included (ISO date, e.g., `2026-01-01`).
   - `TARGET_HOURS_PER_WEEK` / `HOURS_PER_DAY` / `DAYS_PER_WEEK`: tune to your schedule for accurate UI targets.
3. Dev server:
   ```sh
   pnpm dev
   ```
   Frontend at http://localhost:51731, API at http://localhost:43001 (proxied by Vite).

#### b) With Docker Compose <a id="b-with-docker-compose"></a>

1. Copy `.docker.env` from `.docker.env.example` and set your values as above.
2. Start:
   ```sh
   docker compose up --build
   ```
3. Frontend: http://localhost:51731  
   API: http://localhost:43001

### Configuration Reference <a id="configuration-reference"></a>

| Variable                | Description                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `TEST_MODE`             | `true` uses bundled sample entries; `false` calls Toggl live API.                   |
| `TOGGL_API_TOKEN`       | Personal Toggl API token (https://track.toggl.com/profile); only used in live mode. |
| `TOGGL_API_ME_URL`      | Base URL for Toggl v9 `me` endpoint; change only if Toggl moves.                    |
| `START_DATE`            | Monday for the first week to include in rollups (ISO date).                         |
| `TARGET_HOURS_PER_WEEK` | Weekly target hours shown in UI.                                                    |
| `HOURS_PER_DAY`         | Expected daily hours; used to reduce targets when marking days off.                 |
| `DAYS_PER_WEEK`         | Working days per week for UI reference.                                             |

### Usage <a id="usage"></a>

- UI: open http://localhost:51731 and pick weeks; mark days off to see targets adjust.
- API samples:
  - Config: `curl http://localhost:43001/api/config`
  - Hours: `curl http://localhost:43001/api/hours`
  - Get days off: `curl http://localhost:43001/api/days-off`
  - Set days off: `curl -X PUT http://localhost:43001/api/days-off -H 'Content-Type: application/json' -d '{"weekStart":"2026-01-05","daysOff":[0,4]}'`

### Tests & Quality <a id="tests--quality"></a>

- Type checks: `pnpm lint:client` and `pnpm lint:server`
- ESLint: `pnpm lint:eslint`
- Prettier check: `pnpm lint:prettier`
- Full lint suite: `pnpm lint`

### Architecture (quick) <a id="architecture-quick"></a>

- Frontend (Vite) calls backend at `/api/*`.
- Backend aggregates Toggl entries to weekly summaries; mock data when `TEST_MODE=true`.
- Days off persistence stored in `server/data.json` on disk.

### Troubleshooting <a id="troubleshooting"></a>

- 500 on `/api/hours`: ensure `TEST_MODE=false` has `TOGGL_API_TOKEN` set.
- Wrong week range: set `START_DATE` to a Monday (ISO format).
- CORS/localhost issues: Vite dev proxies API; ensure dev server is running.

### Contributing <a id="contributing"></a>

- Install deps with pnpm, keep lint clean (`pnpm lint`).
- Prefer small PRs; include a note if changing API contracts or env vars.

### License <a id="license"></a>

- No license file yet; treat as all rights reserved unless stated otherwise.
