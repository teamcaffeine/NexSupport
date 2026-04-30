# Tech Stack
## Smart Customer Support System

---

## Overview

| Layer | Technology | Version |
|---|---|---|
| Frontend | React.js + Tailwind CSS | React 18+ |
| Backend | Node.js + Express.js | Node 20 LTS |
| Real-Time | Socket.io | v4 |
| Database | PostgreSQL + Prisma ORM | Postgres 15+, Prisma 5+ |
| Cache | Redis | v7 |
| AI | Claude API | claude-sonnet-4-6 |
| Auth | JWT (jsonwebtoken) | — |
| Hosting (FE) | Vercel | — |
| Hosting (BE) | Railway / Render | — |

---

## Frontend

### React.js
- SPA with role-based routing (`/chat`, `/agent/dashboard`, `/admin/panel`)
- Component tree splits by role: `CustomerChat`, `AgentDashboard`, `AdminPanel`
- State management: React Context or Zustand (lightweight, no Redux overhead needed)

### Tailwind CSS
- Utility-first styling
- Chat bubble variants: blue (customer) / gray (AI) / green (agent)
- Responsive layout for dashboard sidebar + main thread view

### Socket.io Client
- Connects on login with JWT in handshake auth
- Listens for: `ai:reply`, `ticket:created`, `agent:message`, `ticket:assigned`
- Manages typing indicators via `socket.emit('typing', ...)` / `socket.on('typing', ...)`

### Key Frontend Libraries
| Package | Purpose |
|---|---|
| `react-router-dom` | Client-side routing + route guards |
| `socket.io-client` | Real-time communication |
| `axios` | HTTP requests to REST API |
| `zustand` | Lightweight global state (auth token, active ticket) |
| `recharts` | Bar/line charts on admin analytics panel |

---

## Backend

### Node.js + Express.js
- REST API server + Socket.io server mounted on the same HTTP instance
- Modular route structure: `routes/auth`, `routes/messages`, `routes/tickets`, `routes/admin`
- Middleware chain: `verifyJWT → extractTenantId → checkRole → handler`

### Socket.io Server
- Runs on same Express HTTP server (`httpServer = createServer(app); io = new Server(httpServer)`)
- JWT verified on every socket connection via `io.use(authMiddleware)`
- Room naming: `room:{tenantId}:{ticketId}`, `room:{tenantId}:agent:{agentId}`

### Key Backend Libraries
| Package | Purpose |
|---|---|
| `express` | HTTP server + REST routing |
| `socket.io` | WebSocket real-time layer |
| `jsonwebtoken` | JWT sign + verify |
| `bcryptjs` | Password hashing |
| `@prisma/client` | DB query client (type-safe) |
| `ioredis` | Redis client (cache reads/writes) |
| `@anthropic-ai/sdk` | Claude API calls |
| `crypto` | SHA256 hashing for Redis cache keys |
| `dotenv` | Environment variable loading |
| `cors` | CORS headers for frontend origin |

---

## Database — PostgreSQL + Prisma

### Why PostgreSQL
- ACID compliance for ticket/message integrity
- UUID primary keys supported natively (`gen_random_uuid()`)
- Enum types for `role`, `status`, `priority`
- Foreign key constraints enforce relational integrity

### Why Prisma ORM
- Type-safe query builder (no raw SQL for standard operations)
- Schema-as-code in `schema.prisma` — single source of truth
- Auto-generated migrations via `prisma migrate dev`
- Built-in tenantId scoping: every query receives `where: { tenantId }` from middleware

### Schema Files
- `prisma/schema.prisma` — defines `Tenant`, `User`, `Ticket`, `Message` models
- `prisma/migrations/` — versioned migration history

---

## Cache — Redis

### Why Redis
- Sub-millisecond reads for cached AI responses (< 100ms vs < 2s cold)
- TTL-based expiry handles cache invalidation automatically
- Pub/Sub can extend socket routing if needed in future

### Cache Key Strategy
| Key Pattern | TTL | Stores |
|---|---|---|
| `ai_cache:{tenantId}:{SHA256(msg)}` | 1 hour | Claude API JSON response |
| `agents:available:{tenantId}` | 5 min | List of online agent socket IDs |
| `stats:{tenantId}` | 10 min | Admin analytics snapshot |
| `session:{userId}` | Connection lifetime | Socket ID for direct messaging |

### Redis Client
- `ioredis` — production-grade Node.js Redis client, supports TLS for hosted Redis

---

## AI — Claude API

### Model
- `claude-sonnet-4-6` — balance of speed and reasoning quality for structured JSON output

### Integration
- Uses `@anthropic-ai/sdk` (official Anthropic Node SDK)
- System prompt instructs Claude to return strict JSON only
- Response parsed with `JSON.parse()`; on failure defaults to `shouldEscalate: true`

### Prompt Caching
- Cache key: `ai_cache:{tenantId}:{SHA256(message)}` in Redis
- Identical messages within the same tenant reuse cached analysis (no duplicate API spend)

### Claude API Call Flow
```
1. Check Redis cache
2. If MISS: call claude-sonnet-4-6 with system + user message
3. Parse JSON response
4. Store in Redis with 1-hour TTL
5. Pass result to Decision Engine
```

---

## Auth — JWT

### Token
- Signed with `HS256` using `JWT_SECRET` env var
- Payload: `{ userId, role, tenantId, iat, exp }`
- Expiry: 7 days (configurable)

### Flow
- Token issued at login → stored in `localStorage` on client
- Sent as `Authorization: Bearer <token>` on all REST requests
- Sent in `socket.handshake.auth.token` on Socket.io connect

### Middleware
```
verifyJWT     → jwt.verify(token, JWT_SECRET)
extractTenant → req.tenantId = decoded.tenantId
checkRole     → if (!allowedRoles.includes(decoded.role)) 403
```

---

## Hosting

### Frontend — Vercel
- Auto-deploy on `git push` to `main`
- Environment variables: `VITE_API_URL`, `VITE_SOCKET_URL`
- Build command: `npm run build` (Vite)

### Backend — Railway / Render
- Persistent Node.js server (required for Socket.io long-lived connections)
- Environment variables managed in platform dashboard:
  `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`
- Auto-deploy from GitHub on push

### Why Not Serverless for Backend
- Socket.io requires a persistent connection — serverless functions (Vercel Functions, Lambda) do not support this
- Railway/Render provides always-on container hosting

---

## Environment Variables

| Variable | Where Used |
|---|---|
| `DATABASE_URL` | Prisma — Postgres connection string |
| `REDIS_URL` | ioredis — Redis connection string |
| `JWT_SECRET` | jsonwebtoken — sign/verify tokens |
| `ANTHROPIC_API_KEY` | Anthropic SDK — Claude API auth |
| `PORT` | Express server port (default 3000) |
| `VITE_API_URL` | Frontend — base REST API URL |
| `VITE_SOCKET_URL` | Frontend — Socket.io server URL |

---

## Project Structure (Proposed)

```
sheryians-hackathon/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Chat.jsx
│   │   │   ├── AgentDashboard.jsx
│   │   │   └── AdminPanel.jsx
│   │   ├── components/
│   │   ├── context/         # Auth context, socket context
│   │   └── main.jsx
│   └── vite.config.js
│
├── server/                  # Node.js backend
│   ├── routes/
│   │   ├── auth.js
│   │   ├── messages.js
│   │   ├── tickets.js
│   │   └── admin.js
│   ├── middleware/
│   │   ├── verifyJWT.js
│   │   └── checkRole.js
│   ├── services/
│   │   ├── aiEngine.js      # Claude API call + Redis cache
│   │   ├── decisionEngine.js
│   │   └── agentAssigner.js
│   ├── socket/
│   │   └── index.js         # Socket.io event handlers
│   ├── prisma/
│   │   └── schema.prisma
│   └── index.js             # Express + Socket.io entry point
│
├── PRD.md
├── web-flow.md
└── tech-stack.md
```
