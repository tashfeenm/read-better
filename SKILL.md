---
name: read-better
description: Read rich work-tool formats (Jira descriptions/comments, Confluence pages — ADF JSON) efficiently. Use whenever an API or MCP tool returns {"type":"doc",...} — render it to markdown instead of reading raw JSON.
---

# read-better — token-efficient reading of work-tool formats

Rich text from Jira/Confluence APIs arrives as ADF: nested JSON that costs
5×+ the tokens of the equivalent markdown. Never read it raw.

## Commands (from this repo: `node src/cli.js …`; installed: `read-better …`)

```bash
curl -s … | read-better render -   # → compact markdown; read this, not the JSON
read-better parse doc.json         # → typed blocks with stable IDs (programmatic)
```

Accepts bare ADF, Jira issue payloads, Confluence v2 bodies; `-` = stdin.

## Rules of thumb

- Fetching a Jira issue? Pipe `fields.description` through
  `read-better render -` before reasoning about it.
- Need to reference one part of a document? Use `parse` — block IDs are
  content-stable (moves keep them, edits change them).
- Comparing two versions? That's not this tool — use `what-changed diff`,
  which consumes these blocks and reports block-level deltas.
