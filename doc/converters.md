# Converter Specifications

Source: `src/utils/converters.ts`

This module contains pure, stateless functions responsible for transforming raw transcript content into Markdown. These functions have no side effects and do not interact with the Obsidian API (except `moment` for time formatting).

---

## `convertTxtToMarkdown`

### Signature

```ts
function convertTxtToMarkdown(content: string): string
```

### Purpose

Cleans plain text transcript content by trimming whitespace and removing empty lines.

### Algorithm

1. Split input on line breaks (`\r?\n`).
2. Trim each line.
3. Filter out empty lines.
4. Join remaining lines with `\n`.

### Examples

| Input                          | Output              |
|--------------------------------|---------------------|
| `"  hello world  \n"`          | `"hello world"`     |
| `"line1\n\nline2\n"`          | `"line1\nline2"`    |
| `"   \n  \t "`                | `""`                |

### Notes

This is intentionally minimal. Future enhancements could add speaker label detection, paragraph grouping, or heading insertion.

---

## `convertVttToMarkdown`

### Signature

```ts
function convertVttToMarkdown(
  content: string,
  timeFormat: string,
  fileCreationTime: number
): string
```

### Purpose

Parses WebVTT subtitle/caption content into a bulleted Markdown list with optional timestamps.

### Algorithm

1. Split input on line breaks.
2. Iterate lines, skipping:
   - Empty lines
   - Lines matching `^WEBVTT` (header)
   - Lines matching `^\d+$` (sequence numbers)
3. When a timestamp line is encountered (matches `^(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s-->`):
   - Push any accumulated block to the blocks array.
   - Parse the start time into a millisecond offset via `parseVttTimeOffset`.
   - Start a new block with `{ timeOffset, text: [] }`.
4. All other non-empty lines are pushed to the current block's `text` array.
5. After iteration, push any remaining block.
6. For each block, join text lines with spaces into a single string.
7. Format output:
   - If `timeFormat` is non-empty and block has a `timeOffset`: `- **[{formattedTime}]** {text}`
   - Otherwise: `- {text}`

### Timestamp Calculation

```
absoluteTime = fileCreationTime + timeOffset
formattedTime = moment(absoluteTime).format(timeFormat)
```

Where `fileCreationTime` is the file's `stat.ctime` (milliseconds since epoch).

### VTT Time Parsing (`parseVttTimeOffset`)

```ts
function parseVttTimeOffset(vttTime: string): number
```

Accepts VTT timestamp strings in two formats:

| Format             | Example          | Parsing                               |
|--------------------|------------------|---------------------------------------|
| `HH:MM:SS.mmm`    | `01:23:45.678`   | hours×3600 + minutes×60 + seconds.ms  |
| `MM:SS.mmm`        | `23:45.678`      | minutes×60 + seconds.ms               |

Returns: offset in **milliseconds** (seconds × 1000).

### VTT Input Format Reference

A standard WebVTT file:

```
WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello this is the first line
It has a second part

2
00:00:05.000 --> 00:00:10.000
Second cue block here
```

### Output Examples

With `timeFormat = ""` (timestamps disabled):

```markdown
- Hello this is the first line It has a second part
- Second cue block here
```

With `timeFormat = "HH:mm:ss"` and `fileCreationTime = 1700000000000`:

```markdown
- **[06:46:41]** Hello this is the first line It has a second part
- **[06:46:45]** Second cue block here
```

### Known Limitations

- Voice tags (`<v Speaker>...</v>`) are **not** currently stripped. They pass through as raw text in the output.
- No deduplication of repeated cue text across adjacent blocks.
- Multi-line cues are collapsed into a single line (joined by spaces).

---

## Dependencies

| Import        | Source      | Usage                           |
|---------------|-------------|---------------------------------|
| `moment`      | `obsidian`  | Timestamp formatting in VTT conversion |

