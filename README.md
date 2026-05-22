# DTube — Local Video Explorer

A sleek, local-first video browser with glassmorphism UI. Drop a folder of videos and browse, sort, filter, and play — entirely in the browser. No upload, no cloud.

## Demo

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and drag a folder of video files onto the window.

## Features

- Drag-and-drop folder scanning (File System Access API)
- Thumbnail generation via canvas
- Sort by name, date, size · filter by extension
- Full-screen video player with keyboard controls
- Anti-gravity glassmorphism design

## Optional server

For environments that need a filesystem proxy:

```bash
cd server
npm install
node server.js
```

## Deploy

```bash
cd frontend
npm run build
# Deploy dist/ to GitHub Pages or Vercel
```

## Project structure

```
dtube-local-video/
├── frontend/     # Vite + React app
└── server/       # Optional Node.js file server
```

## Tech stack

Vite · React 19 · CSS glassmorphism · File System Access API

## License

MIT
