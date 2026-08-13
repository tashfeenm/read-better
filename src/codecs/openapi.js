// OpenAPI / Postman-collection codec. kind: document. Endpoints as blocks
// with native ids ("METHOD /path") — so "required param added" is a
// same-id fingerprint change, and "endpoint removed" is an id disappearing.
import { finalizeBlocks } from '../blocks.js';

export const id = 'openapi';
export const kind = 'document';

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export function detectValue(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.openapi === 'string' || typeof value.swagger === 'string') return true;
  return Boolean(value.info && Array.isArray(value.item)); // Postman collection
}

export function parse(input) {
  const value = typeof input === 'string' ? JSON.parse(input) : input;
  if (!detectValue(value)) throw new Error('Not an OpenAPI spec or Postman collection');
  const blocks = value.paths ? parseOpenApi(value) : parsePostman(value);
  return finalizeBlocks(blocks, { contentIds: false });
}

function parseOpenApi(spec) {
  const blocks = [];
  if (spec.info?.title) {
    blocks.push({
      id: '#info', type: 'heading', level: 1,
      text: `${spec.info.title} ${spec.info.version ?? ''}`.trim(),
      meta: { version: spec.info.version ?? null },
    });
  }
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const op = item?.[method];
      if (!op) continue;
      const params = [...(item.parameters ?? []), ...(op.parameters ?? [])]
        .map((p) => `${p.name}(${p.in}${p.required ? ',required' : ''})`);
      const responses = Object.keys(op.responses ?? {}).sort();
      const security = (op.security ?? spec.security ?? []).flatMap((s) => Object.keys(s));
      blocks.push({
        id: `${method.toUpperCase()} ${path}`,
        type: 'endpoint',
        label: `${method.toUpperCase()} ${path}`,
        text: op.summary ?? op.description ?? '',
        meta: {
          params,
          responses,
          ...(security.length ? { auth: security } : {}),
          ...(op.requestBody ? { requestBody: Object.keys(op.requestBody.content ?? {}).sort() } : {}),
          ...(op.deprecated ? { deprecated: true } : {}),
        },
      });
    }
  }
  return blocks;
}

function parsePostman(collection) {
  const blocks = [];
  if (collection.info?.name) {
    blocks.push({ id: '#info', type: 'heading', level: 1, text: collection.info.name, meta: {} });
  }
  walkItems(collection.item ?? [], blocks);
  return blocks;
}

function walkItems(items, blocks) {
  for (const item of items) {
    if (Array.isArray(item.item)) {
      walkItems(item.item, blocks); // folder
      continue;
    }
    const req = item.request;
    if (!req) continue;
    const url = typeof req.url === 'string' ? req.url : req.url?.raw ?? '';
    const method = (req.method ?? 'GET').toUpperCase();
    blocks.push({
      id: `${method} ${url.replace(/^[a-z]+:\/\/[^/]+/i, '') || url}`,
      type: 'endpoint',
      label: `${method} ${url}`,
      text: item.name ?? '',
      meta: {
        params: (req.url?.query ?? []).map((q) => `${q.key}(query)`),
        ...(req.auth?.type ? { auth: [req.auth.type] } : {}),
        ...(req.body?.mode ? { requestBody: [req.body.mode] } : {}),
      },
    });
  }
}

/** Compact endpoint listing — the reading view of an API surface. */
export function render(blocks) {
  return blocks
    .map((b) => {
      if (b.type === 'heading') return `# ${b.text}`;
      const bits = [b.label];
      if (b.text) bits.push(`— ${b.text}`);
      if (b.meta.params?.length) bits.push(`params: ${b.meta.params.join(', ')}`);
      if (b.meta.responses?.length) bits.push(`→ ${b.meta.responses.join('/')}`);
      if (b.meta.deprecated) bits.push('[DEPRECATED]');
      return bits.join('  ');
    })
    .join('\n');
}
