# Data Model

## Core Types

All shared types are defined in `src/types.ts`.

### `TranscriptPluginSettings`

The single settings interface used across the entire plugin.

```ts
interface TranscriptPluginSettings {
  outputFolder: string;                // Vault-relative path for output .md files
  watchFolder: string;                 // Vault-relative path to watch for new transcripts
  autoConvertEnabled: boolean;         // Whether the file watcher triggers conversion
  deleteOriginalAfterConvert: boolean; // Remove source file after successful conversion
  timeFormat: string;                  // Moment.js format string for VTT timestamps
  fileNameOrder: FileNameOrder;        // Whether the note's name leads with the date or the meeting name
  fileNameDateFormat: string;          // Moment.js format string for the date in the note's name
}

type FileNameOrder = "date-first" | "name-first";
```

### Field Specifications

| Field                        | Type      | Default                   | Constraints                                      |
|------------------------------|-----------|---------------------------|--------------------------------------------------|
| `outputFolder`               | `string`  | `"Transcripts"`           | Vault-relative path. Created automatically if missing. |
| `watchFolder`                | `string`  | `"Transcripts"`           | Vault-relative path. Empty string means watch entire vault. |
| `autoConvertEnabled`         | `boolean` | `false`                   | Must be explicitly enabled by user.               |
| `deleteOriginalAfterConvert` | `boolean` | `false`                   | Only deletes after successful conversion.         |
| `timeFormat`                 | `string`  | `"YYYY-MM-DD HH:mm:ss"`  | Any valid Moment.js format token string. Empty string omits timestamps. |
| `fileNameOrder`              | `"date-first" \| "name-first"` | `"date-first"` | Position of the date relative to the meeting name in the note's file name. |
| `fileNameDateFormat`         | `string`  | `"YYYY-MM-DD"`            | Any valid Moment.js format token string. Empty string names the note by meeting name alone. |

## Default Settings

Defined in `src/settings.ts`:

```ts
const DEFAULT_SETTINGS: TranscriptPluginSettings = {
  outputFolder: "Transcripts",
  watchFolder: "Transcripts",
  autoConvertEnabled: false,
  deleteOriginalAfterConvert: false,
  timeFormat: "YYYY-MM-DD HH:mm:ss",
  fileNameOrder: "date-first",
  fileNameDateFormat: "YYYY-MM-DD"
};
```

## Persistence

Settings are persisted via Obsidian's built-in `Plugin.loadData()` / `Plugin.saveData()` methods, which store a JSON file at:

```
<vault>/.obsidian/plugins/meeting-transcript-converter/data.json
```

On load, saved values are merged over defaults using `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())`. This means new settings added in future versions automatically get their default values for existing users.

## Data Flow

### Manual Conversion

```
User activates command
  → getActiveFile()
  → validate extension (.txt or .vtt)
  → vault.read(file) → raw content string
  → converter function → markdown string
  → prepend "# {title}" header
  → ensure outputFolder exists (vault.createFolder if needed)
  → vault.create or vault.modify → .md file in outputFolder
  → Notice to user
```

### Auto-Conversion (File Watcher)

```
vault "create" event fires
  → check autoConvertEnabled === true
  → check file instanceof TFile
  → check extension is .txt or .vtt
  → check file.path starts with watchFolder (if set)
  → convertTranscript(file, showNotice=false)
  → if deleteOriginalAfterConvert → vault.delete(original)
```

## Input / Output Contracts

### Input Files

| Format | Extension | Expected Structure                                    |
|--------|-----------|------------------------------------------------------|
| TXT    | `.txt`    | Plain text, one line per paragraph/sentence          |
| VTT    | `.vtt`    | WebVTT format with optional WEBVTT header, sequence numbers, timestamps, and cue text |

### Output Files

| Property       | Value                                      |
|----------------|--------------------------------------------|
| Format         | Markdown (`.md`)                           |
| Location       | `{outputFolder}/{noteName}.md`, where `noteName` is the meeting date and the meeting name joined by a space in the order `fileNameOrder` sets |
| Title          | `# {meetingName}` — the basename with any leading date stripped, underscores replaced by spaces and words capitalised, or `Untitled Meeting` |
| TXT content    | Trimmed non-empty lines joined by newlines |
| VTT content    | Bulleted list with optional timestamps, or speaker-attributed turns for voice-tagged (Teams) transcripts |
| Overwrite      | Only when the existing note's `source` property names this same transcript — see Name collisions below |

Characters that cannot appear in a file name (`/ \ : * ? " < > |`) are replaced with a hyphen after the name is assembled, so a `fileNameDateFormat` containing slashes cannot produce a folder path.

### Note Properties

Every converted note opens with a properties block:

| Property       | Value                                                     |
|----------------|-----------------------------------------------------------|
| `meeting_name` | The derived meeting name                                  |
| `date`         | The meeting date, always `YYYY-MM-DD`                     |
| `source`       | Vault path of the transcript the note was converted from  |
| `duration`     | Present when a duration could be derived                  |
| `participants` | Present when speakers could be identified                 |

`source` is the note's identity. A later conversion reads it to tell a note it wrote itself from a note belonging to a different meeting.

### Name Collisions

| Situation                                                        | Result                                             |
|------------------------------------------------------------------|----------------------------------------------------|
| No note at the composed name                                      | Created                                            |
| Note exists, its `source` names this transcript                   | Overwritten — re-conversion updates in place       |
| Note exists, its `source` names a different transcript, is absent, or the note cannot be read | The meeting's time (`HH-mm-ss`) is appended to the name and the note is written there |
| The time-suffixed name is also taken                              | Overwritten — two meetings starting the same second are treated as one |

Notes converted before this scheme existed are not renamed; they keep their old names and a new note is created alongside on the next conversion.

## Internal Data Structures

### VTT Parsing Block (in `converters.ts`)

During VTT conversion, cue blocks are accumulated into an intermediate structure:

```ts
{ timeOffset?: number; text: string[] }[]
```

Each block has an optional `timeOffset` (milliseconds from file start) and an array of text lines that get joined with spaces into a single bullet point.

The final timestamp displayed is computed as `fileCreationTime + timeOffset`, formatted with the user's `timeFormat` setting via `moment()`.
