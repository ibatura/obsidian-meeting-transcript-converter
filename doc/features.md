# Feature Specifications

## F-001: Manual Transcript Conversion

### Summary

User converts the currently active `.txt` or `.vtt` file to a Markdown note via the Command Palette.

### Trigger

Command Palette → "Convert transcript file (txt/vtt) to Markdown"

### Preconditions

- A file is active in the editor.
- The active file has extension `.txt` or `.vtt`.
- If preconditions are not met, the command does not appear in the palette (`checkCallback` returns `false`).

### Behavior

1. Read the active file's content via `vault.read()`.
2. Determine the converter based on file extension:
   - `.txt` → `convertTxtToMarkdown(content)`
   - `.vtt` → `convertVttToMarkdown(content, timeFormat, fileCreationTime)`
3. Generate a title from the file's basename (underscores replaced with spaces), prepended as `# {title}`.
4. Resolve `outputFolder` path. Create the folder if it does not exist.
5. Build target path: `{outputFolder}/{basename}.md`.
6. If a file already exists at that path, overwrite its content. Otherwise, create a new file.
7. Show a `Notice` indicating success (`Created {path}` or `Updated {path}`).

### Error Handling

- If any step fails, catch the error, log to console, and show a generic failure `Notice`.
- If `outputFolder` path exists but is not a folder, show a specific error notice and abort.

### Acceptance Criteria

- [ ] Command only visible when a `.txt` or `.vtt` file is active.
- [ ] TXT files produce trimmed, cleaned Markdown output.
- [ ] VTT files produce bulleted Markdown with optional timestamps.
- [ ] Output file is created in the configured `outputFolder`.
- [ ] Existing output file at the same path is overwritten, not duplicated.
- [ ] Success notice is displayed.
- [ ] Errors are caught and surfaced via notice + console.

---

## F-002: Auto-Conversion on File Create

### Summary

When enabled, the plugin automatically converts new `.txt`/`.vtt` files appearing in the watched folder.

### Trigger

Obsidian vault `create` event.

### Preconditions

- `autoConvertEnabled` setting is `true`.
- The created item is a `TFile` (not a folder).
- The file extension is `.txt` or `.vtt`.
- If `watchFolder` is non-empty, the file's normalized path must start with the normalized `watchFolder` path + `/`.

### Behavior

1. Run the same conversion logic as F-001, with `showNotice = false`.
2. If `deleteOriginalAfterConvert` is `true`, delete the source file after successful conversion.
3. If deletion fails, log error and show a failure notice.

### Edge Cases

- `watchFolder` is empty → entire vault is watched.
- `watchFolder` and `outputFolder` are the same folder → conversion still works (output is `.md`, watched extensions are `.txt`/`.vtt`).
- File created outside `watchFolder` → ignored silently.
- Non-transcript file created in `watchFolder` → ignored silently.

### Acceptance Criteria

- [ ] No conversion when `autoConvertEnabled` is `false`.
- [ ] Only `.txt` and `.vtt` files trigger conversion.
- [ ] Watch folder filtering works correctly with normalized paths.
- [ ] Original file deleted only when setting is enabled and conversion succeeds.
- [ ] No notice shown on auto-convert (silent operation).
- [ ] Deletion failure is logged and surfaced via notice.

---

## F-003: Configurable Settings

### Summary

Users configure plugin behavior through the Obsidian settings panel.

### Settings

| Setting                        | UI Control | Description                                                  |
|--------------------------------|-----------|--------------------------------------------------------------|
| Output folder                  | Text input | Vault path where `.md` files are saved                      |
| Watch folder                   | Text input | Vault path to monitor for new transcripts (empty = all)     |
| Auto-convert new transcripts   | Toggle    | Enable/disable automatic conversion on file create          |
| Delete original after convert  | Toggle    | Remove source file after successful conversion              |
| Time format                    | Text input | Moment.js format string for VTT timestamp display           |

See [settings-ui.md](settings-ui.md) for full UI specification.

### Acceptance Criteria

- [ ] All five settings are displayed in the plugin's settings tab.
- [ ] Changes are persisted immediately on change.
- [ ] Default values are applied for new installations.
- [ ] Existing users upgrading receive defaults for any newly added settings.

---

## F-004: VTT Timestamp Rendering

### Summary

VTT cue timestamps are converted to human-readable format using the file's creation time as a base.

### Behavior

1. Parse the VTT cue start time (e.g., `00:01:23.456`) into a millisecond offset.
2. Add the offset to the file's `stat.ctime` (creation timestamp).
3. Format the resulting absolute time using the `timeFormat` setting via `moment().format()`.
4. Render as bold bracketed prefix: `- **[{formatted time}]** {cue text}`.

### Edge Cases

- If `timeFormat` is empty, timestamps are omitted and cues render as plain bullets.
- VTT files with `MM:SS.mmm` format (no hours) are supported.

### Acceptance Criteria

- [ ] Timestamps display correctly with default format `HH:mm:ss DD:MM:YYYY`.
- [ ] Custom time formats are respected.
- [ ] Empty time format suppresses timestamp display.
- [ ] Both `HH:MM:SS.mmm` and `MM:SS.mmm` VTT time formats are parsed.

