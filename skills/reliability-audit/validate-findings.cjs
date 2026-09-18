#!/usr/bin/env node
'use strict';

/**
 * Zero-dependency validator for reliability-audit findings.json
 * Usage: node validate-findings.cjs <path-to-findings.json>
 * Exit 0 on success, 1 on failure.
 */

const fs = require('fs');
const path = require('path');

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const STATUSES = new Set(['confirmed', 'needs_validation']);

function fail(errors, msg) {
  errors.push(msg);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateEvidence(evidence, prefix, errors) {
  if (!Array.isArray(evidence) || evidence.length < 1) {
    fail(errors, `${prefix}: evidence must be a non-empty array`);
    return;
  }
  evidence.forEach((ev, i) => {
    const p = `${prefix}.evidence[${i}]`;
    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) {
      fail(errors, `${p}: must be an object`);
      return;
    }
    if (!isNonEmptyString(ev.path)) fail(errors, `${p}.path: required non-empty string`);
    for (const k of Object.keys(ev)) {
      if (!['path', 'symbol', 'note'].includes(k)) {
        fail(errors, `${p}: unexpected property "${k}"`);
      }
    }
    if (ev.symbol !== undefined && typeof ev.symbol !== 'string') {
      fail(errors, `${p}.symbol: must be a string`);
    }
    if (ev.note !== undefined && typeof ev.note !== 'string') {
      fail(errors, `${p}.note: must be a string`);
    }
  });
}

function validateFinding(f, index, errors, seenIds) {
  const prefix = `findings[${index}]`;
  if (!f || typeof f !== 'object' || Array.isArray(f)) {
    fail(errors, `${prefix}: must be an object`);
    return;
  }

  const required = [
    'id',
    'candidateId',
    'unitId',
    'status',
    'severity',
    'title',
    'summary',
    'boundary',
    'evidence'
  ];
  for (const key of required) {
    if (f[key] === undefined) fail(errors, `${prefix}.${key}: required`);
  }

  if (f.id !== undefined) {
    if (!isNonEmptyString(f.id)) fail(errors, `${prefix}.id: non-empty string required`);
    else if (seenIds.has(f.id)) fail(errors, `${prefix}.id: duplicate id "${f.id}"`);
    else seenIds.add(f.id);
  }

  for (const key of ['candidateId', 'unitId', 'title', 'summary', 'boundary']) {
    if (f[key] !== undefined && !isNonEmptyString(f[key])) {
      fail(errors, `${prefix}.${key}: non-empty string required`);
    }
  }

  if (f.status !== undefined && !STATUSES.has(f.status)) {
    fail(errors, `${prefix}.status: must be confirmed|needs_validation`);
  }
  if (f.severity !== undefined && !SEVERITIES.has(f.severity)) {
    fail(errors, `${prefix}.severity: invalid severity`);
  }

  if (f.status === 'confirmed') {
    if (!isNonEmptyString(f.impact)) {
      fail(errors, `${prefix}.impact: required non-empty string when status is confirmed`);
    }
  } else if (f.impact !== undefined && typeof f.impact !== 'string') {
    fail(errors, `${prefix}.impact: must be a string`);
  }

  if (f.evidence !== undefined) validateEvidence(f.evidence, prefix, errors);

  if (f.failureClass !== undefined && typeof f.failureClass !== 'string') {
    fail(errors, `${prefix}.failureClass: must be a string`);
  }
  if (f.remediation !== undefined && typeof f.remediation !== 'string') {
    fail(errors, `${prefix}.remediation: must be a string`);
  }
  if (f.tags !== undefined) {
    if (!Array.isArray(f.tags) || f.tags.some((t) => typeof t !== 'string')) {
      fail(errors, `${prefix}.tags: must be an array of strings`);
    }
  }

  const allowed = new Set([
    'id',
    'candidateId',
    'unitId',
    'status',
    'severity',
    'title',
    'summary',
    'boundary',
    'failureClass',
    'impact',
    'evidence',
    'remediation',
    'tags'
  ]);
  for (const k of Object.keys(f)) {
    if (!allowed.has(k)) fail(errors, `${prefix}: unexpected property "${k}"`);
  }
}

function validateFindingsDocument(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return ['root: must be an object'];
  }

  if (doc.version !== '1.0') fail(errors, 'version: must be "1.0"');
  if (!isNonEmptyString(doc.target)) fail(errors, 'target: required non-empty string');
  if (!isNonEmptyString(doc.createdAt)) fail(errors, 'createdAt: required non-empty string');
  if (doc.runId !== undefined && typeof doc.runId !== 'string') {
    fail(errors, 'runId: must be a string');
  }
  if (!Array.isArray(doc.findings)) {
    fail(errors, 'findings: required array');
  } else {
    const seenIds = new Set();
    doc.findings.forEach((f, i) => validateFinding(f, i, errors, seenIds));
  }

  const allowedRoot = new Set(['version', 'target', 'createdAt', 'runId', 'findings']);
  for (const k of Object.keys(doc)) {
    if (!allowedRoot.has(k)) fail(errors, `root: unexpected property "${k}"`);
  }

  return errors;
}

function main(argv) {
  const filePath = argv[2];
  if (!filePath) {
    console.error('Usage: node validate-findings.cjs <path-to-findings.json>');
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
  const errors = validateFindingsDocument(doc);
  if (errors.length) {
    console.error(`Validation failed (${errors.length} error(s)):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log(`OK: ${abs} (${doc.findings.length} finding(s))`);
  process.exit(0);
}

if (require.main === module) {
  main(process.argv);
}

module.exports = { validateFindingsDocument };
