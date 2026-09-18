---
name: reliability-audit
description: Reliability and resilience review for services, APIs, workers, and libraries. Use for reliability questions, failure-mode analysis, resilience reviews, or full reliability audits. Run the complete workflow only for explicit full/comprehensive reliability audit requests or requested report artifacts.
---

# reliability-audit

Multi-phase reliability and resilience review skill. Produces independently verified, machine-readable findings and target-neutral reports. Operates on source and local sandbox checks only.

## Guidance vs full-audit modes

**Guidance mode** (default for narrow questions):

- Answer reliability or resilience questions using this skill's domain docs.
- Cite failure classes, observability gaps, or consistency patterns as needed.
- Do **not** create an audit output directory or run the six-phase workflow.

**Full-audit mode** (explicit only):

- Trigger when the user asks for a full/comprehensive reliability audit, a resilience review of a codebase with report output, or named report artifacts (`findings.json`, `REPORT.md`, coverage ledger).
- Run the complete six-phase workflow below.
- Persist all artifacts under the configured output directory.

If intent is ambiguous, prefer guidance mode and ask whether a full audit with artifacts is desired—unless the user already named output paths or "full audit".

## Parent / task / subagent terminology

| Role | Responsibility |
|------|----------------|
| **Parent** | Owns setup, phase sequencing, isolation summary, final report assembly, and validator CLI runs |
| **Task** | A bounded unit of work (one ledger unit, one candidate verification, one critic pass) |
| **Subagent** (hunter / verifier / critic) | Isolated worker that receives only the task brief and allowed paths; returns structured results to the parent |

Hunters **propose** candidates. Verifiers **confirm, reject, or mark needs_validation**. Critics **challenge coverage**, not severity. The parent never treats a hunter claim as a finding until a fresh verifier pass completes.

## Execution safety

1. **Read-only source** — inspect the target tree; do not modify application source as part of the audit.
2. **No live / shared-env probing** — do not call production endpoints, shared staging clusters, customer tenants, or real message buses. No load tests against shared infrastructure.
3. **Sandbox for local checks** — timeouts, retry math, and config parsing may run in a local sandbox or ephemeral process using fixtures derived from the repo. Prefer static analysis when sandboxing is unavailable.
4. **Secrets** — never copy credentials, tokens, or private keys into findings or reports. Reference secret *handling patterns* by path and symbol only.
5. **Network** — outbound network from audit workers is disallowed except for fetching public docs the user explicitly requested.

## Full audit setup

1. Locate this skill directory (the folder containing `SKILL.md`).
2. Resolve the **target** path (repo root or subdirectory the user named).
3. Choose an **output directory**:
   - Default: `~/reliability-audit-skill/<repo-name>/run-<n>`
   - `<n>` is the next unused positive integer under that repo folder
   - Honor an explicit user path when provided
4. Create the output directory and write `isolation-summary.md` before hunting:

```markdown
# Isolation summary
- target: <absolute path>
- skill: <skill dir>
- output: <output dir>
- mode: full-audit
- constraints: read-only source; no live/shared probing; sandboxed local checks only
- started: <ISO-8601 timestamp>
```

5. Subsequent phases write only under `output/` (plus validator temp fixtures if needed).

## Six-phase workflow

Execute in order. Do not skip recon or validation when in full-audit mode.

### Phase 1 — Reconnaissance

Follow [RECONNAISSANCE.md](RECONNAISSANCE.md).

- Produce `architecture.md` (components, boundaries, dependencies, failure domains).
- Produce `coverage-ledger.json` (audit units with ids, scopes, and status).
- Validate the ledger with `validate-coverage-ledger.cjs` before hunting.

### Phase 2 — Coverage-led hunting

Follow [HUNTING.md](HUNTING.md) and domain companions:

- [FAILURE-CLASSES.md](FAILURE-CLASSES.md)
- [OBSERVABILITY-AND-SLO.md](OBSERVABILITY-AND-SLO.md)
- [DATA-AND-CONSISTENCY.md](DATA-AND-CONSISTENCY.md)

Spawn isolated hunters from ledger units. Collect structured candidates. Run coverage critics until ledger gaps are closed or explicitly deferred with rationale.

### Phase 3 — Candidate validation

Follow [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md).

- Assign **fresh** verifier tasks (not the same subagent that hunted).
- Each candidate → `confirmed` | `needs_validation` | `rejected` with evidence paths and notes.

### Phase 4 — Structured output

- Write `findings.json` conforming to [report-schema.json](report-schema.json).
- Include only validated records; rejected candidates go to `rejected-candidates.json` (optional but recommended).

### Phase 5 — Independent record verification

- Run `node validate-findings.cjs <output>/findings.json`
- Re-run `node validate-coverage-ledger.cjs <output>/coverage-ledger.json`
- Fix schema issues before reporting. Exit code must be 0 for both.

### Phase 6 — Target-neutral reporting

- Write `REPORT.md` summarizing confirmed findings by severity and boundary.
- Optionally write `EXECUTIVE-SUMMARY.md` (short) and `REMEDIATION-TRACKER.md` (actionable follow-ups).
- Reports must not instruct live probing; remediation advice stays design- and code-level.

## Core principles

1. **Boundary + impact** — every confirmed finding names a boundary (process, network, data, deploy, tenant) and a concrete impact path (user-visible failure, data loss, amplified outage).
2. **Adversarial validation** — proposal and confirmation are separated; severity is not self-assigned by hunters without verifier agreement.
3. **Severity needs impact** — `critical` / `high` / `medium` / `low` / `info` require stated impact and supporting evidence; drop or downgrade when impact is speculative.
4. **Additive runs** — new runs use `run-<n+1>` (or a user path). Do not erase prior run artifacts. Cross-link related runs in the isolation summary when continuing work.
5. **Coverage before depth** — prefer closing ledger units over endlessly deepening a single hot path.
6. **Machine-readable first** — humans read `REPORT.md`; tools and CI consume `findings.json` and the ledger.

## Anti-patterns

- Treating linter noise or style nits as reliability findings
- Inflating severity without a failure or impact narrative
- Probing production, shared staging, or real customer traffic
- Letting the same worker hunt and verify the same candidate
- Skipping the coverage ledger or marking units `done` without evidence
- Copying secrets or PII into artifacts
- Claiming SLO compliance without metrics or objectives found in-repo
- Rewriting prior `confirmed` findings in place without a new run directory

## Validator quick reference

```bash
node skills/reliability-audit/validate-coverage-ledger.cjs path/to/coverage-ledger.json
node skills/reliability-audit/validate-findings.cjs path/to/findings.json
node skills/reliability-audit/validate-findings.test.cjs
node skills/reliability-audit/validate-coverage-ledger.test.cjs
```

Both CLIs exit `0` on success and `1` on validation failure. Tests are zero-dependency and self-contained.
