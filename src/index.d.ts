/** A canonical block parsed from an ADF document. */
export interface AdfBlock {
  /** Content-stable identity: hash of type + normalized text (+ occurrence suffix). */
  id: string;
  type: string;
  text?: string;
  level?: number;
  language?: string | null;
  ordered?: boolean;
  panelType?: string;
  title?: string;
  items?: Array<string | { state: string; text: string }>;
  rows?: string[][];
  ids?: string[];
}

export interface AdfDiffOp {
  op: 'added' | 'removed' | 'changed' | 'moved';
  type: string;
  label: string;
  summary: string;
  before?: string;
  after?: string;
}

/** ADF document or JSON string → canonical blocks with stable IDs. */
export function parse(adf: object | string): AdfBlock[];

/** ADF document or pre-parsed blocks → compact markdown. */
export function render(input: object | string | AdfBlock[]): string;

/** Block-level diff of two ADF documents (or pre-parsed block arrays). */
export function diff(a: object | string | AdfBlock[], b: object | string | AdfBlock[]): AdfDiffOp[];

/** One-line label for a block, as used in diff summaries. */
export function labelOf(block: AdfBlock): string;

/** Inline ADF content → text with lightweight markdown marks. */
export function inlineText(node: object): string;

/** The diffable content of a block (text, items, or rows flattened). */
export function contentOf(block: AdfBlock): string;
