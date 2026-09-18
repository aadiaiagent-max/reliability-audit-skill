#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateFindingsDocument } = require('./validate-findings.cjs');

const cli = path.join(__dirname, 'validate-findings.cjs');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${msg}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${msg}`);
  }
}

function validDoc() {
  return {
    version: '1.0',
    target: '/tmp/example-service',
    createdAt: '2026-09-18T12:00:00-04:00',
    runId: 'run-1',
    findings: [
      {
        id: 'finding-001',
        candidateId: 'cand-001',
        unitId: 'api-timeouts',
        status: 'confirmed',
        severity: 'high',
        title: 'Payments client missing timeout',
        summary: 'Outbound payments SDK uses default infinite wait.',
        boundary: 'network',
        failureClass: 'timeout',
        impact: 'Worker threads block on payments outage until pool exhaustion.',
        evidence: [{ path: 'src/clients/payments.ts', symbol: 'PaymentsClient', note: 'no timeout option' }],
        remediation: 'Set explicit timeout and propagate parent deadline.',
        tags: ['timeout', 'dependency']
      },
      {
        id: 'finding-002',
        candidateId: 'cand-002',
        unitId: 'slo-definitions',
        status: 'needs_validation',
        severity: 'medium',
        title: 'Latency SLO mentioned without SLI wiring',
        summary: 'README cites 99.9% but no SLI config found.',
        boundary: 'process',
        evidence: [{ path: 'README.md', note: 'objective claimed' }]
      }
    ]
  };
}

function writeTemp(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raf-'));
  const file = path.join(dir, 'findings.json');
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  return file;
}

console.log('validate-findings tests');

assert(validateFindingsDocument(validDoc()).length === 0, 'valid document has no errors');

const missingImpact = validDoc();
missingImpact.findings[0].impact = '';
assert(
  validateFindingsDocument(missingImpact).some((e) => e.includes('impact')),
  'confirmed without impact fails'
);

const badSeverity = validDoc();
badSeverity.findings[0].severity = 'urgent';
assert(
  validateFindingsDocument(badSeverity).some((e) => e.includes('severity')),
  'invalid severity fails'
);

const dup = validDoc();
dup.findings[1].id = 'finding-001';
assert(
  validateFindingsDocument(dup).some((e) => e.includes('duplicate')),
  'duplicate ids fail'
);

const badStatus = validDoc();
badStatus.findings[0].status = 'rejected';
assert(
  validateFindingsDocument(badStatus).some((e) => e.includes('status')),
  'rejected status not allowed in findings.json'
);

const noEvidence = validDoc();
noEvidence.findings[0].evidence = [];
assert(
  validateFindingsDocument(noEvidence).some((e) => e.includes('evidence')),
  'empty evidence fails'
);

const okFile = writeTemp(validDoc());
const okRun = spawnSync(process.execPath, [cli, okFile], { encoding: 'utf8' });
assert(okRun.status === 0, 'CLI exits 0 on valid file');

const badFile = writeTemp(missingImpact);
const badRun = spawnSync(process.execPath, [cli, badFile], { encoding: 'utf8' });
assert(badRun.status === 1, 'CLI exits 1 on invalid file');

const missingRun = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
assert(missingRun.status === 1, 'CLI exits 1 when path missing');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
