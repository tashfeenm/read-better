// Figma codec. kind: document. Figma file JSON (REST GET /v1/files/:key) is
// a node tree with NATIVE stable ids — the showcase for identity ≠
// fingerprint: a renamed or recolored node keeps its id, so edits surface as
// 'changed' rather than remove+add.
import { finalizeBlocks } from '../blocks.js';

export const id = 'figma';
export const kind = 'document';

// Node types that carry meaning for reading/diffing; children of other
// types (vectors, rectangles…) are counted, not enumerated.
const KEEP = new Set(['CANVAS', 'FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'TEXT', 'GROUP', 'SECTION']);

export function detectValue(value) {
  const root = value?.document;
  return Boolean(root && root.type === 'DOCUMENT' && typeof root.id === 'string' && Array.isArray(root.children));
}

export function parse(input) {
  const value = typeof input === 'string' ? JSON.parse(input) : input;
  if (!detectValue(value)) throw new Error('Not a Figma file: expected { document: { type: "DOCUMENT", children: [...] } }');
  const blocks = [];
  for (const child of value.document.children ?? []) walkNode(child, 0, blocks);
  return finalizeBlocks(blocks, { contentIds: false }); // native ids
}

function walkNode(node, depth, blocks) {
  if (KEEP.has(node.type)) {
    blocks.push({
      id: node.id,
      type: 'node',
      label: `${node.type} "${node.name}"`,
      // TEXT content is the thing designers edit — it belongs in the
      // comparable content, not just meta.
      text: node.type === 'TEXT' ? (node.characters ?? node.name) : node.name,
      meta: {
        figmaType: node.type,
        depth,
        children: node.children?.length ?? 0,
        ...(node.componentId ? { componentId: node.componentId } : {}),
        ...(node.visible === false ? { hidden: true } : {}),
      },
    });
    depth += 1;
  }
  for (const child of node.children ?? []) walkNode(child, depth, blocks);
}

/** Indented frame outline — the reading view of a design file. */
export function render(blocks) {
  return blocks
    .map((b) => `${'  '.repeat(b.meta.depth)}${b.meta.figmaType} ${JSON.stringify(b.text)}${b.meta.children ? ` (${b.meta.children} children)` : ''}`)
    .join('\n');
}
