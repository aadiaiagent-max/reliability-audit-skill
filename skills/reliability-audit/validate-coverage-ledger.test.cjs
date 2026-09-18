#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateCoverageLedger } = require('./validate-coverage-ledger.cjs');

const cli = path.join(__dirname, 'validate-coverage-ledger.cjs');
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
    units: [
      {
        id: 'api-timeouts',
        title: 'API timeout propagation',
        category: 'failure-class',
        scope: {
          paths: ['src/api/', 'src/clients/'],
          symbols: ['CheckoutHandler'],
          description: 'Deadlines from edge to dependencies'
        },
        status: 'pending',
        priority: 'p0'
      },
      {
        id: 'cache-invalidation',
        title: 'Cache invalidation paths',
        category: 'data-consistency',
        scope: {
          paths: ['src/cache/'],
          description: 'TTL and explicit invalidate on profile writes'
        },
        status: 'deferred',
        notes: 'Cache layer not present in this slice',
        priority: 'p2'
      }
    ]
  };
}

function writeTemp(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ral-'));
  const file = path.join(dir, 'coverage-ledger.json');
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  return file;
}

console.log('validate-coverage-ledger tests');

assert(validateCoverageLedger(validDoc()).length === 0, 'valid ledger has no errors');

const emptyUnits = validDoc();
emptyUnits.units = [];
assert(
  validateCoverageLedger(emptyUnits).some((e) => e.includes('at least one')),
  'empty units array fails'
);

const badCategory = validDoc();
badCategory.units[0].category = 'security';
assert(
  validateCoverageLedger(badCategory).some((e) => e.includes('category')),
  'invalid category fails'
);

const emptyScope = validDoc();
emptyScope.units[0].scope.paths = [];
delete emptyScope.units[0].scope.symbols;
assert(
  validateCoverageLedger(emptyScope).some((e) => e.includes('both be empty')),
  'empty paths and symbols fails'
);

const deferredNoNotes = validDoc();
deferredNoNotes.units[1].notes = '';
assert(
  validateCoverageLedger(deferredNoNotes).some((e) => e.includes('notes')),
  'deferred without notes fails'
);

const dup = validDoc();
dup.units[1].id = 'api-timeouts';
assert(
  validateCoverageLedger(dup).some((e) => e.includes('duplicate')),
  'duplicate unit ids fail'
);

const okFile = writeTemp(validDoc());
const okRun = spawnSync(process.execPath, [cli, okFile], { encoding: 'utf8' });
assert(okRun.status === 0, 'CLI exits 0 on valid file');

const badFile = writeTemp(emptyUnits);
const badRun = spawnSync(process.execPath, [cli, badFile], { encoding: 'utf8' });
assert(badRun.status === 1, 'CLI exits 1 on invalid file');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
