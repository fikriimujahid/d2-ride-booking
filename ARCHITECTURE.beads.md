> **This document defines non-negotiable architectural invariants (“beads”).
> These rules override all defaults, patterns, and assumptions made by AI agents or humans.
> Any output that violates a bead is considered INVALID and must be regenerated.**

---

## 🔴 B0 — Authority & Precedence (Meta Rule)

* This file is the **single source of truth** for architecture decisions.
* All AI agents **MUST read and obey this file before generating any output**.
* If a task conflicts with any bead:

  * **STOP**
  * **ASK for clarification**
* Creativity is allowed **only within these constraints**.

---

## 🧠 B1 — Backend Architecture (Modular Monolith)

**The backend architecture is a Modular Monolith.**

### Mandatory Rules

* There is **EXACTLY ONE backend application**
* **EXACTLY ONE Fastify server**
* **EXACTLY ONE HTTP port**
* **EXACTLY ONE `package.json` for backend**
* **NO microservices**
* **NO additional backend servers**
* **NO auth-service, ride-service, payment-service, etc.**

### Structure Rules

```
backend/
  package.json
  tsconfig.json
  src/
    server.ts
    app.ts
    modules/
    shared/
    plugins/
    config/
```

* All features are implemented as **modules** under `src/modules/`
* Shared logic lives under `src/shared/`
* The backend must be **stateless** (session data not stored in memory)

---

## 🟦 B2 — Technology Stack (MANDATORY)

### Backend

* **Node.js**
* **TypeScript (MANDATORY)**
* **Fastify**
* **PostgreSQL**
* **Redis** (only when explicitly introduced)
* **JWT / Cognito (depending on phase)**

### Frontend

* **TypeScript (MANDATORY)**
* **React**
* **v0.app compatible**
* Separate projects:

  * `web_admin`
  * `web_driver`
  * `web_passenger`

### ❌ Forbidden

* JavaScript (non-TypeScript) code
* `any` type unless explicitly justified
* Implicit `any`
* Mixed JS/TS codebases

---

## 🔐 B3 — TypeScript Best Practices & Security (CRITICAL)

### Global TypeScript Rules (Backend & Frontend)

* `strict: true` MUST be enabled in `tsconfig.json`
* No `any`, `unknown` preferred when type is uncertain
* All external inputs MUST be validated and typed
* DTOs must be explicitly defined
* No runtime type assumptions

### Backend-Specific

* All request/response schemas must be typed
* Use schema validation (e.g. Zod / Fastify schema)
* Never trust data from:

  * HTTP requests
  * JWT claims
  * Webhooks
* All environment variables must be typed and validated at startup
* No secrets hardcoded or logged

### Frontend-Specific

* All API responses must be typed
* No blind `JSON.parse`
* Auth tokens handled securely (no localStorage for sensitive flows if avoidable)
* Proper error boundaries and typed error handling

---

## 🔐 B4 — Authentication & Authorization Ownership

### Separation of Concerns

* **Authentication**: identity, login, token issuance
* **Authorization**: roles, permissions, business rules

### Mandatory Rules

* Authorization logic ALWAYS lives in backend
* Frontend NEVER decides permissions
* RBAC is enforced via middleware
* Admin, Driver, Passenger roles are mandatory

### Cognito Rule (Phase-Dependent)

* Cognito may replace **authentication**
* Cognito MUST NOT contain business logic
* Backend remains source of truth for:

  * RBAC
  * ride rules
  * payment rules

---

## 🧩 B5 — Phase Completion Rule (VERY IMPORTANT)

A phase is **NOT COMPLETE** unless **ALL** of the following are done:

1. Backend API implemented (in the monolith)
2. Web Admin frontend integrated
3. Web Driver frontend integrated
4. Web Passenger frontend integrated
5. Deployed to **DEV** via CI/CD
6. Basic verification tests passed

If any item is missing → **phase is incomplete**

---

## 🌐 B6 — Frontend Integration Rule

* All frontends communicate with **ONE API base URL**
* No frontend may talk to multiple backend services
* API contracts are shared and versioned
* Frontend logic must align with backend permissions

---

## 🚀 B7 — Deployment & Environment Rules

### DEV Environment

* Backend → EC2 (single instance or ASG later)
* `web_admin` → S3 static + CloudFront
* `web_driver` → S3 static + CloudFront
* `web_passenger` → EC2 / ASG (Node runtime if needed)

### CI/CD Rules

* Deploy on merge to `dev`
* No manual SSH deploys
* Secrets injected securely
* Dependency scan & secret scan enabled

---

## 🚫 B8 — Forbidden Outputs (HARD FAIL)

If an AI agent produces **ANY** of the following, the output is invalid:

* Multiple backend servers
* Multiple backend ports
* Multiple backend `package.json`
* Separate auth / ride / payment services
* Backend code in JavaScript
* Ignoring TypeScript strict mode
* Frontend bypassing backend authorization

---

## 🧪 B9 — Verification & Testing Discipline

* Each phase must include:

  * API verification
  * Frontend verification
  * Deployment verification
* Failing tests or broken integration **block progression**
* No skipping verification “to come back later”

---

## 🧭 B10 — Migration & Evolution Rule

* Refactoring is allowed
* Migration is allowed (e.g. Custom Auth → Cognito)
* Breaking architectural beads is **NOT allowed**
* Any change to beads requires:

  * Explicit discussion
  * Written decision
  * Versioned update of this file

---

## 🟢 B11 — How AI Agents Must Behave

Before generating output, an AI agent MUST:

1. Read `ARCHITECTURE.beads.md`
2. Confirm compliance
3. Generate output
4. Self-check for bead violations
5. State assumptions if any

Failure to do so invalidates the output.

---