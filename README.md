# Transcript to Markdown

Convert `.txt` and `.vtt` transcript files into clean Markdown notes, entirely offline. Built for meeting transcripts (e.g. Zoom recordings) but works with any plain-text or WebVTT transcript.

This plugin is desktop-only and does not send data anywhere — all conversion happens locally in your vault.

## Features

- **Manual conversion** — run "Convert transcript file (txt/vtt) to Markdown" from the Command Palette on the active `.txt` or `.vtt` file.
- **Auto-conversion** — optionally watch a folder and convert new transcript files as soon as they're created, with no manual step.
- **VTT timestamp rendering** — WebVTT cues are rendered as a bulleted list, each optionally prefixed with a formatted timestamp computed from the file's creation time.
- **Frontmatter generation** — output notes get YAML frontmatter with `meeting_name`, `date`, and, when detectable, `duration` and `participants`.
- **Optional cleanup** — delete the original transcript file automatically once it's been converted.

## Usage

### Manual conversion

1. Open a `.txt` or `.vtt` file in Obsidian.
2. Open the Command Palette and run **Convert transcript file (txt/vtt) to Markdown**.
3. The converted note is created (or updated, if it already exists) in your configured output folder.

### Auto-conversion

1. Open **Settings → Transcript to Markdown**.
2. Enable **Auto-convert new transcripts**.
3. Set **Watch folder** to the vault folder you want monitored (leave empty to watch the whole vault).
4. Any `.txt` or `.vtt` file created in that folder is converted automatically. Enable **Delete original file after convert** if you don't want to keep the source file around.

## How conversion works

**TXT files** are cleaned by trimming each line and removing empty lines — no other reformatting is applied.

**VTT files** are parsed as WebVTT: the header, cue sequence numbers, and empty lines are skipped, and each cue becomes a bullet point. If a time format is set, each bullet is prefixed with a timestamp computed as the file's creation time plus the cue's offset, e.g.:

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

> **Known limitation:** WebVTT `<v Speaker>` voice tags are not stripped and will pass through as raw text in the output.

## Settings

| Setting | Description | Default |
|---|---|---|
| Output folder | Vault folder where converted `.md` files are saved. Created automatically if it doesn't exist. | `Transcripts` |
| Watch folder | Vault folder monitored for new transcripts when auto-convert is on. Empty watches the entire vault. | `Transcripts` |
| Auto-convert new transcripts | Automatically convert new `.txt`/`.vtt` files as they're created. | Off |
| Delete original file after convert | Remove the source file after a successful conversion. | Off |
| Time format | [Moment.js](https://momentjs.com/docs/#/displaying/format/) format string used for VTT cue timestamps. Leave empty to omit timestamps. | `YYYY-MM-DD HH:mm:ss` |

## Installing

Manual install:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases).
2. Copy them into `<vault>/.obsidian/plugins/zoom-transcript-to-md/`.
3. Reload Obsidian and enable **Transcript to Markdown** under Settings → Community plugins.

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
