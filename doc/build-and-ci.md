# Build, CI, and Release

## Build System

### Toolchain

| Tool        | Version / Config                   | Purpose                         |
|-------------|------------------------------------|---------------------------------|
| TypeScript  | ^5.8.3                            | Type checking                   |
| esbuild     | 0.25.5                            | Bundling TS → JS                |
| Node.js     | 20.x / 22.x (CI matrix)           | Runtime                         |
| npm          | (bundled with Node)               | Package manager                 |

### npm Scripts

| Script        | Command                                                  | Purpose                              |
|---------------|----------------------------------------------------------|--------------------------------------|
| `dev`         | `node esbuild.config.mjs`                               | Watch mode — rebuild on file changes |
| `build`       | `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production` | Type-check then production bundle    |
| `lint`        | `eslint .`                                               | Run ESLint                           |
| `test`        | `vitest run`                                             | Run unit tests                       |
| `version`     | `node version-bump.mjs && git add manifest.json versions.json` | Bump version in manifests            |

### esbuild Configuration

Defined in `esbuild.config.mjs`:

- **Entry point:** `src/main.ts`
- **Output:** `main.js` (project root)
- **Format:** CommonJS
- **Target:** ES2018
- **Tree shaking:** enabled
- **Source maps:** inline in dev, disabled in production
- **Minification:** production only
- **Externals:** `obsidian`, `electron`, all `@codemirror/*` packages, `@lezer/*` packages, and Node.js builtins. These are provided by the Obsidian runtime.

### TypeScript Configuration

Defined in `tsconfig.json`:

- **Base URL:** `src`
- **Module:** ESNext
- **Target:** ES6
- **Strict checks enabled:** `noImplicitAny`, `noImplicitThis`, `noImplicitReturns`, `strictNullChecks`, `strictBindCallApply`, `noUncheckedIndexedAccess`, `useUnknownInCatchVariables`
- **Includes:** `src/**/*.ts`

---

## ESLint

Defined in `eslint.config.mts`:

- Uses `typescript-eslint` with project service.
- Includes `eslint-plugin-obsidianmd` recommended rules.
- Globals: browser environment.
- Ignores: `node_modules`, `dist`, `esbuild.config.mjs`, `version-bump.mjs`, `versions.json`, `main.js`.

---

## CI Pipeline

### GitHub Actions Workflow

File: `.github/workflows/lint.yml`

Triggered on pushes and pull requests to all branches.

**Job matrix:**

| Node.js Version |
|-----------------|
| 20.x            |
| 22.x            |

**Steps:**

1. Checkout code (`actions/checkout@v4`)
2. Setup Node.js (`actions/setup-node@v4` with npm cache)
3. `npm ci` — clean install dependencies
4. `npm run build --if-present` — type-check + bundle
5. `npm run lint` — ESLint check

---

## Release Process

### Version Bumping

1. Update `minAppVersion` in `manifest.json` if using newer Obsidian APIs.
2. Run `npm version patch` (or `minor` / `major`).
   - This triggers the `version` script which runs `version-bump.mjs`.
   - `version-bump.mjs` updates `manifest.json` version and adds an entry to `versions.json`.
   - Both files are staged for commit.

### Release Artifacts

Create a GitHub release with the tag matching the version exactly (no `v` prefix):

| File            | Required | Notes                              |
|-----------------|----------|------------------------------------|
| `main.js`       | Yes      | Bundled plugin code                |
| `manifest.json` | Yes      | Must be at repo root AND in release |
| `styles.css`    | Optional | Currently empty / unused           |

### Version Mapping

`versions.json` maps plugin versions to minimum Obsidian versions:

```json
{
  "0.0.1": "0.15.0"
}
```

This allows older Obsidian versions to download compatible plugin releases.

---

## Local Development Workflow

1. `npm install` — install dependencies.
2. `npm run dev` — start esbuild in watch mode.
3. Symlink or copy `main.js`, `manifest.json`, `styles.css` to `<vault>/.obsidian/plugins/zoom-transcript-to-md/`.
4. In Obsidian: **Settings → Community plugins** → enable the plugin.
5. Reload Obsidian (or use the "Reload plugin" command) after rebuilds.
