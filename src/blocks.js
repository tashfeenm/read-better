// Shared canonical-block machinery. Every codec produces Block[] through
// finalizeBlocks, which enforces the contract:
//   id   — identity: WHICH block this is. Native when the format has real
//          ids (Figma nodes, "METHOD /path"); content-derived otherwise.
//   hash — fingerprint: WHAT the block currently says (type + content +
//          significant meta). Same id + different hash = the block changed.
// Separating the two is what lets diffing catch edits in native-id formats.
import { createHash } from 'node:crypto';

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

/** The comparable content of a block (text, items, or rows flattened). */
export function contentOf(block) {
  if (block.items) return block.items.map((i) => (typeof i === 'string' ? i : `${i.state}:${i.text}`)).join('\n');
  if (block.rows) return block.rows.map((r) => r.join('|')).join('\n');
  return block.text ?? '';
}

export function normalize(text) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Deterministic serialization of significant meta (sorted keys, arrays sorted). */
function canonicalMeta(meta) {
  if (!meta) return '';
  const out = {};
  for (const key of Object.keys(meta).sort()) {
    const v = meta[key];
    out[key] = Array.isArray(v) ? [...v].map(String).sort() : v;
  }
  return JSON.stringify(out);
}

export function fingerprint(block) {
  return sha256(`${block.type}:${normalize(contentOf(block))}:${canonicalMeta(block.meta)}`).slice(0, 12);
}

/**
 * Finalize a codec's raw blocks:
 * - always compute `hash` (the fingerprint);
 * - `contentIds: true` (formats without native identity): id = fingerprint of
 *   type+content ONLY (meta excluded, so meta-only changes keep identity),
 *   with occurrence suffixes for repeats;
 * - `contentIds: false`: codec must have set `id`; repeats get suffixed
 *   rather than silently colliding.
 */
export function finalizeBlocks(blocks, { contentIds = true } = {}) {
  const seen = new Map();
  for (const block of blocks) {
    block.hash = fingerprint(block);
    let base;
    if (contentIds) {
      base = sha256(`${block.type}:${normalize(contentOf(block))}`).slice(0, 8);
    } else {
      if (block.id === undefined || block.id === null) {
        throw new Error(`codec bug: native-id block missing id (type ${block.type})`);
      }
      base = String(block.id);
    }
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    block.id = n === 0 ? base : `${base}~${n}`;
    // Downstream diffing needs to know how the id was derived: content ids
    // change on edit (so remove+add pairs may be re-paired by similarity);
    // native ids never should be (a different id IS a different thing).
    block.idSource = contentIds ? 'content' : 'native';
  }
  return blocks;
}
