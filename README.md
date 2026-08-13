# read-better

> Token-efficient reading for AI agents. Parse the rich formats work tools
> actually emit — Jira/Confluence ADF today; JSON/YAML outlines, Markdown,
> Figma trees, OpenAPI, Playwright snapshots next — into **addressable
> blocks**, and render them as compact markdown.

**The problem:** ask a work tool's API for content and you get a deeply
nested machine format. One sentence of a Jira description costs hundreds of
tokens of JSON scaffolding. Agents read it badly and pay for every brace.

**The stance:** converters (markitdown, pandoc, Docling) flatten documents
into one-way strings. read-better parses them into **canonical blocks with
content-stable IDs** — so a block can be referenced, fetched alone, and
compared across versions by other tools. Markdown is just one *view* of the
blocks. (Version diffing itself lives in
[what-changed](../what-changed), which builds on this library.)

## Use

```bash
read-better render <doc.json|->   # rich format → compact markdown
read-better parse  <doc.json|->   # rich format → canonical blocks (JSON)
```

```bash
# Read a Jira ticket like a human (5x+ smaller than the raw ADF):
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "https://your.atlassian.net/rest/api/3/issue/PROJ-42?fields=description" \
  | read-better render -
```

Accepts bare ADF docs, whole Jira issue payloads (plucks
`fields.description`), and Confluence v2 bodies (`body.atlas_doc_format`).

## Library

```js
import { parse, render, labelOf } from 'read-better';

const blocks = parse(adfDoc);   // [{id, type, text, ...}] — stable IDs
const md = render(adfDoc);      // compact markdown
```

- **IDs are content hashes** (`type` + normalized text): moving a block keeps
  its ID; editing changes it. This is what makes blocks addressable and
  downstream diffing tractable.
- **Pure functions.** No network, no state, zero dependencies.
- **Nothing silently disappears** — unknown node types pass through as
  opaque text. Presentation-only marks (underline, colors) are dropped by
  design; structural ones (bold, code, links) survive as markdown.

## Roadmap (formats)

ADF ✓ → Markdown → JSON/YAML outline mode (shape-not-values for big files)
→ Confluence storage XHTML → Figma node trees → OpenAPI/Postman →
Playwright a11y YAML.

MIT.
