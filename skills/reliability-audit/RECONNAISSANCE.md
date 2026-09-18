# Reconnaissance

Phase 1 of a full reliability audit. Build a shared map of the system and a machine-readable coverage ledger before any hunting.

## Goals

1. Understand what the target is (service, API, worker, library, monorepo slice).
2. Identify failure domains, trust boundaries, and critical dependencies.
3. Emit `architecture.md` and `coverage-ledger.json` under the audit output directory.
4. Validate the ledger with `validate-coverage-ledger.cjs` before Phase 2.

## Inputs

- Target path (repo root or subdirectory)
- Output directory from the parent isolation summary
- Optional: user-stated SLOs, prior incident notes, deploy topology (treat as claims to verify in-repo)

## Process

### Step 1 — Inventory

Scan the target for:

- Entry points: HTTP/gRPC handlers, CLI, queue consumers, cron/schedulers, library public APIs
- Process model: single process, multi-service, serverless functions, sidecars
- Data stores: SQL, document DB, cache, object storage, search indexes
- Messaging: queues, streams, pub/sub, outbox tables
- Config & feature flags: env files, config schemas, flag providers
- Deploy & rollout: Docker/K8s manifests, Terraform, CI deploy jobs, canary/blue-green hints
- Tests: unit, integration, contract, chaos/load (note presence; do not execute against shared envs)

Record file paths and symbols. Prefer directory-level summaries plus notable files over dumping entire trees into `architecture.md`.

### Step 2 — Boundaries and blast radius

For each major component, answer:

| Question | Why it matters |
|----------|----------------|
| What fails independently? | Defines failure domains |
| What shared resource couples domains? | Cascade and thundering-herd risk |
| Where do retries cross a boundary? | Retry amplification |
| Where is durability expected? | Data-loss and dual-write risk |
| Who owns backpressure? | Overload and bulkhead gaps |
| What is tenant- or customer-scoped? | Isolation and noisy-neighbor risk |

Draw trust boundaries: public edge, service mesh/internal RPC, data plane, control plane, CI/CD.

### Step 3 — Dependency classification

Classify outbound dependencies as:

- **Hard** — request cannot succeed without it (DB primary, auth issuer)
- **Soft** — degraded mode possible (recommendations cache, analytics)
- **Async** — success acknowledged before downstream completes (queues, outbox)

Note timeout, retry, and circuit-breaker configuration **as found in source**, not as assumed defaults.

### Step 4 — Write `architecture.md`

Suggested structure:

```markdown
# Architecture — <target name>

## Summary
<1 paragraph>

## Components
### <name>
- role:
- entrypoints: [paths]
- datastores:
- outbound deps:
- failure domain:

## Boundaries
- ...

## Critical paths
1. <user/API flow> → ...
2. <async flow> → ...

## Observability touchpoints found
- metrics:
- traces:
- logs:
- alerts/SLO docs:

## Unknowns / assumptions
- ...
```

Keep it factual. Label speculation under Unknowns.

### Step 5 — Build `coverage-ledger.json`

The ledger is the contract between recon and hunting. Every hunt task must reference a ledger `unit.id`.

#### Schema (conceptual)

Top-level object:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `version` | string | yes | Use `"1.0"` |
| `target` | string | yes | Absolute or repo-relative target path |
| `createdAt` | string | yes | ISO-8601 |
| `units` | array | yes | Non-empty for a full audit |

Each **unit**:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Stable slug, e.g. `api-timeouts`, `worker-idempotency` |
| `title` | string | yes | Short human label |
| `category` | string | yes | One of: `failure-class`, `observability`, `data-consistency`, `boundary`, `dependency`, `other` |
| `scope` | object | yes | See below |
| `status` | string | yes | `pending` \| `in_progress` \| `covered` \| `deferred` |
| `priority` | string | no | `p0` \| `p1` \| `p2` |
| `notes` | string | no | Deferral rationale or pointers |
| `evidencePaths` | string[] | no | Filled as hunting proceeds |

`scope` object:

| Field | Type | Required |
|-------|------|----------|
| `paths` | string[] | yes (may be empty only if `symbols` non-empty) |
| `symbols` | string[] | no |
| `description` | string | yes |

#### Seed units (adapt to target)

Create units that cover, at minimum when present in the architecture:

- Edge/API timeout and deadline propagation
- Retry / backoff / jitter policies
- Circuit breaker / bulkhead / concurrency limits
- Queue consumers: ack, visibility timeout, DLQ, poison messages
- Idempotency keys and exactly-once/at-least-once assumptions
- Cache invalidation and stampede controls
- Dual-write or multi-store workflows
- Deploy/rollout partial-failure behavior
- Metrics, traces, logs, alerting, and any SLO docs
- Multi-region or replica lag handling (if applicable)

Do not create dozens of empty units. Prefer 8–25 sharp units over 100 vague ones.

#### Example unit

```json
{
  "id": "checkout-api-deadlines",
  "title": "Checkout API deadline propagation",
  "category": "failure-class",
  "scope": {
    "paths": ["src/api/checkout/", "src/clients/"],
    "symbols": ["CheckoutHandler", "PaymentsClient"],
    "description": "How timeouts and deadlines flow from edge handler to payments and inventory clients"
  },
  "status": "pending",
  "priority": "p0"
}
```

### Step 6 — Validate and hand off

```bash
node <skill>/validate-coverage-ledger.cjs <output>/coverage-ledger.json
```

Fix errors before Phase 2. Parent updates isolation summary with paths to `architecture.md` and the ledger.

## Quality bar

- Another engineer can understand blast radius from `architecture.md` alone.
- Every critical path in architecture maps to ≥1 ledger unit.
- No unit lacks a clear `scope.description`.
- Deferred units include `notes` explaining why.

## Anti-patterns

- Skipping the ledger and "just reading the code"
- Units scoped to the entire monorepo with no description
- Marking units `covered` during recon (recon only creates them as `pending` or `deferred`)
- Inventing infrastructure not evidenced in the repo
