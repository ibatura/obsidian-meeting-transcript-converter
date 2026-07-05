# Testing Strategy

## Test Framework

| Tool    | Version | Purpose          |
|---------|---------|------------------|
| Vitest  | ^4.1.1  | Test runner      |

Tests are run via `npm run test` (which executes `vitest run`).

## Current Test Coverage

### Unit Tests: `src/utils/converters.test.ts`

The converter module has unit tests covering the pure transformation functions.

#### Mocking

The `obsidian` module is mocked since it is not available outside the Obsidian runtime:

```ts
vi.mock('obsidian', () => ({
    moment: (val: any) => ({
        format: (fmt: string) => 'mocked-time'
    })
}));
```

This provides a stub `moment` function that returns `'mocked-time'` for any format call.

#### Test Cases: `convertTxtToMarkdown`

| Test                                   | Input                 | Expected Output     |
|----------------------------------------|-----------------------|---------------------|
| Trims surrounding whitespace           | `"   hello world   \n"` | `"hello world"`   |
| Returns empty string for whitespace-only | `"   \n  \t "`       | `""`                |

#### Test Cases: `convertVttToMarkdown`

| Test                              | Input Description                                | Expected Output                                                    |
|-----------------------------------|--------------------------------------------------|--------------------------------------------------------------------|
| Basic VTT format                  | WEBVTT header, 2 cues with sequence numbers      | Two bullet lines with merged cue text                              |
| Voice tags (`<v Speaker>`)        | Cues wrapped in `<v>` tags                       | Tags pass through (known limitation — not stripped)                 |
| Missing numeric index lines       | Cues without sequence numbers                    | Parsed correctly, two bullet lines                                 |

---

## Test Gaps and Recommendations

The following areas currently lack test coverage and should be addressed for spec-driven development:

### High Priority

1. **VTT timestamp formatting** — test that `timeFormat` and `fileCreationTime` produce correct formatted timestamps in output. Currently all tests pass `timeFormat = ""` (timestamps disabled).

2. **`parseVttTimeOffset`** — this internal function handles two VTT time formats (`HH:MM:SS.mmm` and `MM:SS.mmm`). It should have dedicated unit tests for edge cases: zero times, max values, boundary between formats.

3. **Title generation** — the title is generated in `convertTranscript.ts` by replacing underscores with spaces. This logic should be tested with various filenames: spaces, special characters, multiple underscores.

### Medium Priority

4. **`convertTranscript` orchestration** — integration-level tests verifying that the command correctly reads files, calls the right converter, creates folders, and writes output. Requires mocking the Obsidian `Vault` API.

5. **`handleFileCreate` watcher logic** — test path matching, setting checks (`autoConvertEnabled`, `deleteOriginalAfterConvert`), and edge cases (empty `watchFolder`, nested paths).

6. **Settings persistence** — verify that `loadSettings` correctly merges saved data over defaults, and that new settings get default values for existing users.

### Low Priority

7. **Settings tab rendering** — smoke tests that `display()` creates the expected number of `Setting` elements. Requires mocking the Obsidian `Setting` class.

8. **Error paths** — test that conversion failures produce console errors and notices rather than unhandled exceptions.

---

## Running Tests

```bash
# Run all tests once
npm run test

# Run tests in watch mode (during development)
npx vitest

# Run tests with coverage
npx vitest run --coverage
```

## Writing New Tests

Place test files next to the module they test, using the `.test.ts` suffix:

```
src/utils/converters.ts       → src/utils/converters.test.ts
src/commands/convertTranscript.ts → src/commands/convertTranscript.test.ts
```

All tests must mock the `obsidian` module since it is an external dependency provided only at runtime.
