# DTube — Local Video Explorer

[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue?style=flat-square)](https://dmallick01.github.io/dtube-local-video/)

**One line:** Fast, offline video library with a minimal [LLM Parameter Lab](https://github.com/Dmallick01/llm-parameter-lab)–style UI — scan folders locally, playlist queue, resume playback, favorites, and keyboard shortcuts. No upload, no cloud.

## Live demo (UI shell)

**[https://dmallick01.github.io/dtube-local-video/](https://dmallick01.github.io/dtube-local-video/)**

GitHub Pages hosts the built `frontend/dist/` app. **Choosing a folder only works locally** (browser security) — use `npm run dev` on your machine for full playback. The Pages deploy showcases the UI and PWA install shell.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 → drag a folder or **Choose folder**.

## Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Playlist / queue with drag reorder | ✅ Right panel |
| 2 | IndexedDB watch progress | ✅ Resume on open |
| 3 | Shortcut overlay (`?`) | ✅ Gallery + player |
| 4 | Grid / list view + metadata columns | ✅ Toolbar toggle |
| 5 | Favorites + filter | ✅ Star + toolbar |
| 6 | Thumbnail IndexedDB cache | ✅ Faster re-scan |
| 7 | Subtitles (.srt / .vtt sidecar) | ✅ Same folder basename |
| 8 | Picture-in-picture + fullscreen | ✅ Player bar |
| 9 | Speed presets 0.5×–2× | ✅ Chips |
| 10 | Folder history (last 5) | ✅ Sidebar |
| 11 | Fuzzy path search | ✅ Filename + `webkitRelativePath` |
| 12 | Contact sheet PNG export | ✅ Toolbar |
| 13 | `window.DTube.registerFilter` | ✅ See [docs/PLUGIN.md](docs/PLUGIN.md) |
| 14 | PWA manifest + service worker | ✅ `public/manifest.webmanifest` |
| 15 | GitHub Pages deploy | ✅ `.github/workflows/pages.yml` |

## Design

Minimal monospace UI aligned with **LLM Parameter Lab**: white/black palette, blue hover, green accent panels, fixed toolbar, no glassmorphism.

## Keyboard shortcuts

| Key | Gallery | Player |
|-----|---------|--------|
| `?` | Shortcuts overlay | Shortcuts overlay |
| `/` | Focus search | — |
| Space | — | Play / pause |
| ← / → | — | Seek ±5s |
| Shift+← / → | — | Prev / next in queue |
| N / P | — | Next / previous |
| F | — | Fullscreen |
| I | — | Picture-in-picture |
| Esc | — | Close player |

## Build & deploy

```bash
cd frontend
npm run build    # → dist/
npm run preview
```

Push to `main` with GitHub Actions Pages enabled (Settings → Pages → GitHub Actions).

## Project structure

```text
dtube-local-video/
├── frontend/           # Vite + React
│   ├── src/styles/     # dtube-theme.css (lab-style)
│   ├── src/lib/        # IDB, fuzzy, subtitles, plugins
│   └── public/         # PWA manifest, service worker
├── server/             # Optional Node file server
└── docs/PLUGIN.md
```

## Screenshots

See [docs/screenshots/welcome.png](docs/screenshots/welcome.png) (regenerate after UI pass).

## License

MIT
