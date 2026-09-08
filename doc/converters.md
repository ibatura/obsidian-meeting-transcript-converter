# Converter Specifications

Source: `src/utils/converters.ts`

This module contains pure, stateless functions responsible for transforming raw transcript content into Markdown. These functions have no side effects and do not interact with the Obsidian API (except `moment` for time formatting).

Two `.vtt` dialects are supported. Plain caption files (Zoom and most caption tools) render as a bulleted list; speaker-attributed files (Microsoft Teams) render in the same speaker-per-turn layout as Zoom `.txt` transcripts. `detectVttDialect` chooses between them; `src/commands/convertTranscript.ts` performs the dispatch.

---

## `convertTxtToMarkdown`

### Signature

```ts
function convertTxtToMarkdown(
  content: string,
  _timeFormat: string,
  fileCreationTime: number
): string
```

### Purpose

Cleans a Zoom-style plain text transcript and dates its speaker headers.

### Algorithm

1. Split input on line breaks (`\r?\n`).
2. Trim each line; drop empty lines.
3. Rewrite each header line matching `^\[(.+?)\]\s+(\d{2}:\d{2}:\d{2})` as `[{speaker}] {date} {time}`, where `{date}` is `fileCreationTime` formatted `YYYY-MM-DD`.
4. Pass all other lines through unchanged.
5. Join with `\n`.

`_timeFormat` is accepted only to match the VTT converter signature. TXT timestamps are already wall-clock times, so only the date is prepended.

### Example

| Input                              | Output                                     |
|------------------------------------|--------------------------------------------|
| `[Yulia Vovk] 20:30:11\nHello.`   | `[Yulia Vovk] 2023-11-14 20:30:11\nHello.` |

---

## `parseVttCues`

### Signature

```ts
interface VttCue {
  offsetMs?: number;
  speaker?: string;
  text: string;
}

function parseVttCues(content: string): VttCue[]
```

### Purpose

Shared VTT reader. Both `.vtt` converters and `extractParticipants` build on it, so parsing rules live in exactly one place.

### Algorithm

1. Split input on line breaks and walk it line by line.
2. Skip the `WEBVTT` header and any `NOTE` block (from a line matching `^NOTE(\s|$)` to the next blank line).
3. A blank line closes the current cue.
4. A timestamp line (`^(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->`) closes the current cue and opens a new one, its `offsetMs` parsed by `parseVttTimeOffset`.
5. A line that opens a cue block and is followed by a timestamp line is a **cue identifier** and is discarded. This covers plain sequence numbers (`1`, `2`, …) and the `{guid}/{n}-{n}` identifiers Microsoft Teams emits.
6. All other lines accumulate as the cue's text, joined with spaces.
7. On close, a leading `<v Name>` voice tag (optionally classed, e.g. `<v.loud Name>`) becomes the cue's `speaker`; every remaining tag — `</v>`, `<c.classname>`, `<i>`, karaoke timestamps like `<00:00:01.500>` — is replaced by a space, and whitespace is collapsed. Cues whose text is empty after stripping are dropped.

### Notes

- Cue order is preserved as written. Teams interleaves overlapping speakers; no re-ordering is performed.
- Text appearing before any timestamp is kept as a cue with no `offsetMs`.

---

## `detectVttDialect`

### Signature

```ts
function detectVttDialect(content: string): "speaker" | "plain"
```

### Purpose

Identifies whether a `.vtt` transcript names its speakers.

Returns `"speaker"` when any cue carries a voice-tag speaker (Microsoft Teams), otherwise `"plain"`. Detection reads content only — never the filename or folder — so a Teams export is recognised however it was saved.

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

Renders a plain caption VTT file as a bulleted Markdown list with optional timestamps.

### Algorithm

1. Read cues via `parseVttCues`.
2. For each cue:
   - If `timeFormat` is non-empty and the cue has an `offsetMs`: `- **[{formattedTime}]** {text}`
   - Otherwise: `- {text}`
3. Join with `\n`.

### Timestamp Calculation

```
absoluteTime = fileCreationTime + offsetMs
formattedTime = moment(absoluteTime).format(timeFormat)
```

Where `fileCreationTime` is a date parsed from the filename when present, otherwise the file's `stat.ctime` (milliseconds since epoch). See `extractDateFromBasename` in `src/commands/convertTranscript.ts`.

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

### Input Format Reference

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

---

## `convertTeamsVttToMarkdown`

### Signature

```ts
function convertTeamsVttToMarkdown(
  content: string,
  _timeFormat: string,
  fileCreationTime: number
): string
```

### Purpose

Renders a speaker-attributed VTT file (Microsoft Teams) in the same layout `convertTxtToMarkdown` produces for Zoom transcripts: a speaker-and-timestamp line followed by the words spoken.

### Algorithm

1. Read cues via `parseVttCues`.
2. Group cues into turns: consecutive cues sharing a `speaker` merge into one turn, their text joined with spaces, the turn keeping the **first** cue's `offsetMs`. Any change of speaker — including to a cue with no speaker — opens a new turn.
3. Emit each turn as:
   - `[{speaker}] {formattedTime}` then the turn's text on the next line;
   - the text alone when the turn has no speaker.
4. Join with `\n`. Turns are not separated by blank lines, matching the TXT converter.

Timestamps use the same `fileCreationTime + offsetMs` rule as `convertVttToMarkdown`, but the format is **fixed** at `YYYY-MM-DD HH:mm:ss`. `_timeFormat` is accepted only for signature parity and is ignored, exactly as in `convertTxtToMarkdown` — the point of this layout is that a Teams note reads identically to a Zoom note, which also hardcodes its date format. The `timeFormat` setting still governs the bulleted `convertVttToMarkdown` output.

### Input Format Reference

```
WEBVTT

2eb325bb-1b35-4dac-b37b-c7a00c2a68d3/154-0
00:00:12.010 --> 00:00:12.690
<v Kateryna Tymofeieva>Hey!</v>

2eb325bb-1b35-4dac-b37b-c7a00c2a68d3/154-1
00:00:14.440 --> 00:00:16.080
<v Kateryna Tymofeieva>One second,</v>

2eb325bb-1b35-4dac-b37b-c7a00c2a68d3/158-0
00:00:17.370 --> 00:00:18.610
<v Ivan Batura>Yeah, I was mute.</v>
```

### Output Example

With a meeting starting `2026-07-31 19:31:00`:

```markdown
[Kateryna Tymofeieva] 2026-07-31 19:31:12
Hey! One second,
[Ivan Batura] 2026-07-31 19:31:17
Yeah, I was mute.
```

---

## `extractParticipants`

### Signature

```ts
function extractParticipants(content: string, format: "vtt" | "txt"): string[]
```

Returns a de-duplicated, alphabetically sorted list of speakers for the note's `participants` property.

| Format | Rule |
|--------|------|
| `txt`  | Names in `[Name] HH:mm:ss` header lines |
| `vtt`  | Voice-tag speakers via `parseVttCues` when the transcript has any; otherwise a `Name: ` heuristic on cue text, ignoring names over 40 characters and lines starting with `http`, `note` or `todo` |

Voice tags take priority because the `Name: ` heuristic would otherwise read ordinary sentences containing a colon as speakers.

---

## `extractDuration`

### Signature

```ts
function extractDuration(content: string, format: "vtt" | "txt"): string | null
```

Returns `HH:MM:SS`, or `null` when the transcript carries too few timestamps.

| Format | Rule |
|--------|------|
| `txt`  | Difference between the first and last `[Name] HH:mm:ss` header times, wrapping across midnight |
| `vtt`  | The largest cue end time, which is the meeting length by construction |

---

## Known Limitations

- HTML entities in cue text (`&amp;`, `&lt;`, `&nbsp;`) are not decoded.
- Adjacent cues carrying repeated text are not de-duplicated.
- Multi-line cues are collapsed into a single line (joined by spaces).

---

## Dependencies

| Import        | Source      | Usage                           |
|---------------|-------------|---------------------------------|
| `moment`      | `obsidian`  | Timestamp formatting in VTT and TXT conversion |
