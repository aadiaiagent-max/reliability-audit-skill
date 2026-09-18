# Hunting

Phase 2 of a full reliability audit. Turn coverage-ledger units into isolated hunt tasks, structured candidates, and critic passes that close coverage gaps.

## Goals

1. For each `pending` ledger unit, run an isolated hunter with a tight brief.
2. Emit **candidates** (not findings) with evidence pointers.
3. Use coverage critics to find missed units or shallow coverage.
4. Update ledger statuses to `in_progress` → `covered` or `deferred` with notes.

Hunters **propose**. They do not confirm severity or write `findings.json`.

## Isolation rules

- One hunter task ↔ one ledger `unit.id` (or a small explicitly listed set if tightly coupled).
- Brief includes: unit JSON, relevant `architecture.md` excerpts, allowed paths, and which domain docs apply (`FAILURE-CLASSES.md`, `OBSERVABILITY-AND-SLO.md`, `DATA-AND-CONSISTENCY.md`).
- Hunter returns structured JSON only (see Candidate shape). No free-form "looks fine" without evidence.
- Do not give hunters write access to `findings.json` or validator scripts.
- Do not reuse the same subagent session for verification of its own candidates.

## Candidate shape

Each candidate object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `candidateId` | string | yes | Unique within the run, e.g. `cand-014` |
| `unitId` | string | yes | Ledger unit id |
| `title` | string | yes | Short label |
| `summary` | string | yes | What might go wrong |
| `boundary` | string | yes | e.g. `network`, `process`, `data`, `deploy`, `tenant` |
| `failureClass` | string | no | From FAILURE-CLASSES or `observability` / `consistency` |
| `evidence` | array | yes | Objects with `path`, optional `symbol`, `snippet` (short), `rationale` |
| `impactHypothesis` | string | yes | User- or system-visible impact if true |
| `severityHypothesis` | string | no | When/how often it may trigger |
| `suggestedSeverity` | string | no | Hint only; verifier owns final severity |
| `reproHint` | string | no | Local/static way to reason about it — never live prod steps |

Write candidates to `<output>/candidates/<unitId>.json` as an array, or a single `candidates.jsonl` stream. Parent aggregates.

## Hunt procedure per unit

1. Parent sets unit `status` to `in_progress`.
2. Hunter reads only allowed paths (+ architecture excerpt).
3. Hunter searches for the unit's concern using domain checklists.
4. Hunter emits zero or more candidates. Zero is allowed if explicitly justified with evidence of safe patterns (timeouts set, idempotency keys required, etc.).
5. Parent stores candidates and marks unit `covered` when the hunt and at least one critic acknowledgment exist, or `deferred` with rationale (e.g. generated code out of scope).

### Depth expectations

| Priority | Expectation |
|----------|-------------|
| `p0` | Trace at least one critical path end-to-end for the concern |
| `p1` | Inspect primary modules in `scope.paths` |
| `p2` | Spot-check + note residual risk |

## Coverage critics

After a batch of units (or when hunters claim "nothing found" on `p0` units), spawn a **coverage critic** task:

**Critic brief:**

- Full ledger snapshot
- List of units marked `covered` with empty candidate files
- Architecture critical paths

**Critic outputs:**

- `missedConcerns[]` — proposed new units or reopened units with justification
- `shallowCoverage[]` — units that need a second hunter pass
- `accept[]` — unit ids whose empty results look credible

Parent merges critic output: add units, reopen shallow ones, or accept. Do not let critics invent severity; they only challenge coverage.

## Domain routing

| Ledger category | Primary doc |
|-----------------|-------------|
| `failure-class` | FAILURE-CLASSES.md |
| `observability` | OBSERVABILITY-AND-SLO.md |
| `data-consistency` | DATA-AND-CONSISTENCY.md |
| `boundary` / `dependency` | FAILURE-CLASSES.md + architecture boundaries |
| `other` | Parent specifies docs in the brief |

## Structured hunter prompt template

```text
You are a reliability hunter. Unit id: {{unitId}}.
Allowed paths: {{paths}}.
Read FAILURE-CLASSES / OBSERVABILITY / DATA docs as cited.
Return JSON array of candidates per the candidate shape.
Do not modify files. Do not probe network endpoints.
If no issues, return [] and a short evidence note explaining safe patterns found.
```

## Updating the ledger

Allowed status transitions:

- `pending` → `in_progress` → `covered`
- `pending` → `deferred` (with `notes`)
- `covered` → `in_progress` (critic reopen)
- `deferred` → `pending` (scope change)

Always retain `evidencePaths` when marking `covered`.

Re-validate:

```bash
node <skill>/validate-coverage-ledger.cjs <output>/coverage-ledger.json
```

## Aggregation for Phase 3

Parent builds `candidates-index.json`:

```json
{
  "version": "1.0",
  "candidates": [
    { "candidateId": "cand-001", "unitId": "...", "path": "candidates/...." }
  ]
}
```

Hand this index to validation. Do not promote candidates to findings here.

## Anti-patterns

- Hunting the whole repo in one undifferentiated task
- Writing final severity into `findings.json` from a hunter
- Ignoring critic `shallowCoverage` on p0 units
- Marking `covered` without reading the scoped paths
- Candidates without `evidence` paths
- Live traffic tests or shared-environment fault injection
