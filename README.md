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
- **Consistent note names** — every note is named from the meeting's date and name, in the order and date format you choose, whatever the meeting platform called its export.

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
[Kate Kan] 2026-07-31 19:31:06
Hey! One second, cannot hear you.
[Ivan Kan] 2026-07-31 19:31:11
Yeah, yeah, I was mute. Hey, hello.
```

Speakers found this way are also listed in the note's `participants` property. Detection looks only at the file's contents, so it works no matter how the export was named. Speaker lines always use `YYYY-MM-DD HH:mm:ss` so Teams and Zoom notes read the same; the **Time format** setting applies to the bulleted output above.

## Note names

A converted note is named from two things the plugin works out for itself: the meeting's date — taken from a date in the transcript's file name, or the file's creation time when it has none — and the meeting's name, with any leading date stripped, underscores turned into spaces and words capitalised. Transcripts that name no meeting, such as Zoom's `meeting_saved_closed_caption`, become `Untitled Meeting`.

| Transcript | Note (date first) | Note (name first) |
|---|---|---|
| `2026-04-05_sprint_planning.txt` | `2026-04-05 Sprint Planning.md` | `Sprint Planning 2026-04-05.md` |
| `Weekly_Sync.vtt` (Teams) | `2026-09-08 Weekly Sync.md` | `Weekly Sync 2026-09-08.md` |
| `meeting_saved_closed_caption.txt` | `2026-04-05 Untitled Meeting.md` | `Untitled Meeting 2026-04-05.md` |

Every note records the transcript it came from in a `source` property. Converting the same transcript again updates that note in place. If a *different* meeting would land on the same name, its note gets the meeting's time appended — `2026-04-05 Untitled Meeting 16-05-00.md` — rather than replacing what's already there. Notes with no `source` property, including ones you wrote yourself, are never overwritten.

Notes converted by earlier versions keep their old names; the next conversion creates a new note alongside them.

## Settings

| Setting | Description | Default |
|---|---|---|
| Output folder | Vault folder where converted `.md` files are saved. Created automatically if it doesn't exist. | `Transcripts` |
| Watch folder | Vault folder monitored for new transcripts when auto-convert is on. Empty watches the entire vault. | `Transcripts` |
| Auto-convert new transcripts | Automatically convert new `.txt`/`.vtt` files as they're created. | Off |
| Delete original file after convert | Remove the source file after a successful conversion. | Off |
| Note name order | Whether the note's name starts with the meeting date or the meeting name. | Date, then meeting name |
| Note name date format | [Moment.js](https://momentjs.com/docs/#/displaying/format/) format string for the date in the note's name. Leave empty to name notes by meeting name alone. | `YYYY-MM-DD` |
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
