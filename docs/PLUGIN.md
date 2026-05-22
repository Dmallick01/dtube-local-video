# DTube plugin hook

Register custom gallery filters from the browser console or a script loaded after the app:

```javascript
// Only show files larger than 50 MB
window.DTube.registerFilter((video) => video.size > 50 * 1024 * 1024);

// Only favorites (if you also star items in the UI)
window.DTube.registerFilter((video) => true);
```

Filters run after search, extension, and favorites filters. Each function receives a video object `{ id, name, relativePath, file, size, createdAt, thumbnail }` and must return `true` to keep the row.

`window.DTube.version` reports the plugin API level.
