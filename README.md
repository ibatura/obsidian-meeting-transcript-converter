# Meeting Transcript Converter

Convert `.txt` and `.vtt` transcript files into clean Markdown notes, entirely offline. Built for meeting transcripts (Zoom recordings and Microsoft Teams exports) but works with any plain-text or WebVTT transcript.

This plugin is desktop-only and does not send data anywhere — all conversion happens locally in your vault.

## Features

- **Manual conversion** — run "Convert transcript file (txt/vtt) to Markdown" from the Command Palette on the active `.txt` or `.vtt` file.
- **Auto-conversion** — optionally watch a folder and convert new transcript files as soon as they're created, with no manual step.
- **VTT timestamp rendering** — WebVTT cues are rendered as a bulleted list, each optionally prefixed with a formatted timestamp computed from the file's creation time.
- **Microsoft Teams transcripts** — Teams exports are detected automatically and converted speaker by speaker, with cue identifiers and voice tags removed.
- **Frontmatter generation** — output notes get YAML frontmatter with `meeting_name`, `date`, and, when detectable, `duration` and `participants`.
- **Optional cleanup** — delete the original transcript file automatically once it's been converted.

## Usage

### Manual conversion

1. Open a `.txt` or `.vtt` file in Obsidian.
2. Open the Command Palette and run **Convert transcript file (txt/vtt) to Markdown**.
3. The converted note is created (or updated, if it already exists) in your configured output folder.

### Auto-conversion

1. Open **Settings → Meeting Transcript Converter**.
2. Enable **Auto-convert new transcripts**.
3. Set **Watch folder** to the vault folder you want monitored (leave empty to watch the whole vault).
4. Any `.txt` or `.vtt` file created in that folder is converted automatically. Enable **Delete original file after convert** if you don't want to keep the source file around.

## How conversion works

**TXT files** are cleaned by trimming each line and removing empty lines; `[Speaker] HH:mm:ss` header lines also get the meeting's date, e.g. `[Alice] 2026-04-05 14:32:01`.

**VTT files** are parsed as WebVTT: the header, cue identifiers, and empty lines are skipped, and each cue becomes a bullet point. If a time format is set, each bullet is prefixed with a timestamp computed as the file's creation time plus the cue's offset, e.g.:

```markdown
- **[2026-04-05 14:32:01]** Hello, this is the first line
- **[2026-04-05 14:32:06]** Second cue block here
```

With the time format left empty, timestamps are omitted:

```markdown
- Hello, this is the first line
- Second cue block here
```

Every converted note starts with a title (`# {name}`) and YAML frontmatter containing the meeting name and date, plus duration and participant list when they can be detected from the transcript content.

**Microsoft Teams transcripts** are recognised automatically: they are WebVTT files whose cues name their speaker in a `<v Speaker>` voice tag. These convert speaker by speaker instead of as bullets, with consecutive lines from the same speaker joined into one turn:

```markdown
[Kateryna Tymofeieva] 2026-07-31 19:31:06
Hey! One second, cannot hear you.
[Ivan Batura] 2026-07-31 19:31:11
Yeah, yeah, I was mute. Hey, hello.
```

Speakers found this way are also listed in the note's `participants` property. Detection looks only at the file's contents, so it works no matter how the export was named. Speaker lines always use `YYYY-MM-DD HH:mm:ss` so Teams and Zoom notes read the same; the **Time format** setting applies to the bulleted output above.

## Settings

| Setting | Description | Default |
|---|---|---|
| Output folder | Vault folder where converted `.md` files are saved. Created automatically if it doesn't exist. | `Transcripts` |
| Watch folder | Vault folder monitored for new transcripts when auto-convert is on. Empty watches the entire vault. | `Transcripts` |
| Auto-convert new transcripts | Automatically convert new `.txt`/`.vtt` files as they're created. | Off |
| Delete original file after convert | Remove the source file after a successful conversion. | Off |
| Time format | [Moment.js](https://momentjs.com/docs/#/displaying/format/) format string used for bulleted VTT cue timestamps. Leave empty to omit them. Speaker lines (Teams, Zoom) always use `YYYY-MM-DD HH:mm:ss`. | `YYYY-MM-DD HH:mm:ss` |

## Installing

Manual install:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases).
2. Copy them into `<vault>/.obsidian/plugins/meeting-transcript-converter/`.
3. Reload Obsidian and enable **Meeting Transcript Converter** under Settings → Community plugins.

## Development

```bash
npm install         # install dependencies
npm run dev          # esbuild watch mode
npm run build         # type-check and produce a production bundle
npm run lint           # run eslint
npm run test             # run the test suite (vitest)
```

See the `doc/` folder for detailed architecture, converter, and settings specifications.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
