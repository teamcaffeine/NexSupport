# Implementation Plan — 3 Days
## Smart Customer Support System

**Total time budget:** ~10–12 hours/day × 3 days  
**Goal:** Fully working P0 features demo-ready by end of Day 3  
**Priority rule:** P0 items ship before any P1. Cut P1 if time runs short.

---

## Day 1 — Foundation + Backend Core

**Goal:** Server runs, DB connected, auth works, tickets + messages API done.

---

### Block 1 — Project Setup (1.5 hrs)

- [ ] Create monorepo: `mkdir server client`
- [ ] `server/`: `npm init -y`, install all backend deps
  ```
  express socket.io jsonwebtoken bcryptjs
  @prisma/client prisma ioredis @anthropic-ai/sdk
  dotenv cors crypto
  ```
- [ ] `client/`: `npm create vite@latest . -- --template react`
  ```
  tailwindcss axios socket.io-client zustand recharts react-router-dom
  ```
- [ ] Create `.env` in `server/` with all variables (use dummy values for now)
- [ ] Init git, create `.gitignore` (node_modules, .env, prisma/migrations/*)
- [ ] Create folder structure:
  `routes/ middleware/ services/ socket/ lib/ utils/`

---

### Block 2 — Database Setup (1.5 hrs)

- [ ] Write `prisma/schema.prisma` (Tenant, User, Ticket, Message, enums)
- [ ] Provision PostgreSQL (Railway or local Docker)
- [ ] Set `DATABASE_URL` in `.env`
- [ ] Run `npx prisma migrate dev --name init`
- [ ] Run `npx prisma generate`
- [ ] Create `lib/prisma.js` singleton
- [ ] Seed one tenant + one admin user for testing:
  ```
  npx prisma db seed
  ```
  Seed file: create tenant "Demo Co", admin user, one agent user

---

### Block 3 — Redis + Express Bootstrap (1 hr)

- [ ] Provision Redis (Railway / Upstash / local)
- [ ] Create `lib/redis.js` ioredis singleton
- [ ] Write `server/index.js`:
  - Express app + `cors` + `express.json`
  - Create HTTP server
  - Attach Socket.io (empty handler for now)
  - `httpServer.listen(PORT)`
- [ ] Test: `node index.js` — server starts, no crash

---

### Block 4 — Auth Routes (1.5 hrs)

- [ ] Write `middleware/verifyJWT.js`
- [ ] Write `middleware/extractTenant.js`
- [ ] Write `middleware/checkRole.js`
- [ ] Write `routes/auth.js`:
  - `POST /api/auth/register` — bcrypt hash, INSERT user, return JWT
  - `POST /api/auth/login` — compare hash, return JWT
- [ ] Mount in `index.js`: `app.use('/api/auth', authRouter)`
- [ ] **Test with Postman/Thunder Client:**
  - Register a customer user
  - Login, get token
  - Decode JWT, verify payload has `{ userId, role, tenantId }`

---

### Block 5 — Tickets + Messages Routes (2.5 hrs)

- [ ] Write `routes/tickets.js`:
  - `GET /api/tickets` — role-scoped query (customer/agent/admin)
  - `GET /api/tickets/:id` — single ticket, tenantId guard
  - `PATCH /api/tickets/:id/status`
  - `PATCH /api/tickets/:id/assign`
- [ ] Write `routes/messages.js`:
  - `GET /api/messages/:ticketId` — fetch thread
  - `POST /api/messages` — stub for now (AI integration in Day 2)
    Just save message and return `{ messageId }`
- [ ] Write `routes/admin.js`:
  - `GET /api/admin/users`
  - `PATCH /api/admin/users/:id/role`
  - `GET /api/admin/analytics` — return hardcoded zeros for now
  - `POST /api/admin/tenants`
- [ ] Mount all routers in `index.js`
- [ ] **Test all routes with Postman** — verify tenantId scoping blocks wrong-tenant access

---

### Block 6 — Day 1 Checkpoint (30 min)

- [ ] All REST endpoints return correct shapes
- [ ] tenantId isolation confirmed (wrong tenant → 404)
- [ ] Role guards confirmed (wrong role → 403)
- [ ] Git commit: `feat: backend foundation — auth, tickets, messages REST API`

**Day 1 done state:** Full REST API working (no AI yet, no sockets yet)

---

---

## Day 2 — AI Engine + Socket.io + Agent Flow

**Goal:** Messages trigger Claude, decisions route to agent, real-time chat works end-to-end.

---

### Block 1 — AI Engine (2 hrs)

- [ ] Write `utils/hash.js` — SHA256 helper
  ```js
  import { createHash } from 'crypto'
  export const sha256 = (str) => createHash('sha256').update(str).digest('hex')
  ```
- [ ] Write `services/aiEngine.js`:
  - Build cache key: `ai_cache:${tenantId}:${sha256(message)}`
  - Redis GET → return cached if hit
  - Call `anthropic.messages.create(...)` with system prompt
  - Parse JSON response
  - On parse error → return safe default `{ shouldEscalate: true, ... }`
  - Redis SET with 3600s TTL
  - Return result
- [ ] **Test in isolation:**
  - Write a quick test script: call `analyze("I want a refund now", tenantId)`
  - Verify Claude returns correct JSON shape
  - Call again — verify Redis cache hit (check Redis with `redis-cli`)

---

### Block 2 — Decision Engine + Agent Assigner (1.5 hrs)

- [ ] Write `services/agentAssigner.js`:
  - SMEMBERS `agents:available:{tenantId}` from Redis
  - If empty → DB fallback: find agent with fewest open tickets
  - Return agentId or null
- [ ] Write `services/decisionEngine.js`:
  - Apply emotion/confidence override logic
  - If escalate: `prisma.ticket.create(...)`, call `agentAssigner.assign()`
  - If assigned: `prisma.ticket.update(assignedAgentId)`, emit `ticket:assigned`
  - Return `{ escalated, ticketId?, reply }`
- [ ] Wire into `POST /api/messages`:
  - Call `aiEngine.analyze(content, tenantId)`
  - Call `decisionEngine.process(aiResult, userId, tenantId, io)`
  - Save message to DB with correct `ticketId`
  - Return full response
- [ ] **Test end-to-end via Postman:**
  - Send "Where is my order?" → expect AI reply, no ticket
  - Send "I am furious, this is broken!" → expect ticket created

---

### Block 3 — Socket.io Core (2.5 hrs)

- [ ] Write `socket/index.js`:
  - JWT auth middleware on `io.use(...)`
  - On connect: join personal room, Redis session store
  - If agent: join agent room, SADD to `agents:available:{tenantId}`
  - On disconnect: cleanup Redis session + availability
- [ ] Implement `user:message` handler:
  - Call `aiEngine.analyze` + `decisionEngine.process`
  - Save message to DB
  - Emit `ai:reply` or `ticket:created` back to customer
- [ ] Implement `agent:message` handler:
  - Verify agent owns the ticket (tenantId + assignedAgentId check)
  - Save message to DB
  - Get customerId from ticket, emit `agent:message` to customer room
- [ ] Call `initSocket(io)` in `index.js`
- [ ] **Test with two browser tabs (or Postman WebSocket):**
  - Tab A = customer, Tab B = agent
  - Customer sends angry message → ticket created → agent tab receives `ticket:assigned`
  - Agent replies → customer tab receives `agent:message`

---

### Block 4 — Admin Analytics (1 hr)

- [ ] Complete `GET /api/admin/analytics`:
  - Check Redis `stats:{tenantId}` → return if fresh
  - Else run Prisma aggregate queries:
    ```
    total tickets, open count, closed count,
    count where assignedAgentId IS NULL (AI resolved),
    avg(updatedAt - createdAt) where status = 'closed'
    ```
  - Cache result: Redis SET `stats:{tenantId}` EX 600
  - Return analytics JSON
- [ ] **Test:** Hit endpoint, verify numbers match DB state

---

### Block 5 — Day 2 Checkpoint (30 min)

- [ ] Full message flow works over both REST and Socket.io
- [ ] AI cache verified (second identical message is instant)
- [ ] Agent receives ticket in real-time
- [ ] Customer receives agent reply in real-time
- [ ] Git commit: `feat: AI engine, decision engine, Socket.io real-time chat`

**Day 2 done state:** Backend fully functional. Ready for frontend.

---

---

## Day 3 — Frontend + Integration + Polish

**Goal:** All three UIs working and demo-ready.

---

### Block 1 — React Setup + Auth Pages (1.5 hrs)

- [ ] Configure Tailwind in `client/`
- [ ] Set up `react-router-dom` with routes:
  ```
  /login       → <LoginPage>
  /register    → <RegisterPage>
  /chat        → <ChatPage>        (requires customer role)
  /agent       → <AgentDashboard> (requires agent role)
  /admin       → <AdminPanel>     (requires admin role)
  ```
- [ ] Create Zustand auth store: `{ user, token, login, logout }`
- [ ] Write `<ProtectedRoute role="agent">` wrapper — redirects to /login if role mismatch
- [ ] Build `<LoginPage>` and `<RegisterPage>` — call `/api/auth/login` via axios
- [ ] On login: store token + user in Zustand + localStorage, redirect by role
- [ ] **Test:** Login as customer → goes to /chat. Login as agent → goes to /agent.

---

### Block 2 — Customer Chat Widget (2 hrs)

- [ ] Create `<ChatPage>`:
  - Floating button bottom-right → toggles chat panel open/closed
  - Chat panel: message list + input box + send button
- [ ] Connect Socket.io on mount (token from Zustand store)
- [ ] Message list renders bubbles:
  - Customer: right-aligned, blue
  - AI: left-aligned, gray, "AI" label
  - Agent: left-aligned, green, shows agent name
- [ ] "Talking to AI" / "Talking to [Agent Name]" label at top
- [ ] On send: emit `user:message`, add optimistic bubble while waiting
- [ ] Listen for `ai:reply` → append AI bubble
- [ ] Listen for `ticket:created` → show "Connecting you to an agent..." message
- [ ] Listen for `agent:message` → append agent bubble, update header label
- [ ] **Test golden path:**
  - Neutral query → AI responds immediately
  - Angry query → connecting message appears, then agent reply arrives

---

### Block 3 — Agent Dashboard (2.5 hrs)

- [ ] Create `<AgentDashboard>` layout:
  - Left sidebar (280px): ticket list
  - Right main view: ticket thread + reply box
- [ ] On mount: `GET /api/tickets` → render ticket cards in sidebar
  - Each card: customer name, status badge (color-coded), emotion tag, priority dot
- [ ] Connect Socket.io on mount
- [ ] Listen for `ticket:assigned`:
  - Prepend new card to sidebar with unread indicator (red dot)
  - Show browser notification if tab is in background
- [ ] On ticket card click:
  - `GET /api/tickets/:id` + `GET /api/messages/:ticketId`
  - Render full message thread in main view
  - Mark unread dot as cleared
- [ ] Reply box (bottom of main view):
  - Textarea + Send button
  - On send: emit `agent:message { ticketId, message }` via socket
  - Append agent bubble optimistically
- [ ] "Close Ticket" button:
  - `PATCH /api/tickets/:id/status { status: 'closed' }`
  - Remove ticket from sidebar list
- [ ] **Test:** Open two browsers — customer sends angry message, agent gets it real-time, agent replies, customer sees it.

---

### Block 4 — Admin Panel (1.5 hrs)

- [ ] Create `<AdminPanel>` with tab navigation: Overview | Tickets | Users
- [ ] **Overview tab:**
  - `GET /api/admin/analytics` on mount
  - 4 stat cards: Total | Open | Closed | AI Resolved %
  - Simple bar chart (recharts) — mock time-series data for visual if no time
- [ ] **Tickets tab:**
  - `GET /api/tickets` → paginated table
  - Columns: ID (truncated) | Status | Priority | Agent | Emotion | Created
  - Filter dropdowns: status, priority
  - Row click → modal with ticket detail + reassign button
  - Reassign: `PATCH /api/tickets/:id/assign { agentId }`
- [ ] **Users tab:**
  - `GET /api/admin/users` → table: name | email | role | joined
  - Role dropdown per row: `PATCH /api/admin/users/:id/role`
- [ ] **Test:** Change user role, verify it persists. Close a ticket from admin, verify status updates.

---

### Block 5 — Integration Pass + Bug Fixes (1 hr)

- [ ] Run through all three flows end-to-end in one browser session
- [ ] Fix any CORS issues (check `Access-Control-Allow-Origin` headers)
- [ ] Fix any socket room mismatch bugs
- [ ] Verify Redis cache keys are scoped correctly per tenant
- [ ] Check that tenantId guard prevents cross-tenant data access
- [ ] Verify JWT expiry is handled gracefully (redirect to login)

---

### Block 6 — Deploy (1 hr)

- [ ] **Backend → Railway / Render:**
  - Push `server/` code
  - Add all env vars in platform dashboard
  - Run `prisma migrate deploy` (production migration)
  - Note the live backend URL
- [ ] **Frontend → Vercel:**
  - Push `client/` code
  - Set `VITE_API_URL` and `VITE_SOCKET_URL` to live backend URL
  - Deploy
- [ ] Smoke test on live URLs:
  - Register, login, send a chat message
  - Verify AI responds
  - Verify escalation creates ticket
- [ ] Git commit + tag: `git tag v1.0-demo`

---

### Block 7 — Demo Prep (30 min)

- [ ] Seed realistic demo data:
  - 2 tenants: "ShopEasy" and "FoodFast"
  - 1 admin + 2 agents + 3 customers per tenant
  - 5 closed tickets, 3 open tickets
- [ ] Write demo script (3 scenarios):
  1. Neutral query → AI resolves instantly
  2. Angry query → escalates to agent → agent resolves
  3. Admin views analytics + reassigns a ticket

---

## Feature Priority Summary

| Feature | Day | Priority | Status |
|---|---|---|---|
| Auth (register/login/JWT) | 1 | P0 | — |
| Tickets CRUD API | 1 | P0 | — |
| Messages API | 1 | P0 | — |
| Multi-tenant isolation | 1 | P0 | — |
| AI Engine (Claude + Redis) | 2 | P0 | — |
| Decision Engine | 2 | P0 | — |
| Socket.io real-time chat | 2 | P0 | — |
| Agent ticket assignment | 2 | P0 | — |
| Login / Register UI | 3 | P0 | — |
| Customer chat widget | 3 | P0 | — |
| Agent dashboard | 3 | P0 | — |
| Admin panel (basic) | 3 | P0 | — |
| Typing indicator | 3 | P1 | cut if late |
| Analytics charts | 3 | P1 | cut if late |
| Emotion tag on ticket card | 3 | P1 | cut if late |
| Redis agent availability | 2 | P1 | cut if late |

---

## Cut Rules (if behind schedule)

- **Day 1 running late:** Skip admin analytics implementation, hardcode zeros.
- **Day 2 running late:** Skip `agentAssigner` Redis logic, assign to first agent in DB.
- **Day 3 running late:** Skip admin panel charts (just show stat cards). Ship text-only agent assignment (no reassign modal).
- **Never cut:** Auth, Socket.io real-time, AI engine, customer chat, agent dashboard. These are the demo core.
