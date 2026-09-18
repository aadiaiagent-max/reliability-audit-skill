# Observability and SLO

Domain checklist for ledger units in category `observability`. Hunters use this to find gaps in metrics, traces, logs, alerts, and service-level objectives. Verifiers require in-repo evidence — do not invent live dashboards you cannot read from the target tree or user-provided exports.

## Goals

- Determine whether operators can **detect**, **diagnose**, and **decide** under failure.
- Tie observability gaps to reliability impact (blind outages, slow incident response, false confidence).
- Avoid "needs more metrics" fluff without a concrete missing signal on a critical path.

## What to inventory

### Metrics

Look for:

- Metric libraries and exporters (Prometheus, OTel Meter, StatsD, Cloudwatch APIs, custom)
- RED/USE-style signals on edges: rate, errors, duration; saturation on pools and queues
- Dependency-scoped metrics (per client, per outbound host)
- Queue depth, consumer lag, retry counts, CB state, bulkhead rejections
- Cardinality hazards (unbounded labels: user id, URL path raw)

**Gap patterns**

- Critical path with latency histogram missing
- Error rate not broken out by cause/dependency
- Saturation metrics absent for connection pools
- High-cardinality labels that may force metric drop under load

### Traces

Look for:

- Trace/context propagation middleware
- Span creation around outbound calls and consumer handlers
- Sampling config; baggage/sensitive data policies
- Correlation between trace ids and logs

**Gap patterns**

- Broken propagation across async boundaries (queue publish/consume)
- Only framework auto-instrumentation — no spans on custom critical logic
- 100% sampling in prod configs checked into repo without mention of backend limits (note as risk if evidenced)

### Logs

Look for:

- Structured logging fields (request id, tenant, unit of work id)
- Log levels around retries, CB open, load shed, DLQ writes
- PII/secret redaction helpers

**Gap patterns**

- Retries with no log/metric
- Errors logged without correlation ids
- Extremely verbose hot-path debug left enabled in default config

### Alerts

Look for:

- Alert rules as code (PrometheusRule, Terraform, JSON/YAML in ops folders)
- Runbooks linked from alerts
- SLOs/SLIs referenced by burn-rate alerts

**Gap patterns**

- Metrics exist but no alert on customer-facing error rate or lag
- Alerts on raw CPU only — nothing on queue lag or dependency errors
- Alert without severity or ownership labels

### SLOs and objectives

Look for:

- SLO markdown, terraform, or monitoring-as-code objectives
- Explicit SLIs (availability, latency percentile, correctness)
- Error budgets and burn-rate policies

**Gap patterns**

- Marketing "four nines" in README with no SLI definition in-repo
- Latency SLO without excluding known deferred paths (or vice versa)
- No correctness/freshness SLO for async pipelines that users treat as real-time

## Candidate construction

For observability candidates:

- `failureClass`: prefer `observability` or a paired failure class (e.g. DLQ without alert → note both)
- `boundary`: usually `process` or `deploy` (ops visibility), sometimes `data` for lag
- `impactHypothesis`: what failure becomes invisible or slow to diagnose
- `evidence`: paths to missing hooks (handler with no metrics) or alert files that omit a signal

Example impact hypotheses:

- "Payments client timeouts will not page — only generic 5xx at edge."
- "Consumer lag can grow past 15 minutes with no alert; users see stale balances."

## Verification notes

Verifiers should:

- Confirm the critical path exists and the signal is truly absent (or mis-scoped)
- Reject candidates that demand tooling not used by the project without impact
- Downgrade pure nice-to-haves (`info`/`low`) when detection already exists via a parent signal

## Suggested ledger units

- `edge-red-metrics` — rate/error/duration on public handlers
- `dependency-client-metrics` — per-dependency latency and errors
- `async-lag-alerts` — queue/stream lag alerts and runbooks
- `trace-propagation-async` — trace context across messaging
- `slo-definitions` — SLI/SLO as code or docs vs critical paths
- `cardinality-risk` — unbounded metric labels

## Anti-patterns

- Filing findings for every missing histogram bucket
- Claiming SLO violations from production without data (this skill does not scrape live systems)
- Alert fatigue recommendations without naming noisy or missing alerts evidenced in-repo
- Requiring a specific vendor when the repo already has an equivalent signal
