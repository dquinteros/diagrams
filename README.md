# Setup Guide

**Diagrams — DBML Editor** is a cross-platform desktop app for writing
[DBML](https://dbml.dbdiagram.io/home) and visualizing it as an interactive
database diagram in real time. It is built with **Tauri 2** (Rust shell),
**React 19**, **TypeScript**, and **Vite**, with a CodeMirror-based editor and
a custom Dagre-powered diagram canvas.

---

## 1. Prerequisites

You need a working web toolchain **and** a Rust toolchain (Tauri compiles a
native binary).

| Tool       | Minimum version | Notes |
|------------|-----------------|-------|
| Node.js    | 20.x (22.x+ recommended) | Ships with npm |
| Rust       | 1.85+ (edition 2024) | Install via [rustup](https://rustup.rs) |
| OS deps    | see below       | Native WebView dependencies |

### Platform-specific system dependencies

Tauri relies on the OS native WebView. Follow the official
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your
platform. Summary:

- **macOS**: Install Xcode Command Line Tools — `xcode-select --install`.
- **Linux** (Debian/Ubuntu):
  ```bash
  sudo apt update
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```
- **Windows**: Install the
  [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  and the WebView2 runtime (preinstalled on Windows 11).

### Verify your toolchain

```bash
node --version    # >= 20
rustc --version   # >= 1.85
cargo --version
```

---

## 2. Install dependencies

From the project root:

```bash
npm install
```

This installs the frontend dependencies. Rust dependencies (in `src-tauri/`)
are fetched and compiled automatically the first time you run a Tauri command.

---

## 3. Run in development

### Option A — Desktop app (recommended)

Launches the native window with hot-reload for the frontend:

```bash
npm run tauri dev
```

The first run compiles the Rust backend and can take several minutes.
Subsequent runs are fast.

### Option B — Browser only (frontend)

Runs just the Vite dev server at <http://localhost:5173>. Note that
file-system features that depend on the Tauri backend (open/save) will not be
available in the browser.

```bash
npm run dev
```

---

## 4. Available scripts

| Command              | Description |
|----------------------|-------------|
| `npm run dev`        | Vite dev server (frontend only) |
| `npm run build`      | Type-check (`tsc -b`) and build the frontend to `dist/` |
| `npm run preview`    | Preview the production frontend build |
| `npm run lint`       | Run ESLint over the project |
| `npm run tauri dev`  | Run the full desktop app in dev mode |
| `npm run tauri build`| Build a distributable desktop binary |

---

## 5. Build a distributable app

```bash
npm run tauri build
```

Bundled installers/binaries are written to
`src-tauri/target/release/bundle/` (format depends on your OS — `.dmg`/`.app`
on macOS, `.deb`/`.AppImage` on Linux, `.msi`/`.exe` on Windows).

---

## 6. Project structure

```
diagrams/
├── index.html               # Vite entry HTML
├── vite.config.ts           # Vite config
├── eslint.config.js          # ESLint flat config
├── tsconfig*.json            # TypeScript project references
├── public/                   # Static assets
├── src/                      # React frontend
│   ├── App.tsx               # App shell / layout
│   ├── main.tsx              # React entry point
│   ├── components/
│   │   ├── Diagram/          # Canvas, nodes, edges, zoom, search
│   │   ├── Editor/           # CodeMirror DBML editor + language support
│   │   └── Toolbar/          # Toolbar + export menu
│   ├── context/              # React context (theme)
│   ├── hooks/                # DBML parsing, layout, view transform, files
│   ├── lib/                  # Layout engine, themes, constants
│   ├── types/                # Shared TypeScript types
│   └── styles/
└── src-tauri/                # Rust / Tauri backend
    ├── Cargo.toml            # Rust dependencies (incl. dbml-rs parser)
    ├── tauri.conf.json       # App window + bundle config
    └── src/                  # Rust source (commands, parsing)
```

---

## 7. Troubleshooting

- **`npm run tauri dev` hangs on first run** — it's compiling Rust. Wait it
  out; subsequent runs are cached.
- **WebView / build errors on Linux** — re-check the system dependencies in
  step 1; a missing `libwebkit2gtk-4.1-dev` is the usual culprit.
- **`rustc` not found** — install Rust via [rustup](https://rustup.rs) and
  restart your shell so `~/.cargo/bin` is on your `PATH`.
- **Port 5173 already in use** — stop the other process or set a different
  port via `vite.config.ts`.
