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
}
```

### Field Specifications

| Field                        | Type      | Default                   | Constraints                                      |
|------------------------------|-----------|---------------------------|--------------------------------------------------|
| `outputFolder`               | `string`  | `"Transcripts"`           | Vault-relative path. Created automatically if missing. |
| `watchFolder`                | `string`  | `"Transcripts"`           | Vault-relative path. Empty string means watch entire vault. |
| `autoConvertEnabled`         | `boolean` | `false`                   | Must be explicitly enabled by user.               |
| `deleteOriginalAfterConvert` | `boolean` | `false`                   | Only deletes after successful conversion.         |
| `timeFormat`                 | `string`  | `"HH:mm:ss DD:MM:YYYY"`  | Any valid Moment.js format token string.          |

## Default Settings

Defined in `src/settings.ts`:

```ts
const DEFAULT_SETTINGS: TranscriptPluginSettings = {
  outputFolder: "Transcripts",
  watchFolder: "Transcripts",
  autoConvertEnabled: false,
  deleteOriginalAfterConvert: false,
  timeFormat: "HH:mm:ss DD:MM:YYYY"
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
| Location       | `{outputFolder}/{originalBaseName}.md`     |
| Title          | `# {basename with underscores replaced by spaces}` |
| TXT content    | Trimmed non-empty lines joined by newlines |
| VTT content    | Bulleted list with optional timestamps     |
| Overwrite      | Yes — existing `.md` at same path is updated in place |

## Internal Data Structures

### VTT Parsing Block (in `converters.ts`)

During VTT conversion, cue blocks are accumulated into an intermediate structure:

```ts
{ timeOffset?: number; text: string[] }[]
```

Each block has an optional `timeOffset` (milliseconds from file start) and an array of text lines that get joined with spaces into a single bullet point.

The final timestamp displayed is computed as `fileCreationTime + timeOffset`, formatted with the user's `timeFormat` setting via `moment()`.
