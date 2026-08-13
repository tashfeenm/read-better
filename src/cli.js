#!/usr/bin/env node
// read-better — read work-tool formats like a human, at a fraction of the tokens.
//   render  <file|->   document formats → compact markdown
//   parse   <file|->   document → canonical blocks; data → parsed value
//   detect  <file|->   which codec claims this input
// All verbs accept --format <id> to override detection.
import { readFileSync } from 'node:fs';
import { read } from './registry.js';
import { render } from './render.js';
import { outlineModel, outlineText, getPointer } from './outline.js';

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
      console.log(render(loadText(path), opts(path, rest)));
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
    case 'outline': {
      const result = read(loadText(path), opts(path, rest));
      if (result.kind !== 'data') {
        throw new Error(`"${result.codec}" is a document format — use: read-better render ${path}`);
      }
      const flag = (name, dflt) => {
        const i = rest.indexOf(`--${name}`);
        return i >= 0 ? Number(rest[i + 1]) : dflt;
      };
      const o = { depth: flag('depth', 3), samples: flag('samples', 2) };
      console.log(rest.includes('--json')
        ? JSON.stringify(outlineModel(result.value, o), null, 2)
        : outlineText(result.value, o));
      break;
    }
    case 'get': {
      const pointer = rest.find((a) => !a.startsWith('--')) ?? '';
      const result = read(loadText(path), opts(path, rest.filter((a) => a !== pointer)));
      if (result.kind !== 'data') {
        throw new Error(`"${result.codec}" is a document format — get works on data (JSON/YAML).`);
      }
      console.log(JSON.stringify(getPointer(result.value, pointer), null, 2));
      break;
    }
    default:
      console.log(`read-better — token-efficient reading of work-tool formats

Usage:
  read-better render  <file|-> [--format <id>]  document → compact markdown
  read-better outline <file|-> [--depth N] [--samples N] [--json]
                                                data → shape, not values
  read-better get     <file|-> <json-pointer>   targeted fetch (RFC 6901)
  read-better parse   <file|-> [--format <id>]  → canonical blocks / value
  read-better detect  <file|->                  which codec claims the input

Formats: adf (Jira/Confluence rich text — accepts bare docs, Jira issue
payloads, Confluence v2 bodies), json (generic data). More coming: markdown,
yaml, figma, openapi, a11y. Diffing lives in what-changed.`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
