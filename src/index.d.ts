/** A canonical block parsed from a rich-format document. */
export interface Block {
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

/** ADF document or JSON string → canonical blocks with stable IDs. */
export function parse(adf: object | string): Block[];

/** ADF document or pre-parsed blocks → compact markdown. */
export function render(input: object | string | Block[]): string;

/** One-line human label for a block ("warning panel", 'section "Comms"'). */
export function labelOf(block: Block): string;

/** Inline ADF content → text with lightweight markdown marks. */
export function inlineText(node: object): string;

/** The comparable content of a block (text, items, or rows flattened). */
export function contentOf(block: Block): string;
