# Architecture

## Overview

**Meeting Transcript to Markdown Converter** is an Obsidian community plugin that converts `.txt` and `.vtt` transcript files into cleaned `.md` notes. It runs entirely offline — all processing happens locally inside the user's vault.

The plugin is **desktop-only** (`isDesktopOnly: true`) and is built with TypeScript, bundled by esbuild into a single `main.js` file loaded by Obsidian at runtime.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Obsidian Host App                     │
│                                                         │
│  ┌──────────────┐   vault "create"   ┌───────────────┐  │
│  │  Vault FS    │ ───event──────────▶│ main.ts       │  │
│  │  (.txt/.vtt) │                    │ (Plugin entry) │  │
│  └──────────────┘                    └───────┬───────┘  │
│                                              │          │
│         ┌────────────────────────────────────┤          │
│         │                                    │          │
│         ▼                                    ▼          │
│  ┌──────────────┐                   ┌───────────────┐   │
│  │ settings.ts  │                   │ commands/     │   │
│  │ types.ts     │                   │ convertTran-  │   │
│  │ (config)     │                   │ script.ts     │   │
│  └──────────────┘                   └───────┬───────┘   │
│                                             │           │
│                                             ▼           │
│                                     ┌───────────────┐   │
│                                     │ utils/        │   │
│                                     │ converters.ts │   │
│                                     │ (pure fns)    │   │
│                                     └───────┬───────┘   │
│                                             │           │
│                                             ▼           │
│                                     ┌───────────────┐   │
│                                     │ Output .md    │   │
│                                     │ in vault      │   │
│                                     └───────────────┘   │
│                                                         │
│  ┌──────────────┐                                       │
│  │ ui/          │                                       │
│  │ settingsTab  │  ◀── Obsidian Settings panel          │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
  main.ts                    # Plugin entry point — lifecycle only
  types.ts                   # Shared TypeScript interfaces
  settings.ts                # Default settings constant
  commands/
    convertTranscript.ts     # Command registration + conversion orchestration
  utils/
    converters.ts            # Pure conversion functions (txt→md, vtt→md)
    converters.test.ts       # Unit tests for converters
  ui/
    settingsTab.ts           # Obsidian PluginSettingTab implementation
```

### Design Principles

1. **Minimal entry point.** `main.ts` handles only plugin lifecycle (`onload`, `onunload`), settings loading, and delegation. No business logic lives here.

2. **Pure conversion layer.** `converters.ts` contains stateless, side-effect-free functions. They accept string content and return string Markdown. This makes them independently testable.

3. **Single responsibility per module.** Each file has one job: types define shape, settings define defaults, commands orchestrate I/O, converters transform data, UI renders settings.

4. **Event-driven automation.** The file watcher uses Obsidian's `vault.on("create")` event, registered through `this.registerEvent()` so cleanup is automatic on plugin unload.

## Module Dependency Graph

```
main.ts
  ├── types.ts              (TranscriptPluginSettings)
  ├── settings.ts           (DEFAULT_SETTINGS)
  ├── ui/settingsTab.ts     (TranscriptSettingTab)
  └── commands/convertTranscript.ts
        └── utils/converters.ts
              └── obsidian (moment)
```

All external dependencies (`obsidian`, `electron`, `@codemirror/*`) are marked as esbuild externals — they are provided by the Obsidian runtime and never bundled.

## Plugin Lifecycle

1. **`onload()`** — called when Obsidian enables the plugin:
   - Loads persisted settings (merging with defaults).
   - Registers the settings tab UI.
   - Registers the "Convert transcript" command.
   - Registers the vault `create` event listener for auto-conversion.

2. **`onunload()`** — called when Obsidian disables the plugin:
   - Currently empty. All listeners registered via `registerEvent` / `registerDomEvent` / `registerInterval` are automatically cleaned up by the Obsidian SDK.

## Runtime Environment

| Property          | Value                |
|-------------------|----------------------|
| Platform          | Desktop only         |
| Build target      | ES2018 (esbuild)     |
| Module format     | CommonJS             |
| TypeScript target | ES6                  |
| Minimum Obsidian  | 0.15.0               |
| Network required  | No                   |
