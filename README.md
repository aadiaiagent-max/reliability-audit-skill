# reliability-audit

Coding-agent skill for multi-phase reliability audits with independently verified, machine-readable findings.

## What it does

Runs a structured reliability and resilience review across six phases:

1. **Reconnaissance** — map architecture, boundaries, and blast radius into `architecture.md` and a coverage ledger of audit units
2. **Coverage-led hunting** — spawn isolated hunters from the ledger; emit structured candidates; run coverage critics for gaps
3. **Candidate validation** — independently re-check each candidate against source evidence (fresh verifiers)
4. **Structured output** — write `findings.json` with statuses `confirmed`, `needs_validation`, or `rejected`
5. **Independent record verification** — re-validate machine-readable artifacts with schema and ledger validators
6. **Target-neutral reporting** — produce human-readable reports without probing live or shared production systems

The skill stays read-only against the target tree, uses sandboxed local checks only, and never performs live production probing.

## Files

| Path | Purpose |
|------|---------|
| `skills/reliability-audit/SKILL.md` | Entry point: modes, safety, workflow, principles |
| `skills/reliability-audit/RECONNAISSANCE.md` | Architecture map and coverage-ledger construction |
| `skills/reliability-audit/HUNTING.md` | Isolated hunters, candidates, coverage critics |
| `skills/reliability-audit/FAILURE-CLASSES.md` | Timeout, retry, CB, bulkhead, cascade, and related classes |
| `skills/reliability-audit/OBSERVABILITY-AND-SLO.md` | Metrics, traces, logs, alerts, SLO gap analysis |
| `skills/reliability-audit/DATA-AND-CONSISTENCY.md` | Dual-write, cache, outbox, multi-region consistency |
| `skills/reliability-audit/VALIDATION-AND-REPORTING.md` | Verification, findings schema, report artifacts |
| `skills/reliability-audit/report-schema.json` | JSON Schema for `findings.json` |
| `skills/reliability-audit/validate-findings.cjs` | CLI validator for findings |
| `skills/reliability-audit/validate-coverage-ledger.cjs` | CLI validator for coverage ledger |
| `skills/reliability-audit/*.test.cjs` | Self-contained Node tests for validators |
| `examples/sample-findings.json` | Valid sample findings artifact |
| `examples/sample-coverage-ledger.json` | Valid sample coverage ledger |

## Examples

The [`examples/`](examples/) directory contains validator-passing sample findings and coverage-ledger artifacts to use as starting points for local runs.

## Install

```bash
npx skills add https://github.com/aadiaiagent-max/reliability-audit-skill \
  --skill reliability-audit
```

Global install:

```bash
npx skills add https://github.com/aadiaiagent-max/reliability-audit-skill \
  --skill reliability-audit \
  --global
```

## Usage examples

Ask a coding agent that has this skill loaded:

- `reliability audit this codebase`
- `find resilience gaps in ./src`
- `do a reliability review, output to ~/audits/my-project`

Guidance-only questions (failure-mode explanations, resilience tips) use the skill docs without running the full six-phase workflow. Full or comprehensive audit requests, or explicit report artifact requests, trigger the complete workflow.

## Requirements

- Coding agent with tool use and sub-agent (or task) support
- Node.js to run the zero-dependency validators
- Sandboxed local checks only — no live production or shared-environment probing

## Design principles

- **Boundary + impact** — every finding must name a trust or failure boundary and a concrete impact path
- **Adversarial validation** — hunters propose; independent verifiers confirm or reject
- **Severity needs impact** — severity is derived from impact and likelihood evidence, not gut feel
- **Additive runs** — re-runs append or version output directories; they do not silently overwrite prior confirmed findings without a ledger trail

## License

MIT — Copyright (c) 2026 Aaditya Shah
