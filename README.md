# DTube — Local Video Explorer

[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue?style=flat-square)](https://dmallick01.github.io/dtube-local-video/)

**One line:** Fast, offline video library with a minimal [LLM Parameter Lab](https://github.com/Dmallick01/llm-parameter-lab)–style UI — scan folders locally, hover GIF previews, playlists, resume playback, grouping, shuffle, and keyboard shortcuts. No upload, no cloud.

## Live demo (UI shell)

**[https://dmallick01.github.io/dtube-local-video/](https://dmallick01.github.io/dtube-local-video/)**

> **Important:** `https://dmallick01.github.io/` alone shows GitHub’s “no site here” page. Use the **full project URL** above.

GitHub Pages hosts the built `frontend/dist/` app. **Choosing a folder only works locally** (browser security) — use `npm run dev` on your machine for full playback.

![DTube welcome screen — drag a folder, lab-style toolbar](docs/screenshots/welcome.png)

### Enable Pages (one-time)

1. Repo **Settings → Pages**
2. **Build and deployment → Source:** `GitHub Actions`
3. Push to `main` or run workflow **Deploy DTube to GitHub Pages**

Portfolio index (all demos): [dmallick01.github.io](https://dmallick01.github.io/) after `Dmallick01.github.io` repo is published.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173/dtube-local-video/ → drag a folder or **Choose folder**.

## Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Playlist / queue with drag reorder | ✅ Right panel |
| 2 | IndexedDB watch progress | ✅ Resume on open |
| 3 | Shortcut overlay (`?`) | ✅ Gallery + player |
| 4 | Grid / list view + metadata columns | ✅ Toolbar toggle |
| 5 | Favorites + filter | ✅ Star + toolbar |
| 6 | Thumbnail + hover GIF cache (IndexedDB) | ✅ 15–25% slice, ≤3s GIF |
| 7 | Group by folder / type / size / month | ✅ Sidebar |
| 8 | Sort + 10 shuffle algorithms (library or per group) | ✅ Sidebar |
| 9 | Subtitles (.srt / .vtt sidecar) | ✅ Same folder basename |
| 10 | Picture-in-picture + fullscreen | ✅ Player bar |
| 11 | Speed presets 0.5×–2× + unmute controls | ✅ Player |
| 12 | Folder history (last 5) | ✅ Sidebar |
| 13 | Fuzzy path search | ✅ Filename + `webkitRelativePath` |
| 14 | Contact sheet PNG export | ✅ Toolbar |
| 15 | `window.DTube.registerFilter` | ✅ See [docs/PLUGIN.md](docs/PLUGIN.md) |
| 16 | PWA manifest + service worker | ✅ `public/manifest.webmanifest` |
| 17 | GitHub Pages deploy | ✅ `.github/workflows/pages.yml` |
| 18 | Large libraries (1000+ files) | ✅ Early gallery, timeouts, skip GIFs |

## Design

Minimal monospace UI aligned with **LLM Parameter Lab**: white/black palette, blue hover, green accent panels, fixed toolbar, no glassmorphism.

## Keyboard shortcuts

| Key | Gallery | Player |
|-----|---------|--------|
| `?` | Shortcuts overlay | Shortcuts overlay |
| `/` | Focus search | — |
| Space | — | Play / pause |
| `M` | — | Mute / unmute |
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
│   ├── src/lib/        # IDB, fuzzy, shuffle, grouping
│   ├── src/utils/      # mediaExtractor, processVideos
│   └── public/         # PWA manifest, service worker
├── docs/screenshots/   # README assets
├── server/             # Optional Node file server
└── docs/PLUGIN.md
```

## Screenshots

| Welcome | Path |
|---------|------|
| Drag-and-drop library picker | [docs/screenshots/welcome.png](docs/screenshots/welcome.png) |

Captured from the live GitHub Pages build. Regenerate after major UI changes:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --window-size=1400,900 \
  --screenshot=docs/screenshots/welcome.png \
  "https://dmallick01.github.io/dtube-local-video/"
```

## License

MIT
