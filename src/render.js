// Render canonical blocks to compact markdown — the shared default view for
// document codecs. This is the token-efficiency payoff: a Jira description
// that arrives as ~40 lines of ADF JSON reads back as 3 lines of markdown.
import { read, codecById } from './registry.js';

/** Render raw input (auto-detected document format) to markdown (or the
 *  codec's own view, when it defines one — e.g. a11y's indented tree). */
export function render(input, opts = {}) {
  const result = read(input, opts);
  if (result.kind !== 'document') {
    throw new Error(`"${result.codec}" is a data format — use outline() / the outline verb, not render.`);
  }
  const codec = codecById(result.codec);
  return codec.render ? codec.render(result.blocks) : renderBlocks(result.blocks);
}

/** Render pre-parsed canonical blocks. Explicit on purpose: a bare JSON
 *  array must never be silently mistaken for blocks. */
export function renderBlocks(blocks) {
  return blocks.map(renderBlock).filter((s) => s !== null).join('\n\n');
}

function renderBlock(block) {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(Math.min(block.level ?? 1, 6))} ${block.text}`;
    case 'paragraph':
      return block.text;
    case 'code':
      return `\`\`\`${block.language ?? ''}\n${block.text}\n\`\`\``;
    case 'quote':
      return block.text.split('\n').map((l) => `> ${l}`).join('\n');
    case 'list':
      return block.items
        .map((item, i) => (block.ordered ? `${i + 1}. ${item}` : `- ${item}`))
        .join('\n');
    case 'tasks':
      return block.items.map((t) => `- [${t.state === 'done' ? 'x' : ' '}] ${t.text}`).join('\n');
    case 'decisions':
      return block.items.map((d) => `- ✓ ${d.text}`).join('\n');
    case 'table': {
      const [head, ...body] = block.rows;
      if (!head) return null;
      const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`];
      for (const row of body) lines.push(`| ${row.join(' | ')} |`);
      return lines.join('\n');
    }
    case 'panel':
      return `> **${(block.panelType ?? 'info').toUpperCase()}:** ${block.text.replace(/\n/g, ' ')}`;
    case 'expand':
      return `<details><summary>${block.title}</summary>\n\n${block.text}\n\n</details>`;
    case 'rule':
      return '---';
    case 'media':
      return `(media: ${block.ids?.join(', ') || 'attachment'}${block.text ? ` — ${block.text}` : ''})`;
    default:
      return block.text || null;
  }
}

/** One-line label for a block, used in diff summaries. Codecs may precompute
 *  block.label; this is the shape-based fallback. */
export function labelOf(block) {
  if (block.label) return block.label;
  const clip = (s, n = 48) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  switch (block.type) {
    case 'heading': return `section "${clip(block.text)}"`;
    case 'code': return `code block${block.language ? ` (${block.language})` : ''}`;
    case 'table': return `table (${block.rows?.length ?? 0} rows)`;
    case 'list': return `list (${block.items?.length ?? 0} items)`;
    case 'tasks': return `task list (${block.items?.length ?? 0} tasks)`;
    case 'panel': return `${block.panelType ?? 'info'} panel`;
    case 'expand': return `expand "${clip(block.title ?? '')}"`;
    case 'media': return 'media';
    case 'rule': return 'divider';
    default: return `${block.type} "${clip(block.text ?? '')}"`;
  }
}
