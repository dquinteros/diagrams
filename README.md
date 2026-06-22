# Diagrams

> A fast, offline-first desktop diagram editor — write text, see diagrams. Inspired by [dbdiagram.io](https://dbdiagram.io), reimagined as a local-first native app with support for **database (DBML/ER)**, **sequence**, and **BPMN** diagrams.

<p align="left">
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-edition%202024-000000?logo=rust&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
</p>

Diagrams is a cross-platform desktop application that turns concise text into
live, interactive diagrams. Everything runs locally — your schemas and diagrams
never leave your machine. The editor is on the left, the rendered diagram is on
the right, and they stay in sync as you type.

---

## ✨ Features

- **Three diagram types, one consistent canvas**
  - **DBML / ER** — model a database in [DBML](https://dbml.dbdiagram.io/home) and see an interactive entity-relationship diagram with cardinality markers and auto-layout.
  - **Sequence** — describe participants and messages in a compact DSL; get a fully themed sequence diagram with lifelines, activations, notes, and `alt`/`loop` fragments.
  - **BPMN** — author processes in a readable text DSL (no XML) with swimlanes, gateways, and events, rendered on the same native canvas.
- **Live editing** — a CodeMirror 6 editor with per-language syntax highlighting, inline parse errors, and instant re-rendering.
- **Interactive canvas** — pan, zoom, fit-to-screen, a minimap overview, hover-to-highlight relationships, click-to-select with an animated (marching-ants) edge highlight.
- **SQL import / export** — generate a diagram from existing SQL, or export your DBML schema back to SQL.
- **Image export** — export any diagram to SVG, PNG, or PDF.
- **Multi-file workflow** — tabbed documents, recent-files list, autosave, unsaved-changes prompts, and session restore.
- **Dark & light themes** — a cohesive Catppuccin-inspired palette across every diagram type.
- **Offline & private** — no account, no cloud, no telemetry. A single native binary.

---

## 🧱 Tech stack

| Layer        | Technology |
|--------------|------------|
| Desktop shell | [Tauri 2](https://v2.tauri.app/) (Rust) |
| Frontend      | React 19 · TypeScript · Vite 8 |
| Editor        | CodeMirror 6 |
| DBML parsing  | Rust (`dbml-rs`) exposed via Tauri commands |
| Layout        | Dagre (ER) + custom geometry engines (sequence & BPMN) |
| Rendering     | Hand-rolled SVG canvas shared by all diagram types |

---

## 🚀 Getting started

### Prerequisites

You need a web toolchain **and** a Rust toolchain (Tauri compiles a native binary).

| Tool    | Minimum version | Notes |
|---------|-----------------|-------|
| Node.js | 20.x (22.x+ recommended) | Ships with npm |
| Rust    | 1.85+ (edition 2024) | Install via [rustup](https://rustup.rs) |
| OS deps | platform-specific | Native WebView dependencies |

Tauri uses the OS native WebView — follow the official
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform:

- **macOS** — `xcode-select --install`
- **Linux (Debian/Ubuntu)**
  ```bash
  sudo apt update
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```
- **Windows** — [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) + WebView2 (preinstalled on Windows 11)

### Install

```bash
git clone https://github.com/dquinteros/diagrams.git
cd diagrams
npm install
```

Rust dependencies in `src-tauri/` are fetched and compiled on the first Tauri run.

### Run

```bash
# Full desktop app (recommended) — first run compiles Rust, later runs are fast
npm run tauri dev

# Frontend only, in the browser at http://localhost:5173
# (file open/save needs the Tauri backend and is unavailable here)
npm run dev
```

### Build a distributable

```bash
npm run tauri build
```

Installers/binaries land in `src-tauri/target/release/bundle/`
(`.dmg`/`.app` on macOS, `.deb`/`.AppImage` on Linux, `.msi`/`.exe` on Windows).

---

## 📜 Scripts

| Command               | Description |
|-----------------------|-------------|
| `npm run dev`         | Vite dev server (frontend only) |
| `npm run build`       | Type-check (`tsc -b`) and build the frontend to `dist/` |
| `npm run preview`     | Preview the production frontend build |
| `npm run lint`        | Run ESLint over the project |
| `npm run tauri dev`   | Run the full desktop app in dev mode |
| `npm run tauri build` | Build a distributable desktop binary |

---

## 📂 Project structure

```
diagrams/
├── index.html               # Vite entry HTML
├── vite.config.ts           # Vite config
├── src/                      # React frontend
│   ├── App.tsx               # App shell / layout
│   ├── components/
│   │   ├── Diagram/          # ER canvas, nodes, edges, zoom, minimap, search
│   │   ├── Sequence/         # Sequence diagram canvas
│   │   ├── Bpmn/             # BPMN canvas (custom SVG renderer)
│   │   ├── Editor/           # CodeMirror editor + per-language support
│   │   └── Toolbar/          # Toolbar, tabs, export & import menus
│   ├── context/              # React context (theme)
│   ├── hooks/                # DBML parsing, layout, view transform, files, docs
│   ├── lib/                  # Layout engines, DSL parsers, themes, constants
│   └── types/                # Shared TypeScript types
└── src-tauri/                # Rust / Tauri backend
    ├── Cargo.toml            # Rust dependencies (incl. dbml-rs parser)
    ├── tauri.conf.json       # App window + bundle config
    └── src/                  # Rust source (commands, parsing)
```

---

## 🛠️ Troubleshooting

- **`npm run tauri dev` hangs on first run** — it's compiling Rust. Wait it out; subsequent runs are cached.
- **WebView / build errors on Linux** — re-check the system dependencies above; a missing `libwebkit2gtk-4.1-dev` is the usual culprit.
- **`rustc` not found** — install Rust via [rustup](https://rustup.rs) and restart your shell so `~/.cargo/bin` is on your `PATH`.
- **Port 5173 already in use** — stop the other process or set a different port in `vite.config.ts`.

---

## 📄 License

Released under the [MIT License](LICENSE).
