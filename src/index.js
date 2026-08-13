import { read } from './registry.js';

export { read, detect } from './registry.js';
export { render, renderBlocks, labelOf } from './render.js';
export { contentOf, fingerprint } from './blocks.js';
export { inlineText } from './codecs/adf.js';

/** Convenience: parse a DOCUMENT input to canonical blocks. Throws for data
 *  formats (use read()/outline for those). */
export function parse(input, opts = {}) {
  const result = read(input, opts);
  if (result.kind !== 'document') {
    throw new Error(`"${result.codec}" is a data format — use read() or outline(), not parse().`);
  }
  return result.blocks;
}
