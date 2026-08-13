// Generic JSON data codec. kind: data — it parses to a VALUE, not blocks.
// Data formats are outlined (shape-not-values) for reading and diffed with
// structural value diffing downstream, never block diffing: an outline
// deliberately discards values, so block-diffing outlines would mask changes.
export const id = 'json';
export const kind = 'data';

// Registry routes here when strict JSON.parse succeeded and no structured
// document codec (ADF, OpenAPI, Figma…) claimed the value.
export function detectValue() {
  return true; // terminal fallback among JSON-value codecs
}

export function parseValue(value) {
  return value;
}
