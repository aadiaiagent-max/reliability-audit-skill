# Validation and reporting

Phases 3–6: independently verify candidates, emit machine-readable findings, re-validate artifacts, and write target-neutral reports.

## Phase 3 — Candidate validation

### Fresh verifiers

- For each candidate (or small batch), assign a **verifier** subagent that did **not** produce that candidate.
- Verifier receives: candidate JSON, allowed evidence paths, architecture excerpt, and this doc's decision rules.
- Verifier may re-read source under allowed paths. No live probing.

### Decision rules

| Status | When to use |
|--------|-------------|
| `confirmed` | Evidence supports the issue; impact path is credible; not already mitigated in-repo |
| `needs_validation` | Plausible but blocked on missing context (build flag, generated code, external config not in repo) |
| `rejected` | Evidence refutes the claim, mitigation exists, duplicate, or impact is negligible/speculative |

### Verifier output fields

Align with `report-schema.json` finding objects when confirming. For each candidate produce:

- `candidateId`
- `status`: `confirmed` | `needs_validation` | `rejected`
- `severity` (required if confirmed): `critical` | `high` | `medium` | `low` | `info`
- `title`, `summary`, `boundary`, `failureClass`
- `impact` — concrete impact narrative (required for confirmed)
- `evidence[]` — paths/symbols/notes the verifier checked
- `remediation` — design/code-level guidance (no live exploit steps)
- `rejectionReason` — required when rejected

### Severity rubric (impact-first)

1. Start from impact (data loss, incorrect money/authz, widespread outage amplification, long undetected staleness).
2. Adjust for likelihood only when evidenced (always-on path vs rare admin).
3. If impact is unclear → `needs_validation` or reject, do not guess `critical`.

### Deduplication

- Merge duplicates that share the same root cause and remediation.
- Keep cross-references to related `candidateId`s in notes.

## Phase 4 — Structured output

Write `<output>/findings.json` matching [report-schema.json](report-schema.json).

Top-level:

- `version`: `"1.0"`
- `target`, `createdAt`, `runId` (optional)
- `findings`: array of finding objects

Each finding:

- `id` — stable string e.g. `finding-001`
- `candidateId` — source candidate
- `unitId` — ledger unit
- `status` — `confirmed` | `needs_validation` (rejected entries should not appear here; use `rejected-candidates.json`)
- `severity`, `title`, `summary`, `boundary`
- `failureClass` (optional string)
- `impact` (required for `confirmed`)
- `evidence` — non-empty array of `{ "path": "...", "symbol"?: "...", "note"?: "..." }`
- `remediation` (optional string)
- `tags` (optional string array)

Also recommended:

- `rejected-candidates.json` — array of rejected verifier records
- `needs-validation.json` — optional extract for follow-up

## Phase 5 — Independent record verification

From the skill directory or with absolute paths:

```bash
node validate-findings.cjs <output>/findings.json
node validate-coverage-ledger.cjs <output>/coverage-ledger.json
```

Both must exit 0. If not, fix artifacts (do not hand-wave schema errors).

Parent should spot-check that every `confirmed` finding's `evidence.path` exists under the target (or is an intentional repo-relative path noted in architecture).

## Phase 6 — Target-neutral reporting

### REPORT.md (required for full audits)

Suggested outline:

```markdown
# Reliability audit report — <target>

## Scope
- target, run id, date, constraints (read-only, no live probing)

## Coverage summary
- ledger unit counts by status
- critic outcomes

## Findings by severity
### Critical
...
### High
...

## Needs validation
...

## Deferred / out of scope
...

## Method
- six-phase skill reference; validators run (pass/fail)
```

### EXECUTIVE-SUMMARY.md (optional)

One page: top risks, coverage confidence, recommended next steps.

### REMEDIATION-TRACKER.md (optional)

Table: finding id, severity, owner placeholder, remediation summary, status `open`.

### Neutrality rules

- Do not name live hostnames that invite probing.
- Do not include secrets.
- Remediation is code/design/process — not "hit this prod endpoint to verify".
- Speak to the system, not to hiring roles or job levels.

## Additive runs

- New audit → new `run-<n>` directory.
- To continue prior work, copy forward the ledger with notes linking `priorRun`, or reference prior findings by id without mutating old files.

## Parent checklist before declaring done

- [ ] `isolation-summary.md` present
- [ ] `architecture.md` present
- [ ] `coverage-ledger.json` validates
- [ ] candidates archived
- [ ] `findings.json` validates
- [ ] `REPORT.md` written
- [ ] No live probing performed
- [ ] No Cloudflare or third-party skill prose pasted into artifacts
