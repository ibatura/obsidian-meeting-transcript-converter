# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Meeting Transcript Converter** (plugin id `meeting-transcript-converter`) is an Obsidian community plugin that converts `.txt` and `.vtt` transcript files into cleaned `.md` notes, entirely offline. It is desktop-only (`isDesktopOnly: true`), written in TypeScript, and bundled by esbuild into a single `main.js` loaded by Obsidian at runtime.

Detailed specs live in `doc/`: `architecture.md`, `converters.md`, `data-model.md`, `commands-and-events.md`, `settings-ui.md`, `build-and-ci.md`, `testing.md`, `features.md`. Read the relevant one before making non-trivial changes — they're kept accurate and are more detailed than what's summarized here. `sdd/transcript_to_md_sdd.md` and `tasks/*.md` hold the original spec-driven design/task history.

`AGENTS.md` contains general Obsidian-plugin development conventions (manifest rules, versioning/release process, UX copy guidelines, security/privacy policy). Follow it for anything not covered below.

## Commands

```bash
npm install              # install deps
npm run dev               # esbuild watch mode
npm run build              # tsc -noEmit -skipLibCheck && esbuild production bundle
npm run lint               # eslint .
npm run test               # vitest run (all tests, single pass)
npx vitest                 # watch mode
npx vitest run --coverage  # with coverage
npx vitest run src/utils/converters.test.ts   # single test file
npx vitest run -t "name of test"              # single test by name
```

Manual install for testing in Obsidian: copy `main.js`, `manifest.json`, `styles.css` to `<vault>/.obsidian/plugins/meeting-transcript-converter/`, then enable in Settings → Community plugins.

CI (`.github/workflows/lint.yml`) runs `npm ci`, `npm run build --if-present`, `npm run lint` on Node 20.x/22.x for every push/PR.

Tests mock the `obsidian` module (not available outside the Obsidian runtime) — see the `vi.mock('obsidian', ...)` stub in `src/utils/converters.test.ts` for the pattern to reuse in new test files.

## Architecture

```
main.ts (lifecycle only: onload/onunload, loads settings, registers command + settings tab + vault "create" listener)
  ├── types.ts              — TranscriptPluginSettings interface
  ├── settings.ts            — DEFAULT_SETTINGS
  ├── ui/settingsTab.ts       — PluginSettingTab implementation
  └── commands/convertTranscript.ts   — registers command, orchestrates read → convert → write → notice
        └── utils/converters.ts        — pure, stateless txt→md / vtt→md conversion functions
```

Design principles: `main.ts` stays minimal (lifecycle only, no business logic); `converters.ts` is a pure functional layer (string in, string out, no Obsidian API calls except `moment`) so it's independently testable; each module has one responsibility. All Obsidian/electron/@codemirror/@lezer packages are esbuild externals, provided by the Obsidian runtime and never bundled.

Two entry paths both funnel through `convertTranscript(file, plugin, showNotice?)` in `commands/convertTranscript.ts`:

- **Manual**: Command palette → `checkCallback` shows the command only when the active file is `.txt`/`.vtt` → converts with `showNotice=true`.
- **Auto**: `vault.on("create")` handler (`handleFileCreate`, registered via `registerEvent` so cleanup is automatic) → checks `autoConvertEnabled`, file is a `TFile`, extension matches, and path is under the normalized `watchFolder` → converts with `showNotice=false` → optionally deletes the original if `deleteOriginalAfterConvert`.

Conversion picks `convertTxtToMarkdown` or `convertVttToMarkdown` based on extension, prepends `# {title}` (basename with underscores → spaces), creates `outputFolder` if missing, and writes/overwrites `{outputFolder}/{basename}.md`.

VTT parsing (`convertVttToMarkdown` + `parseVttTimeOffset`) accumulates cue blocks (`{ timeOffset?: number; text: string[] }`), handling both `HH:MM:SS.mmm` and `MM:SS.mmm` timestamp formats, and formats each as `- **[{moment(fileCreationTime + timeOffset).format(timeFormat)}]** {text}` (or a plain bullet if `timeFormat` is empty). Known limitation: `<v Speaker>` voice tags are not stripped and pass through as raw text.

Settings (`TranscriptPluginSettings`) persist via `Plugin.loadData()`/`saveData()` at `<vault>/.obsidian/plugins/meeting-transcript-converter/data.json`, merged over `DEFAULT_SETTINGS` on load (`Object.assign`) so new settings get defaults for existing users. Every settings-tab control saves immediately on change (no explicit Save button).

## SDD process

Every new feature follows this cycle. Each feature gets its own folder under `.sdd/`.

1. **Create the feature folder.** Pick a short, lowercase, hyphenated name describing the feature (e.g. `ask-ai-rename`) and create `.sdd/<feature-name>/`.
2. **Write `specification.md`.** A detailed description of *what* the feature does and *why*, written for a human reader. No code, no implementation details — describe behavior, scope, constraints, and acceptance criteria.
3. **Write `ImplementationPlan.md`.** The technical plan: components touched, sequencing, risks, and references to each task. It must contain a checklist (markdown `- [ ]` items) where every item links to a `Task-N-taskname.md` file in the same folder.
4. **Write one file per task.** For each task in the plan, create `Task-N-taskname.md` where `N` is the task number starting at 1 and `taskname` is a short hyphenated label (e.g. `Task-1-rename-command.md`). Each task file describes only the changes scoped to that single task.
5. **Implement.** Work through the checklist in `ImplementationPlan.md`, ticking each item off as its task completes.

### Validation rules

A feature folder is valid only when all of the following hold:

- The folder name is short, lowercase, and hyphenated.
- `specification.md` exists and contains no code blocks describing implementation.
- `ImplementationPlan.md` exists and contains a checklist (`- [ ]` items) where every item links to a corresponding `Task-N-taskname.md` file.
- For every checklist item there is a matching `Task-N-taskname.md` file in the same folder, and for every task file there is a checklist item — no orphans on either side.
- Task files are numbered consecutively starting from 1 with no gaps.
- Each `Task-N-taskname.md` describes a single, focused change.

Existing flat files under `.sdd/` predate this convention and are kept as historical records — do not reformat them.
