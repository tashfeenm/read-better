#!/usr/bin/env node
// read-better — read work-tool formats like a human, at a fraction of the tokens.
//   render  <file|->   document formats → compact markdown
//   parse   <file|->   document → canonical blocks; data → parsed value
//   detect  <file|->   which codec claims this input
// All verbs accept --format <id> to override detection.
import { readFileSync } from 'node:fs';
import { read } from './registry.js';
import { renderBlocks } from './render.js';

function loadText(path) {
  return path === '-' ? readFileSync(0, 'utf8') : readFileSync(path, 'utf8');
}

function opts(path, args) {
  const i = args.indexOf('--format');
  return { filename: path === '-' ? null : path, format: i >= 0 ? args[i + 1] : null };
}

const [cmd, path, ...rest] = process.argv.slice(2);
try {
  switch (cmd) {
    case 'render': {
      const result = read(loadText(path), opts(path, rest));
      if (result.kind !== 'document') {
        throw new Error(`"${result.codec}" is a data format — use: read-better outline ${path}`);
      }
      console.log(renderBlocks(result.blocks));
      break;
    }
    case 'parse': {
      const result = read(loadText(path), opts(path, rest));
      console.log(JSON.stringify(result.kind === 'document' ? result.blocks : result.value, null, 2));
      break;
    }
    case 'detect': {
      const result = read(loadText(path), opts(path, rest));
      console.log(`${result.codec} (${result.kind})`);
      break;
    }
    default:
      console.log(`read-better — token-efficient reading of work-tool formats

Usage:
  read-better render <file|-> [--format <id>]   document → compact markdown
  read-better parse  <file|-> [--format <id>]   → canonical blocks / value
  read-better detect <file|->                   which codec claims the input

Formats: adf (Jira/Confluence rich text — accepts bare docs, Jira issue
payloads, Confluence v2 bodies), json (generic data). More coming: markdown,
yaml, figma, openapi, a11y. Diffing lives in what-changed.`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
