// Markdown codec. kind: document. Line-based, deliberately not
// CommonMark-complete: headings, fenced code, lists (incl. task items),
// tables, blockquotes, rules, paragraphs. Unknown constructs become
// paragraphs — nothing silently disappears. Produces the same block shapes
// as the ADF codec, so downstream diffing works on .md immediately.
// Reached ONLY via filename hint (.md/.markdown) or --format markdown.
import { finalizeBlocks } from '../blocks.js';

export const id = 'markdown';
export const kind = 'document';
export const acceptsText = true;

export function parse(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  // YAML frontmatter (--- … ---) at the very top: capture as ONE opaque
  // block instead of mangling it into rule + paragraph soup. Not lost, not
  // interpreted — a frontmatter edit diffs as a single 'frontmatter' change.
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, idx) => idx > 0 && /^(---|\.\.\.)\s*$/.test(l.trim()));
    if (end > 0) {
      blocks.push({ type: 'frontmatter', text: lines.slice(1, end).join('\n') });
      i = end + 1;
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i += 1; continue; }

    // Fenced code
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      const body = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { body.push(lines[i]); i += 1; }
      i += 1; // closing fence (or EOF)
      blocks.push({ type: 'code', language: fence[1] || null, text: body.join('\n') });
      continue;
    }

    // ATX heading
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    // Rule
    if (/^ {0,3}([-*_])( *\1){2,}\s*$/.test(line)) {
      blocks.push({ type: 'rule', text: '' });
      i += 1;
      continue;
    }

    // Blockquote
    if (/^ {0,3}>/.test(line)) {
      const body = [];
      while (i < lines.length && /^ {0,3}>/.test(lines[i])) {
        body.push(lines[i].replace(/^ {0,3}> ?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: body.join('\n').trim() });
      continue;
    }

    // Table: header row + separator row
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const rows = [];
      rows.push(splitRow(line));
      i += 2; // skip separator
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }

    // List (bullet or ordered), including task items; nesting flattens with
    // "  - " continuation, matching the ADF codec's list shape.
    if (/^ *([-*+]|\d+[.)]) /.test(line)) {
      const { block, next } = parseList(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }

    // Paragraph: contiguous non-empty, non-structural lines
    const body = [line.trim()];
    i += 1;
    while (
      i < lines.length && lines[i].trim() &&
      !/^```|^#{1,6}\s|^ {0,3}>|^ *([-*+]|\d+[.)]) |^\s*\|.*\|\s*$/.test(lines[i]) &&
      !/^ {0,3}([-*_])( *\1){2,}\s*$/.test(lines[i])
    ) {
      body.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: body.join('\n') });
  }

  return finalizeBlocks(blocks);
}

function splitRow(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

function parseList(lines, start) {
  const items = [];
  const tasks = [];
  let sawTask = false;
  let ordered = /^\s*\d+[.)] /.test(lines[start]);
  const baseIndent = lines[start].match(/^ */)[0].length;
  let i = start;

  while (i < lines.length) {
    const m = lines[i].match(/^( *)([-*+]|\d+[.)]) (.*)$/);
    if (!m) break;
    const indent = m[1].length;
    let text = m[3];

    const task = text.match(/^\[([ xX])\]\s+(.*)$/);
    if (indent <= baseIndent) {
      if (task) {
        sawTask = true;
        tasks.push({ state: task[1].toLowerCase() === 'x' ? 'done' : 'todo', text: task[2] });
        items.push(task[2]);
      } else {
        items.push(text);
        tasks.push({ state: 'todo', text });
      }
    } else {
      // Nested item: flatten onto the previous top-level item (ADF-shape parity)
      if (items.length) items[items.length - 1] += `\n  - ${task ? task[2] : text}`;
      if (tasks.length) tasks[tasks.length - 1].text += `\n  - ${task ? task[2] : text}`;
    }
    i += 1;
    // Continuation lines (indented, non-list) attach to the previous item
    while (i < lines.length && lines[i].trim() && !/^ *([-*+]|\d+[.)]) /.test(lines[i]) && /^ {2,}/.test(lines[i])) {
      if (items.length) items[items.length - 1] += ` ${lines[i].trim()}`;
      i += 1;
    }
  }

  return {
    block: sawTask ? { type: 'tasks', items: tasks } : { type: 'list', ordered, items },
    next: i,
  };
}
