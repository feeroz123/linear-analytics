# Linear Analytics Dashboard

React 19 + Vite + Mantine frontend with Fastify + SQLite backend to explore Linear issues, default metrics, and AI-driven prompt → chart generation.

## Setup
1) Copy env: `cp .env.example .env` and add `LINEAR_API_KEY` and `OPENAI_API_KEY`.
2) Install deps: `npm install`.
3) Run dev: `npm run dev` then open http://localhost:3000.

Backend runs Fastify + Linear/OpenAI clients and embeds Vite dev middleware for HMR. SQLite file `data.db` stores last project/filters.

## API routes
- `GET /api/health` – connectivity status
- `GET /api/projects` – user projects
- `GET /api/metrics?projectId=...` – default 4 metrics with filters
- `POST /api/chart-from-prompt` – { projectId, filters, prompt }

## Notes
- Caches Linear responses for 5 minutes
- Pagination for issues
- Keeps filter/project selection in SQLite
- Mantine dark/light toggle
