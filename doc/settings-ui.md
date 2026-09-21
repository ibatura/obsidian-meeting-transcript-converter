# Settings UI Specification

Source: `src/ui/settingsTab.ts`

## Overview

The plugin provides a settings tab accessible via **Settings → Community plugins → Meeting Transcript to Markdown Converter**. The tab is implemented as `TranscriptSettingTab`, extending Obsidian's `PluginSettingTab`.

## Settings Controls

Settings are rendered top-to-bottom in the following order:

### 1. Output Folder

| Property    | Value                                                          |
|-------------|----------------------------------------------------------------|
| Type        | Text input                                                     |
| Label       | "Output Folder"                                                |
| Description | "The vault folder where converted markdown files will be saved." |
| Placeholder | `Transcripts`                                                  |
| Binding     | `settings.outputFolder`                                        |

Accepts any vault-relative folder path. The folder is created automatically during conversion if it doesn't exist.

### 2. Watch Folder

| Property    | Value                                                          |
|-------------|----------------------------------------------------------------|
| Type        | Text input                                                     |
| Label       | "Watch folder"                                                 |
| Description | "Folder to watch for new .txt/.vtt files (empty = whole vault)" |
| Placeholder | `Transcripts`                                                  |
| Binding     | `settings.watchFolder`                                         |

The value is trimmed on change. An empty value means the entire vault is watched.

### 3. Auto-Convert Toggle

| Property    | Value                                                          |
|-------------|----------------------------------------------------------------|
| Type        | Toggle                                                         |
| Label       | "Auto-convert new transcripts"                                 |
| Description | "Automatically convert new .txt/.vtt files in the watched folder" |
| Binding     | `settings.autoConvertEnabled`                                  |

### 4. Delete Original Toggle

| Property    | Value                                                          |
|-------------|----------------------------------------------------------------|
| Type        | Toggle                                                         |
| Label       | "Delete original file after convert"                           |
| Description | "Remove the source .txt/.vtt file after the .md file is created" |
| Binding     | `settings.deleteOriginalAfterConvert`                          |

### 5. Note Name Order

| Property    | Value                                                          |
|-------------|----------------------------------------------------------------|
| Type        | Dropdown                                                       |
| Label       | "Note name order"                                              |
| Description | "Whether the converted note's name starts with the meeting date or the meeting name" |
| Options     | `date-first` → "Date, then meeting name"; `name-first` → "Meeting name, then date" |
| Binding     | `settings.fileNameOrder`                                       |

Decides which of the two parts leads the note's file name. Defaults to `date-first`.

### 6. Note Name Date Format

| Property    | Value                                                          |
|-------------|----------------------------------------------------------------|
| Type        | Text input                                                     |
| Label       | "Note name date format"                                        |
| Description | "Date format used in the note's name (moment.js). Leave empty to name notes by meeting name alone. Default: YYYY-MM-DD" |
| Placeholder | `YYYY-MM-DD`                                                   |
| Binding     | `settings.fileNameDateFormat`                                  |

Accepts any Moment.js format string; `DD.MM.YYYY` and `YYYY-MM-DD HH-mm` both work. An empty value drops the date from the name entirely. Characters that cannot appear in a file name (`/ \ : * ? " < > |`) are replaced with a hyphen after formatting, so `YYYY/MM/DD` yields `2026-04-05` rather than a folder path.

This setting governs only the note's file name. Timestamps inside the note are governed by "Time format" below.

### 7. Time Format

| Property    | Value                                                          |
|-------------|----------------------------------------------------------------|
| Type        | Text input                                                     |
| Label       | "Time format"                                                  |
| Description | "Timestamp format for bulleted caption lines (moment.js). Default: YYYY-MM-DD HH:mm:ss. Speaker lines from Teams and Zoom transcripts always use YYYY-MM-DD HH:mm:ss." |
| Placeholder | `YYYY-MM-DD HH:mm:ss`                                         |
| Binding     | `settings.timeFormat`                                          |

Accepts any Moment.js format string. Common examples: `HH:mm:ss`, `hh:mm A`, `YYYY-MM-DD HH:mm`.

## Persistence

Every setting change triggers `plugin.saveSettings()` immediately via the `onChange` callback. There is no explicit "Save" button — all changes are auto-saved.

## Rendering

The `display()` method calls `containerEl.empty()` before rendering to ensure a clean slate when the settings tab is re-opened or refreshed.

## Constructor

```ts
constructor(app: App, plugin: TranscriptToMdPlugin)
```

The tab receives the plugin instance to access and mutate `plugin.settings` and call `plugin.saveSettings()`.
