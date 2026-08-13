---
name: read-better
description: Read work-tool file formats efficiently — Jira/Confluence ADF, Figma files, OpenAPI/Postman, Playwright a11y snapshots, big JSON/YAML. Use whenever a file or API response would cost many tokens to read raw - render documents, outline data, then fetch only the part you need.
---

# read-better — token-efficient reading of work-tool formats

Never read rich formats raw: ADF costs 5×+ the tokens of markdown; a big
JSON/YAML dump costs 50×+ the tokens of its outline.

## Commands (from this repo: `node src/cli.js …`; installed: `read-better …`)

```bash
curl -s … | read-better render -        # document → compact view (auto-detects)
read-better outline big.json            # data → SHAPE, not values
read-better get big.json /users/3/role  # then fetch exactly what you need
read-better detect file                 # unsure? ask first
```

Documents: ADF (bare docs, Jira issue payloads, Confluence v2 bodies),
`.md`, Figma file JSON, OpenAPI/Postman, Playwright a11y YAML.
Data: generic JSON/YAML. `-` = stdin; `--format <id>` overrides detection.

## Rules of thumb

- Fetching a Jira issue? Pipe it through `read-better render -` before
  reasoning about it.
- Handed a large JSON/YAML file? `outline` first, `get` the pointer you
  need. Never page through raw dumps.
- Reading a design or API surface? `render` a Figma file or OpenAPI spec —
  you get the outline, not the vector soup.
- Comparing two versions of anything? That's not this tool — use
  `what-changed diff a b`, which consumes these blocks and reports
  block-level deltas.
