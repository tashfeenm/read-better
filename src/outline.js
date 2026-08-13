// Outline: shape-not-values reading for data formats. A 100k-row array as
// markdown would be the same token bonfire as raw JSON — the efficient read
// is the SHAPE (types, lengths, key sets, small-value domains, samples),
// then targeted fetch-by-address via RFC 6901 JSON Pointer (getPointer).
const SCAN_CAP = 200;      // array elements scanned for shape inference
const KEY_CAP = 8;         // object keys shown before "+N more"
const DOMAIN_CAP = 12;     // distinct strings for a "small domain"

/** Build a structured outline model. Paths are JSON Pointers (aligns with get). */
export function outlineModel(value, { depth = 3, samples = 2 } = {}) {
  const lines = [];
  walk(value, '', 0, { depth, samples, lines });
  return lines;
}

/** Render the model as compact text (the CLI's default view). */
export function outlineText(value, opts = {}) {
  return outlineModel(value, opts)
    .map((l) => `${'  '.repeat(l.indent)}${l.path || '/'}  ${l.desc}${l.note ? `  — ${l.note}` : ''}`)
    .join('\n');
}

function walk(value, path, level, ctx) {
  const indent = level;
  if (Array.isArray(value)) {
    const scan = value.slice(0, SCAN_CAP);
    const shape = arrayShape(scan, value.length);
    ctx.lines.push({ path, indent, desc: shape.desc, note: shape.note });
    for (const sample of value.slice(0, ctx.samples)) {
      ctx.lines.push({ path: `${path}/${value.indexOf(sample)}`, indent: indent + 1, desc: `sample: ${clip(sample)}` });
    }
    // Recurse into a representative element's structure (first object element)
    const rep = scan.find((el) => el && typeof el === 'object');
    if (rep && level + 1 < ctx.depth) {
      walkObjectKeys(rep, `${path}/0`, level + 1, ctx, scan);
    }
    return;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    ctx.lines.push({
      path, indent,
      desc: `object {${keys.slice(0, KEY_CAP).join(', ')}${keys.length > KEY_CAP ? `, +${keys.length - KEY_CAP} more` : ''}}`,
    });
    if (level + 1 <= ctx.depth) {
      for (const key of keys) {
        const child = value[key];
        const childPath = `${path}/${escape(key)}`;
        if (child && typeof child === 'object') {
          walk(child, childPath, level + 1, ctx);
        } else if (level + 1 < ctx.depth) {
          ctx.lines.push({ path: childPath, indent: indent + 1, desc: `${typeOf(child)}: ${clip(child)}` });
        }
      }
    }
    return;
  }
  ctx.lines.push({ path, indent, desc: `${typeOf(value)}: ${clip(value)}` });
}

function walkObjectKeys(rep, repPath, level, ctx, scan) {
  // Small-domain stats across the scanned elements, per string key.
  const objects = scan.filter((el) => el && typeof el === 'object' && !Array.isArray(el));
  for (const key of Object.keys(rep)) {
    const values = objects.map((o) => o[key]).filter((v) => typeof v === 'string');
    if (values.length >= objects.length / 2) {
      const counts = new Map();
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
      if (counts.size > 1 && counts.size <= DOMAIN_CAP) {
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([v, n]) => `${clip(v, 24)} (${Math.round((n / values.length) * 100)}%)`);
        ctx.lines.push({
          path: `${repPath.replace(/\/0$/, '')}/*/${escape(key)}`, indent: level,
          desc: `${counts.size} distinct values: ${top.join(', ')}${counts.size > 3 ? ', …' : ''}`,
        });
      }
    }
  }
}

function arrayShape(scan, total) {
  if (!scan.length) return { desc: 'array[0]' };
  const allObjects = scan.every((el) => el && typeof el === 'object' && !Array.isArray(el));
  if (allObjects) {
    const presence = new Map();
    for (const el of scan) for (const k of Object.keys(el)) presence.set(k, (presence.get(k) ?? 0) + 1);
    const keys = [...presence.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, KEY_CAP)
      .map(([k, n]) => (n === scan.length ? k : `${k}?`));
    return {
      desc: `array[${total}] of object {${keys.join(', ')}${presence.size > KEY_CAP ? ', …' : ''}}`,
      note: total > SCAN_CAP ? `shape inferred from first ${SCAN_CAP}` : undefined,
    };
  }
  const types = [...new Set(scan.map(typeOf))];
  return { desc: `array[${total}] of ${types.join(' | ')}` };
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function clip(v, n = 72) {
  const s = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function escape(segment) {
  return String(segment).replaceAll('~', '~0').replaceAll('/', '~1');
}

/** RFC 6901 JSON Pointer resolution. '' → whole document. */
export function getPointer(value, pointer) {
  if (pointer === '' || pointer === '/') return pointer === '' ? value : childOf(value, '');
  if (!pointer.startsWith('/')) throw new Error(`Invalid JSON Pointer "${pointer}" — must start with "/" (RFC 6901)`);
  let current = value;
  for (const raw of pointer.slice(1).split('/')) {
    current = childOf(current, raw.replaceAll('~1', '/').replaceAll('~0', '~'));
  }
  return current;
}

function childOf(value, key) {
  if (Array.isArray(value)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= value.length) {
      throw new Error(`Pointer segment "${key}" out of range (array length ${value.length})`);
    }
    return value[idx];
  }
  if (value && typeof value === 'object') {
    if (!(key in value)) throw new Error(`Pointer segment "${key}" not found (keys: ${Object.keys(value).slice(0, 8).join(', ')})`);
    return value[key];
  }
  throw new Error(`Pointer segment "${key}" applied to a ${value === null ? 'null' : typeof value}`);
}
