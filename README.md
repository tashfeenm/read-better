# adf-codec

> Parse, render, and diff **Atlassian Document Format** (ADF) — the JSON
> rich-text format inside every Jira description, Jira comment, and
> Confluence page. Built so AI agents stop paying token tax on `{"type":
> "paragraph","content":[…]}` scaffolding.

**The problem:** ask any Jira/Confluence API (or MCP server) for content and
you get ADF — a deeply nested JSON tree where one sentence costs hundreds of
tokens of structural noise. Agents read it badly and diff it worse.

**What this does, zero dependencies:**

- **`render`** — ADF → compact markdown. The fixture doc in this repo is
  **5.3× smaller** rendered (and markdown tokenizes far better than JSON).
- **`parse`** — ADF → a flat array of typed blocks (heading, paragraph, code,
  list, tasks, table, panel, expand, media…) with **content-stable IDs**:
  moving a block keeps its ID, editing it changes it.
- **`diff`** — two ADF docs → block-level ops: `added` / `removed` /
  `changed` / `moved`, with human summaries. Edits re-pair via a similarity
  pass, so an edited code block is one `changed`, not remove+add noise.

```bash
$ adf diff release-notes-v1.json release-notes-v2.json
[CHANGED] code block (bash) edited
[CHANGED] task list: 2/3 done (was 1)
[CHANGED] table: 2 → 3 rows
[REMOVED] warning panel removed
[ADDED] section "Comms" added
```

## CLI

```bash
adf render <doc.json|->            # ADF → markdown (reads stdin with -)
adf parse  <doc.json|->            # ADF → canonical blocks (JSON)
adf diff   <a.json> <b.json> [--json]
```

Input can be a bare ADF doc, a whole Jira issue payload (plucks
`fields.description`), or a Confluence v2 body (`body.atlas_doc_format`).

```bash
# Read a Jira ticket like a human:
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "https://your.atlassian.net/rest/api/3/issue/PROJ-42?fields=description" \
  | adf render -
```

## Library

```js
import { parse, render, diff } from 'adf-codec';

const blocks = parse(adfDoc);      // typed blocks with stable IDs
const md = render(adfDoc);         // compact markdown
const ops = diff(oldDoc, newDoc);  // [{op, type, label, summary, before?, after?}]
```

## Design notes

- **Pure functions.** No network, no state — format in, blocks/markdown/ops out.
- **Stable identity by content hash.** `type + normalized text`, with
  occurrence suffixes for repeats. Moves keep IDs; edits change them and get
  re-paired by word-set similarity (Jaccard ≥ 0.4, same type).
- **Nothing silently disappears.** Unknown node types pass through as opaque
  text blocks.
- **Presentation marks are dropped by design** (underline, colors);
  structural marks survive as markdown (bold, italic, code, links, strike).

Extracted from [what-changed](../what-changed) — a local change-memory layer
for work tools — but useful standalone anywhere an agent touches Jira or
Confluence.

MIT.
