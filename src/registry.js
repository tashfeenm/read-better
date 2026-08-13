// Codec registry and format detection.
// Detection contract (order matters; see FOUNDING plan / Codex review):
//   1. explicit `format` always wins;
//   2. strict JSON first (JSON is valid YAML — JSON must win), then
//      structured-document sniffs over the parsed value, else generic JSON;
//   3. Markdown ONLY via filename hint or explicit format — never a silent
//      fallback for malformed JSON/YAML (those error loudly);
//   4. YAML subset parse (structured root only), a11y sniff, else generic YAML.
import * as adf from './codecs/adf.js';
import * as json from './codecs/json.js';
import * as markdown from './codecs/markdown.js';
import * as yaml from './codecs/yaml.js';
import * as a11y from './codecs/a11y.js';
import * as figma from './codecs/figma.js';
import * as openapi from './codecs/openapi.js';
import { parseYaml, YamlSubsetError } from './yaml.js';

// Ordered: specific document codecs before the generic data fallback.
const VALUE_CODECS = [adf, openapi, figma, json];
const ALL_CODECS = [adf, json, markdown, yaml, a11y, figma, openapi];

export function codecById(id) {
  const codec = ALL_CODECS.find((c) => c.id === id);
  if (!codec) throw new Error(`Unknown format "${id}". Known: ${ALL_CODECS.map((c) => c.id).join(', ')}`);
  return codec;
}

/**
 * Read any supported input.
 * @param input string (raw file text) or object (already-parsed JSON value)
 * @returns { codec, kind, blocks? , value? }
 */
export function read(input, { filename = null, format = null } = {}) {
  const { codec, parsed } = resolveCodec(input, { filename, format });
  // Detection may have already parsed the input (JSON/YAML) — reuse it.
  const payload = parsed !== undefined ? parsed : coerceForCodec(input, codec);
  if (codec.kind === 'document') {
    return { codec: codec.id, kind: 'document', blocks: codec.parse(payload) };
  }
  return { codec: codec.id, kind: 'data', value: codec.parseValue(payload) };
}

function resolveCodec(input, { filename, format }) {
  if (format) return { codec: codecById(format) };

  // Object input: detect over value codecs directly.
  if (typeof input === 'object' && input !== null) {
    return { codec: detectFromValue(input), parsed: input };
  }

  const text = String(input);

  // 1) strict JSON
  let value;
  let isJson = false;
  try {
    value = JSON.parse(text);
    isJson = true;
  } catch {
    isJson = false;
  }
  if (isJson) {
    if (value === null || typeof value !== 'object') {
      throw new Error('Input is a bare JSON scalar — nothing to read. Pass a document or data structure.');
    }
    return { codec: detectFromValue(value), parsed: value };
  }

  // 2) Markdown: filename hint only, never a fallback for malformed data.
  if (filename && /\.(md|markdown)$/i.test(filename)) {
    return { codec: codecById('markdown') };
  }

  // Looks like intended-JSON that failed to parse? Error loudly rather than
  // guessing (leading { or [ is not valid YAML-subset either).
  if (/^\s*[{[]/.test(text)) {
    throw new Error('Input looks like JSON but failed to parse. Fix the JSON or pass --format.');
  }

  // 3) YAML subset — accepted only with a STRUCTURED root (map/sequence);
  // bare-scalar "YAML" would swallow arbitrary prose.
  try {
    const yamlValue = parseYaml(text);
    if (yamlValue !== null && typeof yamlValue === 'object') {
      return { codec: yamlFamilyCodec(yamlValue), parsed: yamlValue };
    }
  } catch (err) {
    if (err instanceof YamlSubsetError) throw err; // named construct — helpful, don't mask
  }

  throw new Error('Could not detect format (tried JSON, YAML; Markdown needs a .md filename or --format). Pass --format to override.');
}

function detectFromValue(value) {
  for (const codec of VALUE_CODECS) {
    if (codec.detectValue?.(value)) return codec;
  }
  return json;
}

// YAML-parsed values route to document codecs that ride on YAML, else fall
// back to generic YAML data. OpenAPI matters here: real-world specs are
// mostly YAML, and their endpoints deserve block diffing, not value diffing.
function yamlFamilyCodec(value) {
  if (a11y.detectValue(value)) return a11y;
  if (openapi.detectValue(value)) return openapi;
  return yaml;
}

function coerceForCodec(input, codec) {
  if (typeof input !== 'string') return input;
  if (codec.acceptsText) return input; // text-native codecs (markdown, yaml)
  return JSON.parse(input);
}

export function detect(input, opts = {}) {
  return resolveCodec(input, opts).codec.id;
}
