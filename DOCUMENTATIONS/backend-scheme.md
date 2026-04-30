# Backend Scheme
## Smart Customer Support System

---

## 1. Entry Point — `server/index.js`

```
1. Load env vars (dotenv)
2. Create Express app
3. Apply global middleware: cors, express.json
4. Mount REST routers
5. Create HTTP server from Express app
6. Attach Socket.io to HTTP server
7. Connect Prisma (DB)
8. Connect Redis
9. Listen on PORT
```

```js
const app        = express()
const httpServer = createServer(app)
const io         = new Server(httpServer, { cors })

app.use('/api/auth',    authRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/tickets',  ticketsRouter)
app.use('/api/admin',    adminRouter)

initSocket(io)          // socket/index.js
httpServer.listen(PORT)
```

---

## 2. Folder Structure

```
server/
├── index.js                  # Entry point
├── prisma/
│   ├── schema.prisma         # DB models
│   └── migrations/           # Auto-generated migration files
├── routes/
│   ├── auth.js               # POST /register, POST /login
│   ├── messages.js           # POST /messages, GET /messages/:ticketId
│   ├── tickets.js            # GET/PATCH /tickets
│   └── admin.js              # Admin-only routes
├── middleware/
│   ├── verifyJWT.js          # Decode + verify token
│   ├── extractTenant.js      # Attach tenantId to req
│   └── checkRole.js          # Role-based guard factory
├── services/
│   ├── aiEngine.js           # Claude API call + Redis cache
│   ├── decisionEngine.js     # Routing logic (escalate vs reply)
│   └── agentAssigner.js      # Find + assign least-busy agent
├── socket/
│   └── index.js              # All Socket.io event handlers
├── lib/
│   ├── prisma.js             # Prisma client singleton
│   └── redis.js              # ioredis client singleton
└── utils/
    └── hash.js               # SHA256 helper for cache keys
```

---

## 3. Middleware

### `middleware/verifyJWT.js`
```
Request arrives with Authorization: Bearer <token>
  → jwt.verify(token, JWT_SECRET)
  → On success: attach decoded payload to req.user
  → On failure: 401 Unauthorized
```

```js
export function verifyJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
```

### `middleware/extractTenant.js`
```
Reads tenantId from req.user (set by verifyJWT)
  → Attaches req.tenantId for use in every handler
  → Guarantees all DB queries are scoped
```

```js
export function extractTenant(req, res, next) {
  req.tenantId = req.user.tenantId
  next()
}
```

### `middleware/checkRole.js`
```
Factory function — returns middleware that checks role
  → Called as: checkRole('admin') or checkRole('agent', 'admin')
  → 403 Forbidden if role not in allowed list
```

```js
export function checkRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}
```

### Middleware Chain (applied per route group)
```
Public routes:     (no middleware)
Customer routes:   verifyJWT → extractTenant
Agent routes:      verifyJWT → extractTenant → checkRole('agent', 'admin')
Admin routes:      verifyJWT → extractTenant → checkRole('admin')
```

---

## 4. Routes

### `routes/auth.js`

#### `POST /api/auth/register`
```
Body:    { name, email, password, tenantId }
Action:  Hash password (bcrypt), INSERT user
Returns: { token, user: { id, name, role, tenantId } }
Errors:  409 if email already exists
```

#### `POST /api/auth/login`
```
Body:    { email, password }
Action:  Find user by email, bcrypt.compare(password, hash)
Returns: { token, user: { id, name, role, tenantId } }
Errors:  401 if email not found or password mismatch
```

---

### `routes/messages.js`

#### `POST /api/messages`
```
Auth:    verifyJWT → extractTenant
Body:    { content, ticketId? }
Action:
  1. Call aiEngine.analyze(content, tenantId)
  2. Call decisionEngine.process(aiResult, userId, tenantId)
     → If no escalation: returns { reply, isAI: true }
     → If escalation: creates ticket, assigns agent, returns { ticketId }
  3. Save message to DB (linked to ticketId)
Returns: { messageId, aiReply?, ticketId? }
```

#### `GET /api/messages/:ticketId`
```
Auth:    verifyJWT → extractTenant
Action:  SELECT messages WHERE ticket_id = :ticketId AND tenant_id = :tenantId
         ORDER BY created_at ASC
Returns: [ { id, content, senderId, isAI, createdAt, senderName } ]
Guards:  Customer can only fetch tickets they own
         Agent can fetch any assigned ticket (within tenantId)
```

---

### `routes/tickets.js`

#### `GET /api/tickets`
```
Auth:    verifyJWT → extractTenant
Query:   ?status=open&priority=high&page=1&limit=20
Action:  Role-scoped query:
           customer → WHERE user_id = me
           agent    → WHERE assigned_agent_id = me
           admin    → all tickets for tenantId
Returns: [ { id, status, priority, intent, emotion, assignedAgent, createdAt } ]
```

#### `GET /api/tickets/:id`
```
Auth:    verifyJWT → extractTenant
Action:  SELECT ticket + verify tenantId matches
Returns: { id, status, priority, intent, emotion, summary,
           userId, assignedAgentId, createdAt, updatedAt }
```

#### `PATCH /api/tickets/:id/status`
```
Auth:    verifyJWT → extractTenant → checkRole('agent', 'admin')
Body:    { status: 'in_progress' | 'closed' }
Action:  UPDATE tickets SET status, updated_at WHERE id AND tenant_id
Returns: { id, status, updatedAt }
Side:    If closed, emit ticket:closed to customer socket room
```

#### `PATCH /api/tickets/:id/assign`
```
Auth:    verifyJWT → extractTenant → checkRole('admin')
Body:    { agentId }
Action:  UPDATE tickets SET assigned_agent_id WHERE id AND tenant_id
         Verify agentId belongs to same tenantId
Returns: { id, assignedAgentId }
Side:    Emit ticket:assigned to new agent socket
```

---

### `routes/admin.js`

#### `GET /api/admin/users`
```
Auth:    verifyJWT → extractTenant → checkRole('admin')
Action:  SELECT users WHERE tenant_id = :tenantId
Returns: [ { id, name, email, role, createdAt } ]
```

#### `PATCH /api/admin/users/:id/role`
```
Auth:    verifyJWT → extractTenant → checkRole('admin')
Body:    { role: 'customer' | 'agent' | 'admin' }
Action:  UPDATE users SET role WHERE id AND tenant_id
Returns: { id, role }
```

#### `GET /api/admin/analytics`
```
Auth:    verifyJWT → extractTenant → checkRole('admin')
Action:  Check Redis stats:{tenantId} → return cached if fresh
         Else compute:
           total tickets, open count, closed count,
           AI-resolved count (tickets with no assignedAgentId),
           avg resolution time (closed_at - created_at)
         Store in Redis (TTL: 10 min)
Returns: { total, open, closed, aiResolved, aiResolutionRate, avgResolutionTime }
```

#### `POST /api/admin/tenants`
```
Auth:    verifyJWT (super-admin only, or open during seeding)
Body:    { name }
Action:  INSERT tenant
Returns: { id, name, createdAt }
```

---

## 5. Services

### `services/aiEngine.js`

```
export async function analyze(message, tenantId):

1. Compute cacheKey = `ai_cache:${tenantId}:${sha256(message)}`
2. Check Redis: GET cacheKey
   → HIT:  parse JSON, return immediately
   → MISS: proceed

3. Call Anthropic SDK:
   anthropic.messages.create({
     model: 'claude-sonnet-4-6',
     max_tokens: 256,
     system: SYSTEM_PROMPT,
     messages: [{ role: 'user', content: message }]
   })

4. Extract text from response
5. JSON.parse(text)
   → On failure: return { shouldEscalate: true, suggestedReply: DEFAULT_MSG,
                           intent: 'unknown', emotion: 'unknown', confidence: 0 }

6. Redis SET cacheKey JSON(result) EX 3600
7. Return result
```

**System Prompt (constant):**
```
You are a customer support AI. Analyze the customer message.
Return ONLY a JSON object with these fields:
- intent (string): category of the problem
- emotion (string): angry | frustrated | neutral | happy
- confidence (number): 0.0 to 1.0
- shouldEscalate (boolean): whether a human agent is needed
- suggestedReply (string): a short draft reply to the customer
No explanation. No markdown. JSON only.
```

---

### `services/decisionEngine.js`

```
export async function process(aiResult, userId, tenantId, io):

const { emotion, confidence, shouldEscalate, suggestedReply, intent } = aiResult

// Override shouldEscalate based on emotion/confidence
let escalate = shouldEscalate
let priority  = 'low'

if (emotion === 'angry') {
  escalate = true
  priority  = 'high'
} else if (emotion === 'frustrated' || confidence < 0.5) {
  escalate = true
  priority  = 'medium'
}

if (!escalate) {
  return { escalated: false, reply: suggestedReply }
}

// Escalation path
const ticket = await prisma.ticket.create({
  data: { userId, tenantId, status: 'open', priority, intent, emotion,
          summary: suggestedReply }
})

const agentId = await agentAssigner.assign(tenantId)

if (agentId) {
  await prisma.ticket.update({
    where: { id: ticket.id },
    data:  { assignedAgentId: agentId }
  })
  io.to(`room:${tenantId}:agent:${agentId}`)
    .emit('ticket:assigned', { ticketId: ticket.id, userId, emotion, intent })
}

return { escalated: true, ticketId: ticket.id, reply: suggestedReply }
```

---

### `services/agentAssigner.js`

```
export async function assign(tenantId):

1. GET Redis: agents:available:{tenantId}
   → Returns list of { agentId, activeTickets } sorted by activeTickets ASC

2. If list is empty:
   → Fallback: query DB for agents with role='agent' and tenant_id=tenantId
   → Pick agent with fewest open tickets (COUNT query)

3. Return agentId of least-busy agent (or null if no agents online)
```

---

## 6. Socket.io — `socket/index.js`

### Connection Setup
```js
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    next(new Error('Unauthorized'))
  }
})

io.on('connection', (socket) => {
  const { userId, role, tenantId } = socket.user

  // Register session in Redis
  redis.set(`session:${userId}`, socket.id)

  // Join personal room
  socket.join(`room:${tenantId}:${userId}`)

  // If agent: join agent room + update available list
  if (role === 'agent') {
    socket.join(`room:${tenantId}:agent:${userId}`)
    updateAgentAvailability(tenantId, userId, 'add')
  }

  socket.on('user:message',   handleUserMessage(socket, io))
  socket.on('agent:message',  handleAgentMessage(socket, io))
  socket.on('disconnect',     handleDisconnect(socket))
})
```

### Event: `user:message`
```
Payload: { message, tenantId }

Handler:
  1. aiEngine.analyze(message, tenantId)
  2. decisionEngine.process(aiResult, userId, tenantId, io)
  3. Save message to DB
  4a. If not escalated:
        socket.emit('ai:reply', { reply, isAI: true })
  4b. If escalated:
        socket.emit('ticket:created', { ticketId, message: reply })
        (agent notification is emitted inside decisionEngine)
```

### Event: `agent:message`
```
Payload: { ticketId, message }

Handler:
  1. Verify ticket.assignedAgentId === agentId AND ticket.tenantId === tenantId
  2. Save message to DB (is_ai: false, sender_id: agentId)
  3. Get customerId from ticket.userId
  4. io.to(`room:${tenantId}:${customerId}`)
       .emit('agent:message', { reply: message, agentName: socket.user.name })
```

### Event: `disconnect`
```
Handler:
  1. redis.del(`session:${userId}`)
  2. If role === 'agent':
       updateAgentAvailability(tenantId, userId, 'remove')
```

### Helper: `updateAgentAvailability`
```
add:    SADD  agents:available:{tenantId}  agentId  (EXPIRE 5min)
remove: SREM  agents:available:{tenantId}  agentId
```

---

## 7. Prisma Schema — `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  users     User[]
  tickets   Ticket[]
  messages  Message[]
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  password  String
  role      Role     @default(customer)
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  createdAt DateTime @default(now())

  sentMessages      Message[] @relation("SentMessages")
  ownedTickets      Ticket[]  @relation("TicketOwner")
  assignedTickets   Ticket[]  @relation("AssignedAgent")
}

model Ticket {
  id              String       @id @default(uuid())
  userId          String
  assignedAgentId String?
  tenantId        String
  status          TicketStatus @default(open)
  priority        Priority     @default(low)
  intent          String?
  emotion         String?
  summary         String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  user          User      @relation("TicketOwner",   fields: [userId],          references: [id])
  assignedAgent User?     @relation("AssignedAgent", fields: [assignedAgentId], references: [id])
  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  messages      Message[]
}

model Message {
  id        String   @id @default(uuid())
  ticketId  String
  senderId  String
  tenantId  String
  content   String
  isAI      Boolean  @default(false)
  createdAt DateTime @default(now())

  ticket   Ticket @relation(fields: [ticketId],  references: [id])
  sender   User   @relation("SentMessages", fields: [senderId], references: [id])
  tenant   Tenant @relation(fields: [tenantId],  references: [id])
}

enum Role {
  customer
  agent
  admin
}

enum TicketStatus {
  open
  in_progress
  closed
}

enum Priority {
  low
  medium
  high
}
```

---

## 8. Redis Client — `lib/redis.js`

```js
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

redis.on('error', (err) => console.error('Redis error:', err))

export default redis
```

---

## 9. Prisma Client — `lib/prisma.js`

```js
import { PrismaClient } from '@prisma/client'

const prisma = globalThis.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export default prisma
```

---

## 10. Error Handling

### REST API
```
All route handlers wrapped in try/catch
→ 400 Bad Request   — missing or invalid body fields
→ 401 Unauthorized  — invalid/missing JWT
→ 403 Forbidden     — role not permitted
→ 404 Not Found     — record doesn't exist or wrong tenantId
→ 409 Conflict      — unique constraint violation (e.g. email)
→ 500 Internal      — unhandled server error (log + generic message)
```

### AI Engine Failures
```
Claude API timeout / rate limit → catch error → return shouldEscalate: true
JSON parse failure              → return shouldEscalate: true (safe default)
Redis unavailable               → skip cache, call Claude directly (degraded mode)
```

### Socket.io
```
Auth failure on connect → emit 'error' event → client disconnects
Handler errors          → caught, logged, no crash to server process
```

---

## 11. Request / Response Examples

### POST `/api/auth/login`
```json
// Request
{ "email": "agent@shopeasy.com", "password": "secret123" }

// Response 200
{
  "token": "eyJhbGci...",
  "user": { "id": "uuid", "name": "Alice", "role": "agent", "tenantId": "uuid" }
}
```

### POST `/api/messages`
```json
// Request
{ "content": "Where is my order?", "ticketId": null }

// Response 200 — AI handles it
{ "messageId": "uuid", "aiReply": "Your order is out for delivery.", "ticketId": null }

// Response 200 — Escalated
{ "messageId": "uuid", "aiReply": "Connecting you to an agent...", "ticketId": "uuid" }
```

### GET `/api/admin/analytics`
```json
{
  "total": 142,
  "open": 18,
  "closed": 124,
  "aiResolved": 91,
  "aiResolutionRate": 0.64,
  "avgResolutionTime": "4m 32s"
}
```

---

## 12. Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://default:pass@host:6379
JWT_SECRET=your_jwt_secret_here
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
NODE_ENV=development
```
