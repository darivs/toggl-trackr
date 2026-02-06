# toggl-trackr ⌛

planned 📐 (docs/prd.md) with help from **Claude Code v2.1.33; Opus 4.6**  
implemented 🧩 with help from **OpenAI Codex v0.98.0; gpt-5.1-codex-max**  
made 🧪 with ♥

---

### Getting Started

#### a) Local

1. Dependencies:
   ```sh
   corepack enable
   pnpm install
   ```
2. Copy `.env.example` to `.env` and adjust values.
3. Dev server:
   ```sh
   pnpm dev
   ```
   Frontend at http://localhost:51731, API at http://localhost:43001 (proxied by Vite).

#### b) With Docker Compose

1. Copy `.docker.env` from `.docker.env.example` and set your values.
2. Start:
   ```sh
   docker compose up --build
   ```
3. Frontend: http://localhost:51731  
   API: http://localhost:43001
