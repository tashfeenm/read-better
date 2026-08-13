// ADF codec — Atlassian Document Format: the JSON rich-text format in Jira
// descriptions/comments and Confluence v2 page bodies. kind: document.
// Unwrapping API payload shapes (Jira issue, Confluence body) is THIS
// codec's job, not the caller's.
import { finalizeBlocks } from '../blocks.js';

export const id = 'adf';
export const kind = 'document';

/** Find the ADF doc inside a value: bare doc or known API wrapper shapes. */
export function unwrap(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.type === 'doc' && Array.isArray(value.content)) return value;
  if (value.fields?.description?.type === 'doc') return value.fields.description;
  if (typeof value.body?.atlas_doc_format?.value === 'string') {
    try { return unwrap(JSON.parse(value.body.atlas_doc_format.value)); } catch { return null; }
  }
  if (value.body?.type === 'doc') return value.body;
  return null;
}

export function detectValue(value) {
  return unwrap(value) !== null;
}

export function parse(input) {
  const doc = unwrap(typeof input === 'string' ? JSON.parse(input) : input);
  if (!doc) throw new Error('Not an ADF document: expected { type: "doc", content: [...] } (or a Jira/Confluence payload containing one)');
  return finalizeBlocks(doc.content.map(toBlock).filter(Boolean));
}

function toBlock(node) {
  switch (node.type) {
    case 'heading':
      return { type: 'heading', level: node.attrs?.level ?? 1, text: inlineText(node) };
    case 'paragraph': {
      const text = inlineText(node);
      return text ? { type: 'paragraph', text } : null; // empty paragraphs are layout, not content
    }
    case 'codeBlock':
      return { type: 'code', language: node.attrs?.language ?? null, text: rawText(node) };
    case 'blockquote':
      return { type: 'quote', text: childBlocksText(node) };
    case 'bulletList':
    case 'orderedList':
      return { type: 'list', ordered: node.type === 'orderedList', items: listItems(node) };
    case 'taskList':
      return {
        type: 'tasks',
        items: (node.content ?? []).map((item) => ({
          state: item.attrs?.state === 'DONE' ? 'done' : 'todo',
          text: childBlocksText(item),
        })),
      };
    case 'table':
      return { type: 'table', rows: tableRows(node) };
    case 'panel':
      return { type: 'panel', panelType: node.attrs?.panelType ?? 'info', text: childBlocksText(node) };
    case 'expand':
    case 'nestedExpand':
      return { type: 'expand', title: node.attrs?.title ?? '', text: childBlocksText(node) };
    case 'rule':
      return { type: 'rule', text: '' };
    case 'mediaSingle':
    case 'mediaGroup':
      return {
        type: 'media',
        ids: (node.content ?? []).map((m) => m.attrs?.id ?? m.attrs?.url ?? 'media').filter(Boolean),
        text: (node.content ?? []).map((m) => m.attrs?.alt ?? '').join(' ').trim(),
      };
    case 'decisionList':
      return {
        type: 'decisions',
        items: (node.content ?? []).map((item) => ({ state: 'decided', text: childBlocksText(item) })),
      };
    default:
      // Unknown block: preserve as opaque text so nothing silently disappears.
      return { type: node.type, text: childBlocksText(node) || rawText(node) };
  }
}

function listItems(node) {
  return (node.content ?? []).map((li) => {
    const nested = (li.content ?? []).filter((c) => c.type === 'bulletList' || c.type === 'orderedList');
    const own = (li.content ?? []).filter((c) => c.type !== 'bulletList' && c.type !== 'orderedList');
    let text = own.map((c) => blockText(c)).filter(Boolean).join(' ');
    for (const sub of nested) {
      text += listItems(sub).map((s) => `\n  - ${s}`).join('');
    }
    return text;
  });
}

function tableRows(node) {
  return (node.content ?? [])
    .filter((r) => r.type === 'tableRow')
    .map((row) =>
      (row.content ?? [])
        .filter((c) => c.type === 'tableCell' || c.type === 'tableHeader')
        .map((cell) => childBlocksText(cell))
    );
}

function childBlocksText(node) {
  return (node.content ?? []).map(blockText).filter(Boolean).join('\n');
}

const INLINE_TYPES = new Set(['text', 'mention', 'emoji', 'hardBreak', 'inlineCard', 'blockCard', 'embedCard', 'status', 'date']);

function blockText(node) {
  // Some containers (taskItem, decisionItem) hold inline nodes directly.
  if (INLINE_TYPES.has(node.type)) return inlineNode(node);
  const block = toBlock(node);
  if (!block) return '';
  if (block.items) return block.items.map((i) => (typeof i === 'string' ? i : i.text)).join('\n');
  if (block.rows) return block.rows.map((r) => r.join(' | ')).join('\n');
  return block.text ?? '';
}

/** Inline content → text with lightweight markdown marks. */
export function inlineText(node) {
  return (node.content ?? []).map(inlineNode).join('').trim();
}

function inlineNode(node) {
  switch (node.type) {
    case 'text':
      return applyMarks(node.text ?? '', node.marks ?? []);
    case 'mention':
      return node.attrs?.text ?? `@${node.attrs?.id ?? 'user'}`;
    case 'emoji':
      return node.attrs?.text ?? node.attrs?.shortName ?? '';
    case 'hardBreak':
      return '\n';
    case 'inlineCard':
    case 'blockCard':
    case 'embedCard':
      return node.attrs?.url ?? '';
    case 'status':
      return `[${node.attrs?.text ?? 'status'}]`;
    case 'date':
      return node.attrs?.timestamp ? new Date(Number(node.attrs.timestamp)).toISOString().slice(0, 10) : '';
    default:
      return inlineText(node);
  }
}

function applyMarks(text, marks) {
  let out = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'code': out = `\`${out}\``; break;
      case 'strong': out = `**${out}**`; break;
      case 'em': out = `*${out}*`; break;
      case 'strike': out = `~~${out}~~`; break;
      case 'link': out = mark.attrs?.href ? `[${out}](${mark.attrs.href})` : out; break;
      // underline, textColor, subsup: presentation-only — dropped by design.
    }
  }
  return out;
}

function rawText(node) {
  return (node.content ?? []).map((c) => c.text ?? rawText(c)).join('');
}
