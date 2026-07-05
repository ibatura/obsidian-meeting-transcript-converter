# Software Design Document: Transcript to Markdown Plugin

## 1. Overview
The "Transcript to Markdown" plugin is an Obsidian community plugin designed to convert existing `.txt` or `.vtt` transcript files stored within the vault into cleaned `.md` notes. 

The plugin provides a command to convert the currently active transcript file and saves the output in a user-configurable vault folder (default: `Transcripts`).

## 2. Architecture & File Structure
Following Obsidian plugin best practices, the plugin logic will be distributed across multiple focused modules rather than being centralized in `main.ts`.

```text
src/
  main.ts               # Minimal entry point, plugin lifecycle (onload, onunload)
  settings.ts           # Default settings and settings management
  types.ts              # Interface definitions (e.g., PluginSettings)
  commands/
    convertTranscript.ts # Command registration and execution logic
  utils/
    converters.ts       # Text and VTT parsing and conversion logic
  ui/
    settingsTab.ts      # Plugin settings UI
```

## 3. Component Details

### 3.1 `src/types.ts`
Defines the core data structures used across the plugin.
- `TranscriptPluginSettings`: Interface defining user preferences (e.g., `outputFolder`).

### 3.2 `src/settings.ts`
Manages the default configuration.
- `DEFAULT_SETTINGS`: Constant holding default values (`outputFolder: "Transcripts"`).

### 3.3 `src/utils/converters.ts`
Pure functions for converting transcript formats to Markdown.
- `convertTxtToMarkdown(content: string): string`: Returns raw transcript text (extensible for future features).
- `convertVttToMarkdown(content: string): string`: Parses `.vtt` format, strips `WEBVTT` headers, timestamps, and indexes, returning bulleted Markdown strings.

### 3.4 `src/commands/convertTranscript.ts`
Handles the core business logic of the plugin.
- `registerConvertCommand(plugin: TranscriptToMdPlugin)`: Registers the editor command.
- `convertTranscript(file: TFile, plugin: TranscriptToMdPlugin)`: 
  1. Validates the file extension.
  2. Reads file contents.
  3. Calls appropriate converter from `converters.ts`.
  4. Ensures the target output folder exists.
  5. Writes or overwrites the `.md` file in the target folder.
  6. Displays a success or error `Notice`.

### 3.5 `src/ui/settingsTab.ts`
- `TranscriptSettingTab`: Extends `PluginSettingTab` to provide a UI in Obsidian settings for users to specify their target `outputFolder`.

### 3.6 `src/main.ts`
The plugin entry point. Kept minimal.
- `TranscriptToMdPlugin`: Extends `Plugin`.
- Responsible for:
  - Loading and saving data (`loadSettings`, `saveSettings`).
  - Registering the settings tab.
  - Delegating command registration to `commands/convertTranscript.ts`.

## 4. Implementation Plan

**Phase 1: Project Setup**
1. Initialize the project using the Obsidian sample plugin template structure.
2. Update `manifest.json` with appropriate metadata (`id: zoom-transcript-to-md`, `isDesktopOnly: true`).
3. Set up the `src/` directory structure.

**Phase 2: Core Types and Settings**
1. Implement `src/types.ts` and `src/settings.ts`.
2. Implement the `TranscriptSettingTab` in `src/ui/settingsTab.ts`.

**Phase 3: Conversion Logic**
1. Implement text parsing functions in `src/utils/converters.ts`.
2. Add comprehensive error handling for malformed VTT files if necessary.

**Phase 4: Command and File System Interactivity**
1. Implement `src/commands/convertTranscript.ts`.
2. Ensure interactions with Obsidian's `Vault` API (`read`, `create`, `modify`, `createFolder`) are robust and handle edge cases (e.g., folder already exists).

**Phase 5: Plugin Lifecycle Integration**
1. Hook all components together in `src/main.ts`.
2. Test end-to-end functionality within a sample Obsidian vault.

## 5. Security & Performance Considerations
- **Offline First**: All processing happens locally on the user's machine. No external API calls are made.
- **File System Safety**: The plugin only modifies files within the target output folder and explicitly targets `.md` creation based on `.txt`/`.vtt` inputs.
- **Memory**: The plugin uses async vault reads, ensuring the UI is not blocked during large transcript conversions.
