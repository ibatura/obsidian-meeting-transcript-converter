# Commands and Events

## Commands

### `convert-transcript-file`

| Property    | Value                                              |
|-------------|----------------------------------------------------|
| ID          | `convert-transcript-file`                          |
| Name        | Convert transcript file (txt/vtt) to Markdown      |
| Type        | `checkCallback` (conditional command)              |
| Source file | `src/commands/convertTranscript.ts`                |

#### Visibility Logic

The command uses Obsidian's `checkCallback` pattern. When `checking` is `true`, the callback returns whether the command should be visible:

```
getActiveFile() exists
  AND file.extension is "txt" or "vtt"
  → return true (show command)
  → otherwise return false (hide command)
```

When `checking` is `false`, the command executes `convertTranscript(file, plugin)`.

#### Registration

Called from `main.ts` → `onload()` via `registerConvertCommand(plugin)`.

The command is registered on the plugin instance, so it is automatically unregistered on plugin unload.

---

## Events

### Vault `create` Event

| Property     | Value                                    |
|--------------|------------------------------------------|
| Event        | `vault.on("create")`                    |
| Registered   | `main.ts` → `onload()` via `registerEvent()` |
| Handler      | `handleFileCreate(abstractFile)`         |
| Cleanup      | Automatic on plugin unload               |

#### Handler Logic

```
1. if !autoConvertEnabled → return
2. if abstractFile is not TFile → return
3. if extension is not .txt or .vtt → return
4. if watchFolder is set:
     normalize watchFolder + "/"
     normalize file.path
     if file.path does not start with watchFolder → return
5. convertTranscript(file, plugin, showNotice=false)
6. if deleteOriginalAfterConvert:
     try vault.delete(file)
     catch → log error, show notice
```

#### Path Normalization

Both `watchFolder` and `file.path` are passed through `normalizePath()` from the Obsidian API before comparison. The watch folder path gets a trailing `/` appended to prevent partial folder name matches (e.g., `"Inbox"` should not match `"Inbox-Archive/file.txt"`).

---

## Function Exports

### `convertTranscript.ts` Exports

| Function                 | Signature                                                              | Description                          |
|--------------------------|------------------------------------------------------------------------|--------------------------------------|
| `registerConvertCommand` | `(plugin: TranscriptToMdPlugin) → void`                               | Registers the palette command        |
| `convertTranscript`      | `(file: TFile, plugin: TranscriptToMdPlugin, showNotice?: boolean) → Promise<void>` | Orchestrates file conversion         |

`convertTranscript` is used by both the manual command and the auto-convert watcher. The `showNotice` parameter (default `true`) controls whether a success notice is displayed — the watcher passes `false` for silent operation.
