// Strict-reject YAML subset parser. Zero dependencies by covering the YAML
// that config files and Playwright snapshots actually use — and REJECTING,
// with a named construct, anything where guessing could misparse silently:
// anchors/aliases, tags, directives, multi-document streams, flow
// collections at value start, tab indentation, ambiguous plain scalars.
// Never guesses. If real-world rejection rates prove high, promoting a real
// YAML dependency is a product decision, not an architecture change.

export class YamlSubsetError extends Error {
  constructor(construct, line, lineNo) {
    super(`YAML ${construct} is outside the supported subset (line ${lineNo}: ${JSON.stringify(line.trim().slice(0, 60))}). Convert the file or pass a supported format.`);
    this.construct = construct;
  }
}

export function parseYaml(text) {
  const raw = String(text).replace(/\r\n/g, '\n').split('\n');
  const lines = [];
  for (let n = 0; n < raw.length; n++) {
    const line = raw[n];
    if (/^\t/.test(line)) throw new YamlSubsetError('tab indentation', line, n + 1);
    if (/^%/.test(line)) throw new YamlSubsetError('directives (%)', line, n + 1);
    if (/^(---|\.\.\.)\s*$/.test(line)) throw new YamlSubsetError('multi-document markers', line, n + 1);
    const stripped = stripComment(line);
    if (!stripped.trim()) continue;
    lines.push({ text: stripped, indent: stripped.match(/^ */)[0].length, no: n + 1 });
  }
  if (!lines.length) return null;
  // Root that is neither a sequence nor a mapping is a bare scalar document
  // (e.g. prose). Return it as a string — detection will refuse non-structured
  // roots, and that's the right refusal (not a "subset" error).
  const firstTrim = lines[0].text.trim();
  if (!/^- ?/.test(firstTrim) && splitKey(firstTrim) === null) {
    return text;
  }
  const [value, next] = parseNode(lines, 0, lines[0].indent);
  if (next !== lines.length) {
    const stray = lines[next];
    throw new YamlSubsetError('inconsistent indentation', stray.text, stray.no);
  }
  return value;
}

function parseNode(lines, i, indent) {
  const line = lines[i];
  if (line.indent !== indent) throw new YamlSubsetError('inconsistent indentation', line.text, line.no);
  if (/^- ?/.test(line.text.trim())) return parseSequence(lines, i, indent);
  return parseMapping(lines, i, indent);
}

function parseSequence(lines, i, indent) {
  const out = [];
  while (i < lines.length && lines[i].indent === indent && /^- ?/.test(lines[i].text.trim())) {
    const line = lines[i];
    const rest = line.text.trim().replace(/^- ?/, '');
    const itemIndent = indent + 2; // dash + space

    if (!rest) {
      // "-" alone: nested node on following deeper lines
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const [value, next] = parseNode(lines, i + 1, lines[i + 1].indent);
        out.push(value);
        i = next;
      } else {
        out.push(null);
        i += 1;
      }
      continue;
    }

    const kv = splitKey(rest);
    if (kv) {
      // "- key: value" — an inline map item; siblings continue at itemIndent
      const synthetic = { text: ' '.repeat(itemIndent) + rest, indent: itemIndent, no: line.no };
      const following = [];
      let j = i + 1;
      while (j < lines.length && lines[j].indent >= itemIndent) { following.push(lines[j]); j += 1; }
      const sub = [synthetic, ...following];
      const [value, consumed] = parseMapping(sub, 0, itemIndent);
      if (consumed !== sub.length) {
        const stray = sub[consumed];
        throw new YamlSubsetError('inconsistent indentation', stray.text, stray.no);
      }
      out.push(value);
      i = j;
      continue;
    }

    out.push(parseScalar(rest, line));
    i += 1;
  }
  return [out, i];
}

function parseMapping(lines, i, indent) {
  const out = {};
  while (i < lines.length && lines[i].indent === indent) {
    const line = lines[i];
    const trimmed = line.text.trim();
    if (/^- ?/.test(trimmed)) break;
    const kv = splitKey(trimmed);
    if (!kv) throw new YamlSubsetError('non-mapping content at mapping level', line.text, line.no);
    const [key, rawValue] = kv;
    if (key in out) throw new YamlSubsetError(`duplicate key "${key}"`, line.text, line.no);

    if (rawValue === '' || rawValue === null) {
      // "key:" — nested block or null. YAML quirk: a nested SEQUENCE may sit
      // at the SAME indent as its parent key (a mapping entry can never start
      // with "- ", so ownership is unambiguous).
      const next = lines[i + 1];
      const ownsDeeper = next && next.indent > indent;
      const ownsSameIndentSeq = next && next.indent === indent && /^- ?/.test(next.text.trim());
      if (ownsDeeper || ownsSameIndentSeq) {
        const [value, consumed] = parseNode(lines, i + 1, next.indent);
        out[key] = value;
        i = consumed;
      } else {
        out[key] = null;
        i += 1;
      }
      continue;
    }

    const literal = rawValue.match(/^([|>])(-?)\s*$/);
    if (literal) {
      const [value, next] = parseBlockLiteral(lines, i + 1, indent, literal[1], literal[2] === '-');
      out[key] = value;
      i = next;
      continue;
    }

    out[key] = parseScalar(rawValue, line);
    i += 1;
  }
  return [out, i];
}

function parseBlockLiteral(lines, i, parentIndent, style, strip) {
  const body = [];
  let blockIndent = null;
  while (i < lines.length && lines[i].indent > parentIndent) {
    blockIndent ??= lines[i].indent;
    body.push(lines[i].text.slice(blockIndent));
    i += 1;
  }
  let text = style === '|' ? body.join('\n') : body.join(' ').replace(/\s+/g, ' ');
  if (!strip) text += '\n';
  return [text, i];
}

/** Split "key: value" | "key:" at the FIRST ": " (or trailing ":"). Returns
 *  [key, value|''] or null if the line is not a mapping entry. */
function splitKey(text) {
  const colonSpace = text.indexOf(': ');
  if (colonSpace > 0) {
    return [unquoteKey(text.slice(0, colonSpace)), text.slice(colonSpace + 2).trim()];
  }
  if (text.endsWith(':')) return [unquoteKey(text.slice(0, -1)), ''];
  return null;
}

function unquoteKey(key) {
  const trimmed = key.trim();
  const quoted = trimmed.match(/^"(.*)"$|^'(.*)'$/);
  return quoted ? (quoted[1] ?? quoted[2]) : trimmed;
}

function parseScalar(s, line) {
  const first = s[0];
  if (first === '&') throw new YamlSubsetError('anchors (&)', line.text, line.no);
  if (first === '*') throw new YamlSubsetError('aliases (*)', line.text, line.no);
  if (first === '!') throw new YamlSubsetError('tags (!)', line.text, line.no);
  if (first === '[' || first === '{') throw new YamlSubsetError('flow collections at value start', line.text, line.no);
  if (first === '@' || first === '`') throw new YamlSubsetError(`reserved indicator (${first})`, line.text, line.no);

  const dq = s.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (dq) return dq[1].replace(/\\(["\\/nrt])/g, (_, c) => ({ '"': '"', '\\': '\\', '/': '/', n: '\n', r: '\r', t: '\t' }[c]));
  const sq = s.match(/^'((?:[^']|'')*)'$/);
  if (sq) return sq[1].replaceAll("''", "'");
  if (first === '"' || first === "'") throw new YamlSubsetError('unterminated or trailing-content quoted scalar', line.text, line.no);

  // Ambiguity guard: a plain scalar containing ": " could be a misindented
  // mapping — reject rather than guess. (":" without a space, e.g. URLs, is fine.)
  if (s.includes(': ')) throw new YamlSubsetError('ambiguous plain scalar containing ": "', line.text, line.no);

  // Typing allowlist — everything else stays a string.
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return Number.parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return Number.parseFloat(s);
  return s;
}

/** Strip a trailing comment (a " #" outside quotes). */
function stripComment(line) {
  if (/^\s*#/.test(line)) return '';
  let inSingle = false;
  let inDouble = false;
  for (let idx = 0; idx < line.length; idx++) {
    const ch = line[idx];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && line[idx - 1] !== '\\') inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble && /\s/.test(line[idx - 1] ?? ' ')) {
      return line.slice(0, idx).trimEnd();
    }
  }
  return line;
}
