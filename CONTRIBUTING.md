# Contributing

Run the self-contained validator tests from the repository root:

```bash
node skills/reliability-audit/validate-*.test.cjs
```

The command should report zero failures. For a specific artifact, run the matching CLI with its JSON path. Keep sample artifacts valid with the same validators and use ISO-8601 timestamps.
