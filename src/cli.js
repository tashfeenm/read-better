#!/usr/bin/env node
// adf — read Atlassian Document Format like a human, diff it like a machine.
//   adf render <doc.json>          ADF → compact markdown (token-efficient)
//   adf parse  <doc.json>          ADF → canonical blocks (JSON)
//   adf diff   <a.json> <b.json>   block-level diff [--json]
// Any path may be '-' for stdin.
import { readFileSync } from 'node:fs';
import { parse } from './parse.js';
import { render } from './render.js';
import { diff } from './diff.js';

function load(path) {
  const text = path === '-' ? readFileSync(0, 'utf8') : readFileSync(path, 'utf8');
  const doc = JSON.parse(text);
  // Accept whole Jira issue payloads too: pluck common ADF locations.
  if (doc.type === 'doc') return doc;
  if (doc.fields?.description?.type === 'doc') return doc.fields.description;
  if (doc.body?.atlas_doc_format?.value) return JSON.parse(doc.body.atlas_doc_format.value);
  if (doc.body?.type === 'doc') return doc.body;
  throw new Error('No ADF document found in input');
}

const [cmd, ...args] = process.argv.slice(2);
try {
  switch (cmd) {
    case 'render':
      console.log(render(load(args[0])));
      break;
    case 'parse':
      console.log(JSON.stringify(parse(load(args[0])), null, 2));
      break;
    case 'diff': {
      const ops = diff(load(args[0]), load(args[1]));
      if (args.includes('--json')) console.log(JSON.stringify(ops, null, 2));
      else if (!ops.length) console.log('No changes.');
      else for (const op of ops) console.log(`[${op.op.toUpperCase()}] ${op.summary}`);
      break;
    }
    default:
      console.log(`adf — parse, render, and diff Atlassian Document Format

Usage:
  adf render <doc.json|->          ADF → compact markdown
  adf parse  <doc.json|->          ADF → canonical blocks (JSON)
  adf diff   <a.json> <b.json> [--json]

Accepts bare ADF docs, Jira issue payloads (fields.description), and
Confluence v2 bodies (body.atlas_doc_format).`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
