#!/usr/bin/env node
'use strict';

/**
 * Zero-dependency validator for reliability-audit coverage-ledger.json
 * Usage: node validate-coverage-ledger.cjs <path-to-coverage-ledger.json>
 * Exit 0 on success, 1 on failure.
 */

const fs = require('fs');
const path = require('path');

const CATEGORIES = new Set([
  'failure-class',
  'observability',
  'data-consistency',
  'boundary',
  'dependency',
  'other'
]);
const STATUSES = new Set(['pending', 'in_progress', 'covered', 'deferred']);
const PRIORITIES = new Set(['p0', 'p1', 'p2']);

function fail(errors, msg) {
  errors.push(msg);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateScope(scope, prefix, errors) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    fail(errors, `${prefix}.scope: must be an object`);
    return;
  }
  if (!isNonEmptyString(scope.description)) {
    fail(errors, `${prefix}.scope.description: required non-empty string`);
  }
  if (!Array.isArray(scope.paths)) {
    fail(errors, `${prefix}.scope.paths: required array`);
  } else if (scope.paths.some((p) => typeof p !== 'string')) {
    fail(errors, `${prefix}.scope.paths: all entries must be strings`);
  }
  if (scope.symbols !== undefined) {
    if (!Array.isArray(scope.symbols) || scope.symbols.some((s) => typeof s !== 'string')) {
      fail(errors, `${prefix}.scope.symbols: must be an array of strings`);
    }
  }
  const pathsEmpty = Array.isArray(scope.paths) && scope.paths.length === 0;
  const symbolsEmpty =
    scope.symbols === undefined ||
    (Array.isArray(scope.symbols) && scope.symbols.length === 0);
  if (pathsEmpty && symbolsEmpty) {
    fail(errors, `${prefix}.scope: paths and symbols cannot both be empty`);
  }
  const allowed = new Set(['paths', 'symbols', 'description']);
  for (const k of Object.keys(scope)) {
    if (!allowed.has(k)) fail(errors, `${prefix}.scope: unexpected property "${k}"`);
  }
}

function validateUnit(unit, index, errors, seenIds) {
  const prefix = `units[${index}]`;
  if (!unit || typeof unit !== 'object' || Array.isArray(unit)) {
    fail(errors, `${prefix}: must be an object`);
    return;
  }
  for (const key of ['id', 'title', 'category', 'scope', 'status']) {
    if (unit[key] === undefined) fail(errors, `${prefix}.${key}: required`);
  }
  if (unit.id !== undefined) {
    if (!isNonEmptyString(unit.id)) fail(errors, `${prefix}.id: non-empty string required`);
    else if (seenIds.has(unit.id)) fail(errors, `${prefix}.id: duplicate id "${unit.id}"`);
    else seenIds.add(unit.id);
  }
  if (unit.title !== undefined && !isNonEmptyString(unit.title)) {
    fail(errors, `${prefix}.title: non-empty string required`);
  }
  if (unit.category !== undefined && !CATEGORIES.has(unit.category)) {
    fail(errors, `${prefix}.category: invalid category`);
  }
  if (unit.status !== undefined && !STATUSES.has(unit.status)) {
    fail(errors, `${prefix}.status: invalid status`);
  }
  if (unit.priority !== undefined && !PRIORITIES.has(unit.priority)) {
    fail(errors, `${prefix}.priority: must be p0|p1|p2`);
  }
  if (unit.notes !== undefined && typeof unit.notes !== 'string') {
    fail(errors, `${prefix}.notes: must be a string`);
  }
  if (unit.status === 'deferred' && !isNonEmptyString(unit.notes)) {
    fail(errors, `${prefix}.notes: required non-empty string when status is deferred`);
  }
  if (unit.evidencePaths !== undefined) {
    if (
      !Array.isArray(unit.evidencePaths) ||
      unit.evidencePaths.some((p) => typeof p !== 'string')
    ) {
      fail(errors, `${prefix}.evidencePaths: must be an array of strings`);
    }
  }
  if (unit.scope !== undefined) validateScope(unit.scope, prefix, errors);

  const allowed = new Set([
    'id',
    'title',
    'category',
    'scope',
    'status',
    'priority',
    'notes',
    'evidencePaths'
  ]);
  for (const k of Object.keys(unit)) {
    if (!allowed.has(k)) fail(errors, `${prefix}: unexpected property "${k}"`);
  }
}

function validateCoverageLedger(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return ['root: must be an object'];
  }
  if (doc.version !== '1.0') fail(errors, 'version: must be "1.0"');
  if (!isNonEmptyString(doc.target)) fail(errors, 'target: required non-empty string');
  if (!isNonEmptyString(doc.createdAt)) fail(errors, 'createdAt: required non-empty string');
  if (!Array.isArray(doc.units)) {
    fail(errors, 'units: required array');
  } else if (doc.units.length < 1) {
    fail(errors, 'units: must contain at least one unit');
  } else {
    const seenIds = new Set();
    doc.units.forEach((u, i) => validateUnit(u, i, errors, seenIds));
  }
  const allowedRoot = new Set(['version', 'target', 'createdAt', 'units']);
  for (const k of Object.keys(doc)) {
    if (!allowedRoot.has(k)) fail(errors, `root: unexpected property "${k}"`);
  }
  return errors;
}

function main(argv) {
  const filePath = argv[2];
  if (!filePath) {
    console.error('Usage: node validate-coverage-ledger.cjs <path-to-coverage-ledger.json>');
    process.exit(1);
  }
  const abs = path.resolve(filePath);
  let raw;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (err) {
    console.error(`Cannot read file: ${abs}\n${err.message}`);
    process.exit(1);
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON: ${err.message}`);
    process.exit(1);
  }
  const errors = validateCoverageLedger(doc);
  if (errors.length) {
    console.error(`Validation failed (${errors.length} error(s)):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log(`OK: ${abs} (${doc.units.length} unit(s))`);
  process.exit(0);
}

if (require.main === module) {
  main(process.argv);
}

module.exports = { validateCoverageLedger };
