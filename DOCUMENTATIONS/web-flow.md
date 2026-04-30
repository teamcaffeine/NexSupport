# Web Flow Document
## Smart Customer Support System

---

## 1. Authentication Flow

### Register
```
User fills Register form
  → POST /api/auth/register { name, email, password, tenantId }
  → Server creates user (role: 'customer' by default)
  → Returns JWT
  → Client stores JWT in localStorage
  → Redirect to Chat Widget (customer) or Dashboard (agent/admin)
```

### Login
```
User fills Login form
  → POST /api/auth/login { email, password }
  → Server validates credentials
  → Returns JWT { userId, role, tenantId, exp }
  → Client stores JWT
  → Role-based redirect:
      customer  → /chat
      agent     → /agent/dashboard
      admin     → /admin/panel
```

---

## 2. Customer Chat Flow

### 2a. Opening Chat
```
Customer visits tenant's site
  → Floating chat button (bottom-right) visible
  → Customer clicks button
  → Chat widget opens
  → Socket.io connection established (JWT sent in handshake auth)
  → Customer joins socket room: room:{tenantId}:{userId}
```

### 2b. Sending a Message
```
Customer types message → clicks Send
  │
  ├─ Socket emits: user:message { message, tenantId }
  │
  ├─ Server receives message
  │     ├─ Check Redis cache: ai_cache:{tenantId}:{SHA256(message)}
  │     │     ├─ Cache HIT  → use cached AI result (< 100ms)
  │     │     └─ Cache MISS → call Claude API (< 2s)
  │     │           └─ Store result in Redis (TTL: 1 hour)
  │     │
  │     └─ AI returns: { intent, emotion, confidence, shouldEscalate, suggestedReply }
  │
  └─ Decision Engine runs (see Section 5)
```

### 2c. AI Handles the Query (No Escalation)
```
shouldEscalate = false
  → Server emits: ai:reply { reply: suggestedReply, isAI: true }
  → Customer sees AI bubble (gray, left-aligned)
  → Widget label: "Talking to AI"
  → Message saved to DB (is_ai: true, linked to ticket if exists)
```

### 2d. Query Escalated to Human Agent
```
shouldEscalate = true
  → Ticket created in DB (status: open, priority based on emotion)
  → Least-busy available agent found for tenantId
  → Ticket assigned to agent
  → Server emits to customer: ticket:created { ticketId, message }
  → Server emits to agent:   ticket:assigned { ticketId, userId, emotion, intent }
  → Customer widget label switches to "Connecting you to an agent..."
```

### 2e. Live Chat with Agent
```
Agent opens ticket and replies
  → Agent emits: agent:message { ticketId, message }
  → Server emits to customer: agent:message { reply, agentName }
  → Customer sees agent bubble (green, left-aligned)
  → Widget label: "Talking to [Agent Name]"
  → Typing indicator shown while agent is composing
```

---

## 3. Agent Dashboard Flow

### 3a. Dashboard Load
```
Agent logs in → /agent/dashboard
  → GET /api/tickets (scoped: assignedAgentId = me, tenantId = mine)
  → Sidebar renders ticket list:
      [Ticket card: customer name | status badge | emotion tag | priority]
  → Socket connects → joins agent's personal room
```

### 3b. Receiving a New Ticket (Real-Time)
```
Server emits: ticket:assigned { ticketId, userId, emotion, intent }
  → New ticket card appears in sidebar (with unread badge)
  → Browser notification (if permitted)
```

### 3c. Opening a Ticket
```
Agent clicks ticket card
  → GET /api/tickets/:id          (ticket detail)
  → GET /api/messages/:ticketId   (full message history)
  → Main view renders full thread:
      [AI messages | Customer messages | Agent messages]
  → Emotion/intent label shown at top of thread
  → Reply box at bottom
```

### 3d. Replying to Customer
```
Agent types reply → clicks Send
  → Socket emits: agent:message { ticketId, message }
  → Message saved to DB (is_ai: false, sender_id: agentId)
  → Server forwards to customer socket
  → Customer sees agent reply in real-time
```

### 3e. Closing a Ticket
```
Agent clicks "Close Ticket"
  → PATCH /api/tickets/:id/status { status: 'closed' }
  → Ticket removed from agent's active list
  → Customer widget shows: "Your issue has been resolved."
  → Agent availability count updates in Redis
```

---

## 4. Admin Panel Flow

### 4a. Panel Load
```
Admin logs in → /admin/panel
  → GET /api/admin/analytics  → Overview cards rendered:
      [Total Tickets | Open | Closed | AI Resolution %]
  → GET /api/tickets (all tickets for tenantId, with filters)
  → Ticket table: status | priority | assignedAgent | createdAt
```

### 4b. Ticket Management
```
Admin filters tickets (status / priority / agent)
  → Table updates (client-side filter or query param)
Admin clicks a ticket
  → GET /api/tickets/:id  → Full detail view
Admin reassigns ticket
  → PATCH /api/tickets/:id/assign { agentId }
Admin closes ticket
  → PATCH /api/tickets/:id/status { status: 'closed' }
```

### 4c. User Management
```
Admin → Users tab
  → GET /api/admin/users  → Table: name | email | role | joined
Admin promotes customer to agent (or demotes)
  → PATCH /api/admin/users/:id/role { role: 'agent' }
  → User's JWT invalidated on next request (role change takes effect at re-login)
```

### 4d. Tenant Onboarding
```
Super-admin → POST /api/admin/tenants { name }
  → New tenant row created with UUID
  → First admin user linked to tenantId
  → Admin can now register customers and agents under this tenant
```

---

## 5. Decision Engine Flow

```
Incoming message analysis result:
┌─────────────────────────────────────────────────┐
│  emotion == "angry"                             │
│    → shouldEscalate = true, priority = HIGH     │
├─────────────────────────────────────────────────┤
│  emotion == "frustrated" OR confidence < 0.5    │
│    → shouldEscalate = true, priority = MEDIUM   │
├─────────────────────────────────────────────────┤
│  confidence >= 0.5 AND emotion == "neutral"     │
│    → shouldEscalate = false                     │
│    → Send suggestedReply directly to customer   │
└─────────────────────────────────────────────────┘

IF shouldEscalate == true:
  1. INSERT ticket (status: open, priority, intent, emotion, summary)
  2. Query Redis: agents:available:{tenantId}
       → Pick least-busy agent (round-robin or load count)
  3. UPDATE ticket SET assigned_agent_id = agentId
  4. Emit ticket:assigned → agent socket room
  5. Emit ticket:created  → customer socket room
```

---

## 6. Real-Time Socket.io Room Structure

```
Connection:
  io(SERVER_URL, { auth: { token: JWT } })

Rooms:
  Customer joins: room:{tenantId}:{userId}
  Agent joins:    room:{tenantId}:agent:{agentId}
  Ticket thread:  room:{tenantId}:{ticketId}

Event routing:
  user:message     → Customer → Server → AI Engine → Decision Engine
  ai:reply         → Server → Customer room
  ticket:created   → Server → Customer room
  ticket:assigned  → Server → Agent room
  agent:message    → Agent  → Server → Ticket room (customer + agent)
```

---

## 7. Middleware Chain (Every Request)

```
HTTP Request
  → verifyJWT          (validate token, decode payload)
  → extractTenantId    (attach tenantId from JWT to req)
  → checkRole          (guard route by role: customer/agent/admin)
  → handler            (business logic, all DB queries scoped by tenantId)
```

---

## 8. Page / Route Map

| Path | Role | Component |
|---|---|---|
| `/` | Public | Landing / Login redirect |
| `/login` | Public | Login form |
| `/register` | Public | Register form |
| `/chat` | Customer | Chat widget (full page or embedded) |
| `/agent/dashboard` | Agent | Sidebar + ticket thread view |
| `/admin/panel` | Admin | Analytics + ticket table + user management |

---

## 9. End-to-End Happy Path (Customer → AI → Resolved)

```
1. Customer opens chat widget
2. Types: "Where is my order #1234?"
3. Socket emits user:message
4. Server checks Redis cache → MISS → calls Claude API
5. Claude returns: { intent: "order_tracking", emotion: "neutral",
                     confidence: 0.87, shouldEscalate: false,
                     suggestedReply: "Your order #1234 is out for delivery." }
6. Result cached in Redis (1 hour)
7. Server emits ai:reply to customer
8. Customer sees AI response (< 2s)
9. Issue resolved — no ticket created
```

---

## 10. End-to-End Escalation Path (Customer → Agent → Closed)

```
1. Customer types: "This is the third time my order was wrong! I want a refund NOW."
2. Socket emits user:message
3. Claude returns: { intent: "refund_request", emotion: "angry",
                     confidence: 0.92, shouldEscalate: true,
                     suggestedReply: "I'm sorry for the inconvenience..." }
4. Decision Engine: emotion = angry → priority = HIGH, escalate = true
5. Ticket created (status: open, priority: high)
6. Least-busy agent found from Redis agents:available:{tenantId}
7. Ticket assigned to agent
8. Agent receives ticket:assigned notification (real-time)
9. Customer receives ticket:created + suggestedReply as interim message
10. Agent opens ticket, reads history, types reply
11. Customer receives agent:message in real-time
12. Issue resolved → Agent clicks "Close Ticket"
13. PATCH /api/tickets/:id/status { status: 'closed' }
14. Customer sees: "Your issue has been resolved."
```
