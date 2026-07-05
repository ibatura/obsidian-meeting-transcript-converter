# Release Notes

## v1.0.0 — Initial Release

First public release of **Meeting Transcript Converter**, an Obsidian plugin that converts `.txt` and `.vtt` meeting transcripts into clean Markdown notes, entirely offline.

### Features

- **Manual conversion** — run "Convert transcript file (txt/vtt) to Markdown" from the Command Palette on the active `.txt` or `.vtt` file.
- **Auto-conversion** — optionally watch a folder and convert new transcript files as soon as they're created, with no manual step.
- **VTT timestamp rendering** — WebVTT cues are rendered as a bulleted list, each optionally prefixed with a formatted timestamp computed from the file's creation time. Both `HH:MM:SS.mmm` and `MM:SS.mmm` cue formats are supported.
- **Frontmatter generation** — output notes get YAML frontmatter with `meeting_name` and `date`, plus `duration` and `participants` when detectable.
- **Optional cleanup** — delete the original transcript file automatically once it's been converted.

### Settings

| Setting | Meaning | Default |
|---|---|---|
| Output folder | The vault folder where converted Markdown files are saved. | `Transcripts` |
| Watch folder | The folder monitored for new `.txt`/`.vtt` files when auto-convert is on. Leave empty to watch the whole vault. | `Transcripts` |
| Auto-convert new transcripts | Toggle to automatically convert new `.txt`/`.vtt` files as soon as they're created in the watched folder. | Off |
| Delete original file after convert | Toggle to remove the source `.txt`/`.vtt` file once the `.md` file has been created. | Off |
| Time format | Moment.js format string used for timestamps on VTT dialog lines. Leave empty to omit timestamps. | `YYYY-MM-DD HH:mm:ss` |

All settings are saved immediately when changed — there is no separate save button.

### Requirements

- Desktop only (`isDesktopOnly: true`).
- Requires Obsidian `1.8.7` or later.

### Known Limitations

- Only Zoom-generated transcripts are currently supported. Transcripts from other tools (Teams, Google Meet, etc.) may not parse correctly.
- WebVTT `<v Speaker>` voice tags are not stripped and pass through as raw text in the output.

### Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from this release.
2. Copy them into `<vault>/.obsidian/plugins/meeting-transcript-converter/`.
3. Reload Obsidian and enable **Meeting Transcript Converter** under Settings → Community plugins.
