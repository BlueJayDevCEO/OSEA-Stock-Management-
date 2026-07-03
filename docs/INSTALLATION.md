# Installation Guide

## For dive centres (end users)

1. Download the installer for your platform:
   - **Windows** — `OSEA-Dive-Manager-Setup-1.0.0.exe` (installer lets you choose the folder;
     desktop and Start-menu shortcuts are created)
   - **macOS** — `OSEA-Dive-Manager-1.0.0-arm64.dmg` (Apple Silicon) or `…-x64.dmg` (Intel):
     open and drag to Applications
   - **Linux** — `OSEA-Dive-Manager-1.0.0.AppImage` (`chmod +x`, then run) or the `.deb`
2. Launch **OSEA Dive Manager**. The setup wizard runs on first start:
   - Choose where your business data is stored (default: `Documents\OSEA Dive Manager`).
     Any folder works — including a NAS share or a synced folder if you want your own
     off-site copy.
   - Enter your business name, currency and VAT rate.
   - Optionally load the demo dive centre to explore the app with realistic data.
3. Done. No account, no internet connection, no subscription server. Everything works
   offline.

### Where is my data?

One SQLite file: `<your chosen folder>/osea-dive-manager.db`. Settings → Data & Backups
shows the exact path and provides one-click **Backup**, **Restore**, **Export JSON** and
**Import JSON**.

### QR / barcode scanners

Any USB scanner that types what it scans ("keyboard wedge" mode — the default for virtually
all scanners) works with no configuration. Scan a label anywhere in the app to open that
item.

### Label stock

- A4 adhesive sheets: 24-up (70 × 37 mm) and 12-up (105 × 49.5 mm) layouts
- Brother QL thermal rolls: 62 × 29 mm
- Zebra thermal rolls: 51 × 25 mm (2″ × 1″)

Print directly (the OS print dialog targets your label printer) or export a PDF.

## For developers

### Prerequisites

- Node.js 20+ (developed on Node 24)
- npm 10+
- Windows: no extra tooling needed (prebuilt SQLite binaries are downloaded automatically);
  if a rebuild is ever required, install the Visual Studio Build Tools.

### Setup

```bash
npm install          # also runs electron-builder install-app-deps (native SQLite for Electron)
npm run dev          # development mode with hot reload
```

### Verify

```bash
npm run typecheck    # strict TypeScript over main, preload and renderer
npm run smoke        # headless end-to-end test of the entire backend:
                     # setup → demo seed → rental workflow → sales → POs → reports → backup
```

### Build installers

```bash
npm run dist         # current platform
npm run dist:win     # Windows NSIS installer
npm run dist:mac     # macOS DMG (run on macOS)
npm run dist:linux   # AppImage + deb (run on Linux)
```

Output lands in `dist/`. The app icon is `build/icon.png` (regenerate with `npm run icon`);
electron-builder derives the platform-specific `.ico`/`.icns` from it. Code signing:
add your certificates via the standard `electron-builder` env vars (`CSC_LINK`,
`CSC_KEY_PASSWORD`, notarisation credentials on macOS) — configuration is already
compatible.

### Useful dev flags

```bash
electron out/main/index.js --smoke-test [--keep]      # backend test (keep = retain test DB)
electron out/main/index.js --screenshot shot.png --route '#/rental'
OSEA_DATA_DIR=<dir> electron out/main/index.js        # point the app at any data folder
```
