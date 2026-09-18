# Data and consistency

Domain checklist for ledger category `data-consistency`. Focus on correctness under retries, partial failure, multi-store writes, caches, and geo topology. Static analysis and sandbox reasoning only.

## Goals

- Find places where durability, ordering, or visibility assumptions break under failure.
- Distinguish **availability** tricks (serve stale) from **correctness** bugs (double write, lost update).
- Tie each candidate to a data boundary and a user-visible consistency failure mode.

---

## 1. Dual-write (multi-store without a single transaction)

**Look for**

- Writing to DB and cache/queue/search in one request without transactional outbox or two-phase patterns
- "Update A then B" sequences with partial success paths
- Compensating transactions that are best-effort only

**Failure mode**

- A succeeds, B fails → permanent divergence until repair
- Retry repeats A (if not idempotent) while B still missing

**Evidence**

- Service methods with multiple side effects; missing outbox/inbox tables; lack of reconciliation jobs

**Impact questions**

- Can users see updated profile but stale search?
- Can money move without ledger row (or reverse)?

---

## 2. Transactional outbox / inbox

**Look for**

- Outbox table written in the same DB transaction as business state
- Publisher relay; at-least-once delivery to bus; consumer inbox dedupe
- Ordering keys and partition strategies

**Anti-patterns**

- Emitting events before commit
- Outbox poller without backoff/jitter under DB pressure
- Consumers without idempotent handlers

**Evidence**

- Schema migrations; relay workers; idempotency keys on consumers

---

## 3. Cache invalidation and stampede

**Look for**

- Write-through, write-behind, TTL-only, explicit invalidate
- Locking or singleflight for fill
- Negative caching

**Anti-patterns**

- TTL-only on strongly correct data (permissions, balances) without version checks
- Invalidate-then-write races
- Thundering herd on expiry (see FAILURE-CLASSES)

**Evidence**

- Cache client usage; key design; version/etag fields

**Impact questions**

- Stale authz? Stale inventory sold twice? Origin collapse on expiry?

---

## 4. Read-your-writes and session consistency

**Look for**

- Load-balanced reads against replicas
- Sticky sessions; causal tokens; "primary read after write" flags
- Client retries hitting another replica

**Anti-patterns**

- Read-after-write on replica without lag awareness
- UI assuming immediate global visibility after 200 OK

**Evidence**

- Replica routing config; `readPreference`; post-write read paths

---

## 5. Multi-region and geo replication

**Look for**

- Active-active vs active-passive docs and code
- Conflict resolution (LWW, CRDTs, app merge)
- Region failover runbooks as code/docs

**Anti-patterns**

- LWW on counters or collaborative state without merge
- Failover that breaks idempotency keys scoped to one region
- Assuming synchronous cross-region commit when config shows async replication

**Evidence**

- Replication settings; conflict handlers; region-aware keys

**Impact questions**

- Lost updates on concurrent regional writes?
- Split inventory across regions?

---

## 6. Schema migration and expand/contract

**Look for**

- Migration toolchains; dual-read/dual-write windows; feature flags gating new columns
- Destructive migrations colocated with app deploys

**Anti-patterns**

- Drop column while old binaries still write it
- Non-null column add without default on large tables (availability hit — also reliability)

**Evidence**

- Migration files sequenced against deploy docs

---

## 7. Exactly-once illusions

**Look for**

- Comments or configs claiming exactly-once without idempotent consumers + dedupe store
- Side effects outside the transactional boundary that dedupes

**Guidance**

- Treat broker "exactly once" features as helpers, still verify handler idempotency in code

---

## 8. Reconciliation and repair

**Look for**

- Periodic checkers comparing stores; drift metrics; manual repair tools
- Absence of reconciliation where dual-write exists

**Gap pattern**

- Dual-write present, no checker → candidate for consistency risk + observability gap

---

## Candidate shape reminders

- `boundary`: usually `data`
- `failureClass`: `consistency` or a specific tag (`dual-write`, `cache`, `multi-region`)
- Always state the **inconsistency window** and whether it self-heals
- Severity: durable incorrect money/inventory/authz → high/critical; briefly stale non-critical content → lower

## Suggested ledger units

- `dual-write-paths`
- `outbox-relay`
- `cache-invalidation`
- `replica-read-after-write`
- `multi-region-conflicts`
- `migration-compat`
- `reconciliation-jobs`

## Anti-patterns

- Demanding serializable transactions everywhere without impact
- Ignoring documented eventual-consistency product behavior (still note if UX promises stronger)
- Proposing live data compares across prod regions
