# Settings UI Specification

Source: `src/ui/settingsTab.ts`

## Overview

The plugin provides a settings tab accessible via **Settings → Community plugins → Transcript to Markdown**. The tab is implemented as `TranscriptSettingTab`, extending Obsidian's `PluginSettingTab`.

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

### 5. Time Format

| Property    | Value                                                          |
|-------------|----------------------------------------------------------------|
| Type        | Text input                                                     |
| Label       | "Time format"                                                  |
| Description | "Moment.js format for the timestamp of the transcript. Default: HH:mm:ss DD:MM:YYYY" |
| Placeholder | `HH:mm:ss DD:MM:YYYY`                                         |
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
