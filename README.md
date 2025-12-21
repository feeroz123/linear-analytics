# Linear Analytics Dashboard

React 18 + Vite + Mantine frontend with Fastify + SQLite backend to explore Linear issues, default metrics, and AI-driven prompt → chart generation.

## Setup
1) Copy env: `cp .env.example .env` and add `LINEAR_API_KEY` and `OPENAI_API_KEY`.
2) Install deps: `npm install`.
3) Run dev: `npm run dev` then open http://localhost:3000.

Backend runs Fastify + Linear/OpenAI clients and embeds Vite dev middleware for HMR. SQLite file `data.db` stores last team/filters.

## API routes
- `GET /api/health` – connectivity status
- `GET /api/teams` – user teams
- `GET /api/metrics?teamId=...` – default 4 metrics with filters
- `POST /api/chart-from-prompt` – { teamId, filters, prompt }

## Notes
- Caches Linear responses for 60 minutes
- Pagination for issues
- Keeps filter/team selection in SQLite
- Mantine dark/light toggle
- Filters include time (7/30/90/any), state.type, type, assignee, creator, cycle, and optional start/end date (time/date/cycle are mutually exclusive)
