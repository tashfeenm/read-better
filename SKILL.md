---
name: adf
description: Read and diff Atlassian rich text (Jira descriptions/comments, Confluence pages) efficiently. Use whenever an API or MCP tool returns ADF JSON ({"type":"doc",...}) — render it to markdown instead of reading raw JSON, and diff two versions instead of comparing them by eye.
---

# ADF codec — token-efficient Atlassian content

ADF (Atlassian Document Format) is the nested JSON returned by Jira and
Confluence APIs for any rich text. Never read or compare it raw: it costs
5×+ the tokens of the equivalent markdown and buries the content.

## Commands (from this repo: `node src/cli.js …`; installed: `adf …`)

Read a document (accepts bare ADF, Jira issue payloads, Confluence v2 bodies;
`-` = stdin):

```bash
curl -s … | adf render -          # → compact markdown
```

Compare two versions (e.g. a Confluence page's version N and N-1, or a Jira
description before/after an edit):

```bash
adf diff old.json new.json        # → [CHANGED] code block (bash) edited …
adf diff old.json new.json --json # → machine-readable ops
```

Get structured blocks with stable IDs (for programmatic work):

```bash
adf parse doc.json
```

## Rules of thumb

- Fetching a Jira issue? Pipe `fields.description` through `adf render -`
  before reasoning about it.
- Asked "what changed" on a Confluence page? Fetch both versions
  (`/pages/{id}/versions/{n}` gives historical bodies) and `adf diff` them —
  do not eyeball two markdown renders.
- Need before/after text of one specific change? Use `--json`: each op
  carries `before`/`after` for exactly that block — quote those, not the
  whole document.
