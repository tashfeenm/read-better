/** A canonical block parsed from any document codec. */
export interface Block {
  /** Identity: WHICH block. Native when the format has real ids (Figma
   *  nodes, "METHOD /path"); content-derived otherwise. */
  id: string;
  /** How the id was derived. Content ids change on edit (diffs may re-pair
   *  by similarity); native ids never should be re-paired. */
  idSource: 'content' | 'native';
  /** Fingerprint: WHAT the block currently says — type + content +
   *  significant meta. Same id + different hash = changed in place. */
  hash: string;
  type: string;
  text?: string;
  /** Precomputed human label; labelOf() falls back by shape when absent. */
  label?: string;
  /** Codec-declared significant facts (params, roles, child counts…). */
  meta?: Record<string, unknown>;
  level?: number;
  language?: string | null;
  ordered?: boolean;
  panelType?: string;
  title?: string;
  items?: Array<string | { state: string; text: string }>;
  rows?: string[][];
  ids?: string[];
}

export type ReadResult =
  | { codec: string; kind: 'document'; blocks: Block[] }
  | { codec: string; kind: 'data'; value: unknown };

export interface ReadOptions {
  /** Filename hint (enables Markdown detection for .md/.markdown). */
  filename?: string | null;
  /** Explicit codec id — overrides detection. */
  format?: string | null;
}

/** Read any supported input (raw text or already-parsed JSON value). */
export function read(input: string | object, opts?: ReadOptions): ReadResult;

/** Which codec claims this input (same rules as read). */
export function detect(input: string | object, opts?: ReadOptions): string;

/** Convenience: parse a DOCUMENT input to blocks. Throws for data formats. */
export function parse(input: string | object, opts?: ReadOptions): Block[];

/** Render a document input via its codec's view (markdown by default). */
export function render(input: string | object, opts?: ReadOptions): string;

/** Render pre-parsed canonical blocks (explicit — never inferred). */
export function renderBlocks(blocks: Block[]): string;

/** One-line human label for a block ("warning panel", 'section "Comms"'). */
export function labelOf(block: Block): string;

/** The comparable content of a block (text, items, or rows flattened). */
export function contentOf(block: Block): string;

/** Fingerprint of a block (type + normalized content + canonical meta). */
export function fingerprint(block: Block): string;

export interface OutlineLine {
  /** RFC 6901 JSON Pointer to this location. */
  path: string;
  indent: number;
  desc: string;
  note?: string;
}

export interface OutlineOptions {
  depth?: number;
  samples?: number;
}

/** Structured shape-not-values outline of a data value. */
export function outlineModel(value: unknown, opts?: OutlineOptions): OutlineLine[];

/** Text rendering of the outline (the CLI's default view). */
export function outlineText(value: unknown, opts?: OutlineOptions): string;

/** RFC 6901 JSON Pointer resolution ('' → whole document). */
export function getPointer(value: unknown, pointer: string): unknown;

/** Inline ADF content → text with lightweight markdown marks. */
export function inlineText(node: object): string;
