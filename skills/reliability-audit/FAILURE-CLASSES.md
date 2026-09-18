# Failure classes

Domain checklist for reliability hunters and verifiers. Use these classes to name `failureClass` on candidates and to drive ledger units under category `failure-class`.

Each class lists: what to look for, common anti-patterns, evidence to capture, and impact questions. All checks are static or sandboxed-local — never live production probing.

---

## 1. Timeout and deadline propagation

**Look for**

- HTTP/gRPC client timeouts, server write timeouts, ORM/query timeouts
- Context/deadline objects passed through call chains (or dropped)
- Mismatch: edge timeout longer than downstream sum of timeouts (or the reverse)
- Infinite or missing timeouts on sockets, pools, or external SDKs

**Anti-patterns**

- No timeout on outbound calls
- Soft timeout that retries without a parent deadline
- Wall-clock sleeps used instead of deadlines

**Evidence**

- Config defaults, client constructors, middleware that sets deadlines
- Call sites that create new contexts without inheriting parent cancellation

**Impact questions**

- Can threads/workers block until pool exhaustion?
- Do clients abandon requests while servers still work (tail latency + wasted load)?

---

## 2. Retry amplification

**Look for**

- Retry loops, SDK retry policies, mesh/proxy retries, queue redelivery
- Layered retries (client + mesh + worker) without budgets
- Missing jitter; synchronized backoff
- Retrying non-idempotent methods (POST without idempotency keys)

**Anti-patterns**

- Aggressive retries on resource exhaustion (makes overload worse)
- Retry storms when a dependency fails
- No maximum attempt count or aggregate retry budget

**Evidence**

- Retry config values; which errors are retryable; idempotency requirements

**Impact questions**

- Multiplicative traffic toward a failing dependency?
- Can retries outlive the user/request deadline?

---

## 3. Circuit breaker (CB)

**Look for**

- CB libraries or hand-rolled open/half-open/closed state machines
- Failure thresholds, window sizes, half-open probe limits
- Fallback behavior when open (fail fast, cached, degraded)

**Anti-patterns**

- No CB on chatty unstable dependencies
- CB keyed too coarsely (one tenant trips everyone) or too finely (never opens)
- Half-open allowing unrestricted concurrency

**Evidence**

- CB configuration; keying dimensions; fallback paths; metrics of open state

**Impact questions**

- Does open state protect the dependency and the caller?
- Is recovery controlled or a thundering herd of half-open calls?

---

## 4. Bulkhead and concurrency limits

**Look for**

- Separate thread/connection/worker pools per dependency or workload
- Queue length limits; admission control; load-shed middleware
- Per-tenant or per-route concurrency caps

**Anti-patterns**

- Single shared pool for interactive API and heavy batch jobs
- Unbounded goroutines/promises per request
- No admission control at the edge under overload

**Evidence**

- Pool sizes; executor configs; semaphore usage; gateway limiters

**Impact questions**

- Can one slow dependency stall unrelated traffic?
- What happens at pool exhaustion — fail fast or block forever?

---

## 5. Backpressure

**Look for**

- Bounded queues; reactive streams; HTTP 429/503 with Retry-After
- Producer slowing when consumer lags (kafka pause, TCP windowing awareness)
- Drop vs. block vs. spill-to-disk policies

**Anti-patterns**

- Unbounded in-memory buffers
- Ignoring consumer lag metrics
- Shedding without telling callers

**Evidence**

- Queue bounds; load-shed code; lag metrics hooks

**Impact questions**

- Memory growth under slow consumers?
- Clear signal to upstream to slow down?

---

## 6. Idempotency

**Look for**

- Idempotency keys on write APIs; dedupe stores; transactional outbox consumers
- Handler behavior on redelivery; upsert vs append
- Exactly-once claims vs at-least-once reality

**Anti-patterns**

- Side effects before durable dedupe record
- Keys with too-short TTL relative to max retry window
- Non-idempotent retries of payments, emails, or provisioning

**Evidence**

- Key extraction; storage; uniqueness constraints; consumer commit ordering

**Impact questions**

- Double charge, duplicate emails, or double provisioning under redelivery?

---

## 7. DLQ and poison messages

**Look for**

- Dead-letter queues/topics; max receive counts; poison handlers
- Payload validation before side effects
- Replay tooling and alerting on DLQ depth

**Anti-patterns**

- Infinite reprocessing of bad payloads
- Silent drop with no DLQ
- DLQ with no consumer or alert

**Evidence**

- Redrive policies; validation code; DLQ monitors

**Impact questions**

- Can one bad message block a partition/shard?
- Are poison messages observable?

---

## 8. Cascade failures

**Look for**

- Dependency graphs where hard deps fan into a shared resource
- Shared caches, shared DB, shared thread pools across products
- Error translation that turns dependency failure into amplified local failure

**Anti-patterns**

- Treating soft deps as hard
- Unbounded fan-out on a single request
- Lack of isolation between blast-radius domains identified in recon

**Evidence**

- Architecture coupling; shared client singletons; fan-out loops

**Impact questions**

- Does one dependency outage take down unrelated features?

---

## 9. Thundering herd

**Look for**

- Cache expiry alignment; cron schedules at the same second; leadership election stampedes
- Reconnect storms after broker blips
- Missing jitter on locks, TTLs, and retries

**Anti-patterns**

- Fixed TTL without early refresh or soft expiry
- All instances recreating connections simultaneously

**Evidence**

- TTL/cron values; reconnect logic; lock renewal timing

**Impact questions**

- Spike to origin or coordinator after expiry or outage?

---

## 10. Lease expiry and leadership

**Look for**

- Distributed locks, leader election, partition ownership leases
- Renewal loops; clock assumptions; fencing tokens
- Work continuing after lease loss

**Anti-patterns**

- No fencing token — two leaders mutate state
- Lease TTL shorter than GC pause / STW assumptions without safety
- Long critical sections without renewal

**Evidence**

- Lock library usage; lease TTLs; fence checks on writes

**Impact questions**

- Split-brain writes? Lost updates? Stuck cluster with no leader?

---

## 11. Clock skew

**Look for**

- Token expiry validation; HMAC timestamps; TTL computed from local clock
- `order by now()` logic across nodes; lease decisions based on wall clock
- Assumptions of synchronized clocks without NTP/hybrid logical clocks

**Anti-patterns**

- Tight absolute time windows without skew tolerance
- Comparing timestamps from different sources as total order

**Evidence**

- Time checks in auth, locks, and conflict resolution

**Impact questions**

- Premature expiry or acceptance of expired credentials?
- Incorrect conflict winners under skew?

---

## 12. Partial deploy and rollout

**Look for**

- API version skew between canary and baseline
- Migrating schemas with expandable/contractable steps
- Feature flags that change write paths mid-flight
- Mixed-version consumers on the same queue

**Anti-patterns**

- Breaking RPC field changes without compat window
- Dual-write migrations without read fallback
- One-shot destructive migrations in the critical path

**Evidence**

- Migration files; flag checks; deployment strategies in CI/manifests

**Impact questions**

- Errors only during rollout? Data written by new code unreadable by old?

---

## Cross-cutting severity guidance

Severity requires impact. Examples:

| Situation | Suggested band (verifier decides) |
|-----------|-----------------------------------|
| Unbounded retry into core DB under errors, interactive traffic | critical/high |
| Missing timeout on a rare admin path with manual use | low/medium |
| DLQ exists but alert missing | medium (observability overlap) |
| Jitter missing but low QPS internal tool | low/info |

Always pair class label + boundary + impact hypothesis before suggesting severity.
