# BUILD: Linear Analytics Dashboard App

You are an expert full-stack TypeScript developer. Build a complete, production-ready local web application based on the exact specifications below. Generate ALL code files with folder structure, package.json, environment setup, and run instructions.

## 📋 SPECIFICATIONS

### Tech Stack (Latest & Fast)
Frontend: React 19 + Vite + TypeScript + Mantine UI (or shadcn/tailwind)Backend: Node.js 22 LTS + Fastify + TypeScriptDatabase: SQLite (better-sqlite3 or Prisma)Charts: RechartsAPIs: Linear GraphQL + OpenAI Chat CompletionsAuth: Environment variables only (LINEAR_API_KEY, OPENAI_API_KEY)Deployment: Single process (npm run dev), localhost:3000


### Core Features (EXACTLY as specified)

1. **Linear Connection**
   - Read `LINEAR_API_KEY` from `.env`
   - Validate on startup (GraphQL `me` query)
   - List user's **Projects** only (GraphQL `projects` query, filter accessible ones)

2. **UI Layout**
┌─────────────────────────────────────────────────────────────┐│ Linear: ✅ OpenAI: ✅                                    │ ← Top status bar├─────────────────────────────────────────────────────────────┤│ Project: Engineering ▼  │ Time: 30d ▼ State: All ▼   │ ← Filters (left)│ Type: All ▼ Assignee: Any ▼ Refresh                   │├─────────────────────────────────────────────────────────────┤│ DEFAULT METRICS                                             ││ ┌─────┐ ┌─────┐ ┌──────────────┐ ┌─────────────────────┐    ││ │Thrpt│ │Open │ │Bugs/Assignee │ │Bugs: Sev/Priority  │    │ ← 4 cards/charts│ │  42 │ │60/40│ │              │ │                     │    ││ └─────┘ └─────┘ └──────────────┘ └─────────────────────┘    │├─────────────────────────────────────────────────────────────┤│ PROMPT → CHART                                              ││ Describe your chart: “Bugs by team per week”              │ ← Textarea + Generate│                          Generate Chart                   ││                                                            │ ← Dynamic chart renders here└─────────────────────────────────────────────────────────────┘


3. **Default Metrics (Auto-update on filter change)**
Metric | Chart | Data Source
Throughput | Bar (weekly) | COUNT(issues WHERE completedAt IN timeframe)
Open vs Closed | Donut | COUNT BY state.type (open/completed)
Bugs/Assignee | Horizontal Bar | COUNT(type=“bug”) GROUP BY assignee
Bugs: Severity/Priority | Stacked Bar | COUNT(type=“bug”) GROUP BY severity, priority


4. **Filters (All required)**
   - Time: Last 7/30/90 days (from `createdAt`/`updatedAt`)
   - State: All/Open/Completed  
   - Type: All/Bug/Feature/Chore (from labels or `issueType`)
   - Assignee: Any / [dropdown of assignees from issues]
   - Project: Dropdown of user's Linear Projects

5. **Prompt → Chart (OpenAI powered)**
POST /api/chart-from-promptInput: { projectId, filters, prompt: “bugs per sprint by priority” }Process:
	1.	Send to OpenAI: “Available: createdAt, completedAt, state.type, labels, priority, assignee, team. Generate chart spec JSON”
	2.	OpenAI returns: {type: “bar”, x: “week”, y: “count”, groupBy: “priority”, filter: “type=bug”}
	3.	Execute Linear query per spec
	4.	Return chart-ready data to frontend


### Backend Endpoints (Fastify routes)
/api/health - Connection status
/api/projects - GET user's Linear projects {id, name, team}
/api/metrics - GET default 4 metrics data (projectId + all filters)
/api/chart-from-prompt - POST {projectId, filters, prompt} → chart data

### Linear GraphQL Queries (Essential fields only)
Projects
query { projects { nodes { id name team { name } } } }
Issues (paginated)
query Issues($projectId: String!, $first: Int!) {project(id: $projectId) {issues(first: $first) {nodes {id title createdAt updatedAt completedAtstate { id name type }assignee { id name }prioritylabels { name }team { name }estimate}pageInfo { hasNextPage endCursor }}}}


### Database (SQLite - single file `data.db`)
– Only for app state (projects cache, recent filters)CREATE TABLE app_state (id INTEGER PRIMARY KEY,last_project TEXT,filters JSON,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);


### Environment (.env)
LINEAR_API_KEY=lin_api_xxx
OPENAI_API_KEY=sk-xxx
PORT=3000


## 📂 REQUIRED FILE STRUCTURE
linear-analytics/├── package.json├── tsconfig.json
├── .env.example├── .gitignore├── docker-compose.yml (optional)│├── src/│   ├── server/          # Fastify backend│   │   ├── index.ts│   │   ├── linear.ts    # Linear GraphQL client│   │   ├── openai.ts    # Prompt → chart spec│   │   ├── metrics.ts   # Default metric computations│   │   └── db.ts        # SQLite│   ││   └── client/          # Vite React app│       ├── src/│       │   ├── App.tsx│       │   ├── components/│       │   │   ├── Layout.tsx│       │   │   ├── MetricsDashboard.tsx│       │   │   ├── Filters.tsx│       │   │   └── PromptChart.tsx│       │   └── hooks/│       └── vite.config.ts│├── README.md└── data.db (gitignore)


## 🎯 SUCCESS CRITERIA
✅ `npm install && npm run dev` → http://localhost:3000 works instantly
✅ Linear connection shows ✅ (uses your real API key)  
✅ Projects dropdown populates from your Linear account
✅ Default metrics render with real data from selected project
✅ "Show bugs by assignee last 30 days" → working chart appears
✅ Filters update all charts instantly
✅ No API keys exposed to browser
✅ Hot reload works (Vite + Fastify)
✅ Zero external dependencies beyond Linear/OpenAI APIs
✅ TypeScript error-free, fully typed responses

## 🚀 RUN INSTRUCTIONS (in README)
cp .env.example .env

Add your LINEAR_API_KEY and OPENAI_API_KEY
npm installnpm run dev
Open http://localhost:3000


## OpenAI System Prompt Template (for /chart-from-prompt)
You are a chart generator for Linear issues. Available fields: id, title, createdAt, completedAt, state{type}, assignee{name}, priority, labels{name}, team{name}, estimate.
User wants: “{prompt}”
Respond ONLY with valid JSON:{“type”: “bar|line|pie|donut|scatter”,“title”: “string”,“xAxis”: “week|priority|assignee|stateType|severity”,“yAxis”: “count|avgEstimate|sumEstimate”,“groupBy”: “priority|team|severity|null”,“filter”: “type=bug&state=open”  // optional}


## CODE GENERATION RULES
- Generate COMPLETE working code (no placeholders)
- Use modern TypeScript (satisfies, async/await everywhere)
- Full error handling (Linear 401, OpenAI rate limits, etc.)
- Responsive Mantine/shadcn UI (mobile + desktop)
- Real-time filter updates (use React Query/SWR)
- Cache Linear responses 5min (avoid rate limits)
- Pagination for large projects (>100 issues)
- Loading/skeleton states everywhere
- Dark mode support

BUILD THE COMPLETE APPLICATION NOW. Start with `package.json` and folder structure, then all TypeScript files.


