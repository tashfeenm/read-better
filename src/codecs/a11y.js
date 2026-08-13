// Playwright accessibility-snapshot codec (aria snapshot YAML). kind:
// document. The a11y tree is the best diff substrate for "what changed
// between two builds" — structural and semantic, unlike pixels.
// Node shape in snapshots: `- role "name" [attr=…]:` with nested children.
import { parseYaml } from '../yaml.js';
import { finalizeBlocks } from '../blocks.js';

export const id = 'a11y';
export const kind = 'document';
export const acceptsText = true;

const KNOWN_ROLES = new Set([
  'alert', 'article', 'banner', 'button', 'cell', 'checkbox', 'code',
  'combobox', 'complementary', 'contentinfo', 'dialog', 'document',
  'emphasis', 'form', 'generic', 'group', 'heading', 'iframe', 'img',
  'link', 'list', 'listitem', 'main', 'menu', 'menuitem', 'navigation',
  'option', 'paragraph', 'radio', 'region', 'row', 'search', 'searchbox',
  'separator', 'slider', 'strong', 'switch', 'tab', 'table', 'tabpanel',
  'text', 'textbox', 'toolbar', 'tooltip',
]);

const NODE_RE = /^([a-z]+)(?:\s+"((?:[^"\\]|\\.)*)")?(?:\s+\[([^\]]*)\])?:?$/;

/** Detect over a YAML-parsed value: a list whose entries are role-shaped. */
export function detectValue(value) {
  if (!Array.isArray(value) || value.length === 0) return false;
  const keys = value.map(entryKey).filter(Boolean);
  if (!keys.length) return false;
  const roleLike = keys.filter((k) => {
    const m = k.match(NODE_RE);
    return m && KNOWN_ROLES.has(m[1]);
  });
  return roleLike.length / keys.length >= 0.6;
}

function entryKey(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const keys = Object.keys(entry);
    return keys.length === 1 ? keys[0] : null;
  }
  return null;
}

export function parse(input) {
  const value = typeof input === 'string' ? parseYaml(input) : input;
  if (!Array.isArray(value)) throw new Error('Not an a11y snapshot: expected a top-level list of role nodes');
  const blocks = [];
  walkNodes(value, 0, blocks);
  return finalizeBlocks(blocks);
}

function walkNodes(entries, depth, blocks) {
  for (const entry of entries) {
    if (typeof entry === 'string') {
      pushNode(entry, null, depth, blocks);
    } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      for (const [key, children] of Object.entries(entry)) {
        pushNode(key, children, depth, blocks);
      }
    }
  }
}

function pushNode(key, children, depth, blocks) {
  const m = key.match(NODE_RE);
  const role = m?.[1] ?? 'node';
  const name = m?.[2] ?? null;
  const attrs = m?.[3] ?? null;
  const childCount = Array.isArray(children) ? children.length : 0;
  blocks.push({
    type: 'a11y',
    text: `${role}${name ? ` "${name}"` : ''}${attrs ? ` [${attrs}]` : ''}`,
    label: `${role}${name ? ` "${name}"` : ''}`,
    meta: { role, depth, children: childCount },
  });
  if (Array.isArray(children)) walkNodes(children, depth + 1, blocks);
}

/** Indented snapshot-style rendering (round-trips the reading view). */
export function render(blocks) {
  return blocks.map((b) => `${'  '.repeat(b.meta?.depth ?? 0)}- ${b.text}`).join('\n');
}
