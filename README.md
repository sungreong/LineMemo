# LineMemo Lite

LineMemo Lite is a tiny Windows-first local copy launcher. It is designed for quickly saving repeated values, filtering by tab or tag, and copying a line without opening a heavy note app.

## Features

- Compact card and table views for fast copy workflows
- Tabs and tags with `#tag` search
- Multiple tag OR search, for example `#api #server`
- Quick input and per-card quick row add
- Secret masking with temporary reveal
- Duplicate value warning before adding the same value again
- JSON backup export/import
- Local-only storage with no cloud sync or telemetry

## Security Note

LineMemo Lite stores data as plain JSON on your PC. Secret values are masked in the UI, but they are not encrypted on disk. Do not store highly sensitive production credentials unless you accept that local plaintext risk.

Default data path:

```text
%APPDATA%\LineMemoLite\data.json
```

## Install From A Local Build

Build artifacts are created by Tauri:

```text
src-tauri\target\release\linememo-lite.exe
src-tauri\target\release\bundle\nsis\LineMemo Lite_0.1.0_x64-setup.exe
src-tauri\target\release\bundle\msi\LineMemo Lite_0.1.0_x64_en-US.msi
```

The generated installers and release binaries are intentionally not committed to git. Publish them through GitHub Releases when needed.

## Development Setup

Requirements:

- Windows
- Bun
- Rust/Cargo
- Microsoft Edge WebView2 Runtime

Install dependencies:

```powershell
bun install
```

Run tests:

```powershell
bun test
```

Run the web build:

```powershell
bun run build
```

Run the Tauri app in development:

```powershell
bun run tauri:dev
```

Build Windows packages:

```powershell
bun run tauri:build
```

If Cargo is installed but not available in the current PowerShell session:

```powershell
$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"
bun run tauri:build
```

## Project Structure

```text
src/                  Vanilla JS/CSS frontend
src/actions/          UI action handlers and duplicate handling
src/ui/               Renderers, icons, editable-cell helpers
src/styles/           Split CSS modules under 1000 lines each
src-tauri/            Rust/Tauri app shell and local JSON I/O
```

## Quality Checks

The test suite includes regression checks for:

- Tag parsing and search behavior
- Renderer smoke tests
- Toolbar, modal, and row action layout guards
- Explicit button types to avoid accidental form submits
- JS/CSS file line budget under 1000 lines

