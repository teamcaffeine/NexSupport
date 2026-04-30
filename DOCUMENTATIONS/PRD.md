# Product Requirement Document
## Smart Customer Support System

**Version:** 1.0  
**Date:** 2026-04-29  
**Author:** pyKalki  

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Product Vision](#2-product-vision)
3. [Target Users](#3-target-users)
4. [System Architecture](#4-system-architecture)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Database Schema](#7-database-schema)
8. [API Design](#8-api-design)
9. [Real-Time Events (Socket.io)](#9-real-time-events-socketio)
10. [AI Engine Specification](#10-ai-engine-specification)
11. [Decision Engine Logic](#11-decision-engine-logic)
12. [Multi-Tenant Architecture](#12-multi-tenant-architecture)
13. [Authentication & Authorization](#13-authentication--authorization)
14. [Caching Strategy (Redis)](#14-caching-strategy-redis)
15. [UI/UX Requirements](#15-uiux-requirements)
16. [Tech Stack](#16-tech-stack)
17. [Out of Scope](#17-out-of-scope)
18. [Success Metrics](#18-success-metrics)

---

## 1. Problem Statement

Traditional customer support systems are either fully manual (expensive, slow) or fully automated (frustrating for complex issues). There is no intelligent middle layer that decides *when* AI is sufficient and *when* a human agent must step in.

**Core pain points:**
- Simple queries waste human agent time
- Complex or emotionally charged queries get stuck in bot loops
- Support teams have no unified dashboard for ticket management
- SaaS companies need multi-tenant isolation without running separate systems

---

## 2. Product Vision

> **"Build a Smart Support System that automatically routes customer queries — easy ones to AI, hard ones to humans — with a full Jira-style ticket workflow, real-time communication, and multi-tenant support."**

### Goals
- Reduce average resolution time by routing intelligently
- Allow one platform to serve multiple companies (multi-tenant)
- Provide agents a clear, real-time dashboard
- Give admins full visibility via analytics

---

## 3. Target Users

| Role | Description |
|---|---|
| **Customer** | End-user who sends support messages |
| **Agent** | Support staff who handles escalated tickets |
| **Admin** | Manages users, tickets, tenants, and analytics |
| **Tenant** | A company (e.g. ShopEasy, FoodFast) using the platform |

---

## 4. System Architecture

```
┌─────────────┐        ┌──────────────────────────────────────────┐
│   Customer  │◄──────►│              API Server (Node.js)         │
│   (Browser) │        │                                          │
└─────────────┘        │   ┌──────────────┐  ┌────────────────┐  │
                        │   │  REST Routes │  │  Socket.io     │  │
┌─────────────┐        │   └──────┬───────┘  └──────┬─────────┘  │
│    Agent    │◄──────►│          │                  │            │
│  Dashboard  │        │   ┌──────▼──────────────────▼─────────┐  │
└─────────────┘        │   │         Core Logic Layer           │  │
                        │   │  ┌─────────────┐ ┌─────────────┐  │  │
┌─────────────┐        │   │  │ AI Engine   │ │Decision Eng.│  │  │
│    Admin    │◄──────►│   │  │ (Claude API)│ │             │  │  │
│    Panel    │        │   │  └─────────────┘ └─────────────┘  │  │
└─────────────┘        │   └────────────────────────────────────┘  │
                        │                                          │
                        │   ┌──────────┐  ┌──────┐  ┌──────────┐  │
                        │   │ PostgreSQL│  │Redis │  │ Claude   │  │
                        │   │    DB    │  │Cache │  │   API    │  │
                        │   └──────────┘  └──────┘  └──────────┘  │
                        └──────────────────────────────────────────┘
```

---

## 5. Functional Requirements

### 5.1 Chat System

| ID | Requirement | Priority |
|---|---|---|
| CS-01 | Customer can open a chat window and send a text message | P0 |
| CS-02 | Customer receives a response in real-time via Socket.io | P0 |
| CS-03 | Chat history is persisted per session/ticket | P0 |
| CS-04 | Customer sees a typing indicator when AI or agent is composing | P1 |
| CS-05 | Customer can see whether they are talking to AI or a human agent | P1 |

### 5.2 AI Engine

| ID | Requirement | Priority |
|---|---|---|
| AI-01 | Every incoming message is sent to Claude API for analysis | P0 |
| AI-02 | Claude returns `intent`, `emotion`, `confidence`, `shouldEscalate`, `suggestedReply` | P0 |
| AI-03 | AI response is cached in Redis to avoid duplicate API calls for identical messages | P1 |
| AI-04 | AI reply is sent directly to customer when `shouldEscalate = false` | P0 |

**Claude API Output Schema:**
```json
{
  "intent": "order_tracking",
  "emotion": "angry",
  "confidence": 0.85,
  "shouldEscalate": true,
  "suggestedReply": "I'm sorry for the delay. Let me connect you with an agent."
}
```

### 5.3 Ticket System

| ID | Requirement | Priority |
|---|---|---|
| TK-01 | A ticket is auto-created when `shouldEscalate = true` | P0 |
| TK-02 | Ticket stores: `userId`, `tenantId`, `problem summary`, `priority`, `status`, `assignedAgentId` | P0 |
| TK-03 | Ticket status transitions: `open → in_progress → closed` | P0 |
| TK-04 | Ticket is assigned to the least-busy available agent (round-robin or load-based) | P1 |
| TK-05 | All messages (AI + human) are linked to a ticket via `ticketId` | P0 |
| TK-06 | Admin can manually reassign or close tickets | P1 |
| TK-07 | Ticket priority is set based on emotion: `angry → HIGH`, `frustrated → MEDIUM`, `neutral → LOW` | P1 |

### 5.4 Agent Dashboard

| ID | Requirement | Priority |
|---|---|---|
| AG-01 | Agent sees a list of all tickets assigned to them | P0 |
| AG-02 | Agent can open a ticket and view full message history | P0 |
| AG-03 | Agent can reply to a customer in real-time | P0 |
| AG-04 | Agent receives a real-time notification when a new ticket is assigned | P0 |
| AG-05 | Agent can mark a ticket as `closed` | P0 |
| AG-06 | Agent sees customer emotion/intent label on the ticket card | P1 |

### 5.5 Admin Panel

| ID | Requirement | Priority |
|---|---|---|
| AD-01 | Admin can view all tickets across all agents (filtered by tenant) | P0 |
| AD-02 | Admin can view all users and their roles | P0 |
| AD-03 | Admin can promote/demote users (customer ↔ agent) | P1 |
| AD-04 | Admin sees analytics: total tickets, open vs closed, AI resolution rate, avg resolution time | P1 |
| AD-05 | Admin can create/manage tenants | P0 |

### 5.6 Multi-Tenant

| ID | Requirement | Priority |
|---|---|---|
| MT-01 | Every data record (User, Ticket, Message) includes a `tenantId` | P0 |
| MT-02 | All queries are scoped to the requesting user's `tenantId` | P0 |
| MT-03 | Tenants are fully isolated — no cross-tenant data leak | P0 |
| MT-04 | Admin of Tenant A cannot see Tenant B's data | P0 |

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | AI analysis response time < 2s (with cache hit < 100ms) |
| **Scalability** | System must support 10+ concurrent tenants and 1000+ concurrent users |
| **Reliability** | 99.9% uptime for the Socket.io real-time layer |
| **Security** | All routes protected by JWT; tenantId verified on every request |
| **Caching** | Redis used for AI results, agent availability, dashboard stats |
| **Observability** | Basic request logging and error tracking |

---

## 7. Database Schema

### Users
```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('customer', 'agent', 'admin') DEFAULT 'customer',
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### Tenants
```sql
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### Tickets
```sql
CREATE TABLE tickets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  assigned_agent_id UUID REFERENCES users(id),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  status            ENUM('open', 'in_progress', 'closed') DEFAULT 'open',
  priority          ENUM('low', 'medium', 'high') DEFAULT 'low',
  intent            VARCHAR(100),
  emotion           VARCHAR(50),
  summary           TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

### Messages
```sql
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES tickets(id),
  sender_id   UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  is_ai       BOOLEAN DEFAULT FALSE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 8. API Design

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |

### Chat / Messages
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/messages` | Send a message (triggers AI analysis) |
| GET | `/api/messages/:ticketId` | Get all messages for a ticket |

### Tickets
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tickets` | List tickets (scoped by role + tenantId) |
| GET | `/api/tickets/:id` | Get single ticket detail |
| PATCH | `/api/tickets/:id/status` | Update ticket status |
| PATCH | `/api/tickets/:id/assign` | Reassign ticket to agent |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users` | List all users for tenant |
| PATCH | `/api/admin/users/:id/role` | Change user role |
| GET | `/api/admin/analytics` | Get dashboard analytics |
| POST | `/api/admin/tenants` | Create new tenant |

---

## 9. Real-Time Events (Socket.io)

### Customer Events
| Event | Direction | Payload | Description |
|---|---|---|---|
| `user:message` | Client → Server | `{ message, tenantId }` | Customer sends a message |
| `ai:reply` | Server → Client | `{ reply, isAI: true }` | AI response sent back |
| `ticket:created` | Server → Client | `{ ticketId, message }` | Notifies customer ticket was raised |
| `agent:message` | Server → Client | `{ reply, agentName }` | Human agent reply |

### Agent Events
| Event | Direction | Payload | Description |
|---|---|---|---|
| `ticket:assigned` | Server → Agent | `{ ticketId, userId, emotion, intent }` | New ticket assigned |
| `agent:message` | Agent → Server | `{ ticketId, message }` | Agent sends reply |

### Connection
```js
// JWT passed in handshake auth
const socket = io(SERVER_URL, {
  auth: { token: jwtToken }
});
```

---

## 10. AI Engine Specification

### Input to Claude
```
System Prompt:
You are a customer support AI. Analyze the following customer message.
Return JSON only with these fields:
- intent (string): category of the problem
- emotion (string): angry | frustrated | neutral | happy
- confidence (number): 0.0 to 1.0
- shouldEscalate (boolean): whether a human agent is needed
- suggestedReply (string): a draft reply to the customer

User Message:
"{customerMessage}"
```

### Response Handling
- Parse JSON from Claude response
- On parse failure: default to `shouldEscalate: true` for safety
- Cache key: `ai_cache:{tenantId}:{SHA256(message)}`
- Cache TTL: 1 hour

---

## 11. Decision Engine Logic

```
IF emotion == "angry"
  → shouldEscalate = true, priority = HIGH

ELSE IF emotion == "frustrated" OR confidence < 0.5
  → shouldEscalate = true, priority = MEDIUM

ELSE IF confidence >= 0.5 AND emotion == "neutral"
  → shouldEscalate = false
  → Send suggestedReply directly to customer

IF shouldEscalate == true:
  1. Create ticket in DB
  2. Find least-busy agent for tenantId
  3. Assign ticket to agent
  4. Emit ticket:assigned to agent socket
  5. Emit ticket:created to customer socket
```

---

## 12. Multi-Tenant Architecture

- Every JWT payload includes `{ userId, role, tenantId }`
- Every DB query includes a `WHERE tenant_id = :tenantId` clause
- Socket.io rooms are namespaced by `tenantId`: `room:${tenantId}:${ticketId}`
- Redis keys are prefixed with `tenantId`: `ai_cache:{tenantId}:...`
- No shared state between tenants

**Tenant Onboarding Flow:**
1. Admin creates tenant via `POST /api/admin/tenants`
2. First admin user is linked to new `tenantId`
3. Tenant can now register customers and agents

---

## 13. Authentication & Authorization

### JWT Payload
```json
{
  "userId": "uuid",
  "role": "customer | agent | admin",
  "tenantId": "uuid",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Route Guards
| Role | Accessible Routes |
|---|---|
| `customer` | `/api/messages`, `/api/tickets` (own only) |
| `agent` | Above + agent dashboard routes + `/api/tickets` (assigned) |
| `admin` | All routes within their `tenantId` |

### Middleware Chain
```
Request → verifyJWT → extractTenantId → checkRole → handler
```

---

## 14. Caching Strategy (Redis)

| Cache Key | Value | TTL | Purpose |
|---|---|---|---|
| `ai_cache:{tenantId}:{msgHash}` | AI analysis JSON | 1 hour | Avoid duplicate Claude API calls |
| `agents:available:{tenantId}` | List of online agent IDs | 5 min | Fast agent assignment |
| `stats:{tenantId}` | Analytics snapshot | 10 min | Admin dashboard speed |
| `session:{userId}` | Socket ID | Duration of connection | Route messages to correct socket |

---

## 15. UI/UX Requirements

### Customer Chat Widget
- Floating chat button (bottom-right)
- Message bubbles: customer (right, blue) / AI (left, gray) / Agent (left, green)
- Label: "Talking to AI" or "Talking to [Agent Name]"
- Typing indicator

### Agent Dashboard
- Sidebar: list of assigned tickets with status badge + emotion tag
- Main view: ticket detail with full message thread
- Reply box at the bottom
- Real-time unread badge on new tickets

### Admin Panel
- Overview cards: Total Tickets | Open | Closed | AI Resolved %
- Table: all tickets with filters (status, priority, tenant)
- User management table with role editing
- Simple bar/line charts for ticket volume over time

---

## 16. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js + Tailwind CSS |
| **Backend** | Node.js + Express.js |
| **Real-Time** | Socket.io |
| **Database** | PostgreSQL (via Prisma ORM) |
| **Cache** | Redis |
| **AI** | Claude API (claude-sonnet-4-6) |
| **Auth** | JWT (jsonwebtoken) |
| **Hosting** | Vercel (frontend) + Railway/Render (backend) |

---

## 17. Out of Scope (v1.0)

- Voice/video support
- Email/SMS channel integration
- Custom AI model training
- Billing / subscription management per tenant
- Mobile native apps
- SLA breach alerts

---

## 18. Success Metrics

| Metric | Target |
|---|---|
| AI Resolution Rate | > 60% of tickets resolved without agent |
| Average First Response Time | < 3 seconds (AI) / < 2 minutes (agent) |
| Escalation Accuracy | > 85% of angry/frustrated users correctly escalated |
| System Uptime | > 99.9% |
| Cache Hit Rate | > 70% on repeated queries |
