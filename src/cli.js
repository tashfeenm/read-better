#!/usr/bin/env node
// read-better — read work-tool formats like a human, at a fraction of the tokens.
//   read-better render <doc.json|->   rich format → compact markdown
//   read-better parse  <doc.json|->   rich format → canonical blocks (JSON)
// Currently supported: ADF (Jira descriptions/comments, Confluence v2 bodies).
import { readFileSync } from 'node:fs';
import { parse } from './parse.js';
import { render } from './render.js';

export function loadAdf(path) {
  const text = path === '-' ? readFileSync(0, 'utf8') : readFileSync(path, 'utf8');
  const doc = JSON.parse(text);
  // Accept whole API payloads too: pluck common ADF locations.
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
      console.log(render(loadAdf(args[0])));
      break;
    case 'parse':
      console.log(JSON.stringify(parse(loadAdf(args[0])), null, 2));
      break;
    default:
      console.log(`read-better — token-efficient reading of work-tool formats

Usage:
  read-better render <doc.json|->   rich format → compact markdown
  read-better parse  <doc.json|->   rich format → canonical blocks (JSON)

Accepts bare ADF docs, Jira issue payloads (fields.description), and
Confluence v2 bodies (body.atlas_doc_format). Diffing lives in what-changed.`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
