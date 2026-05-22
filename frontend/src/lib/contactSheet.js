export async function exportContactSheet(videos, { cols = 4, cellW = 320, cellH = 180 } = {}) {
  const items = videos.filter((v) => v.thumbnail).slice(0, cols * cols);
  if (!items.length) {
    alert('No thumbnails available for contact sheet.');
    return;
  }
  const rows = Math.ceil(items.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await Promise.all(
    items.map(
      (v, i) =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * cellW;
            const y = row * cellH;
            const scale = Math.min(cellW / img.width, (cellH - 24) / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.drawImage(img, x + (cellW - w) / 2, y + 4, w, h);
            ctx.fillStyle = '#000';
            ctx.font = '11px monospace';
            const label = v.name.length > 42 ? v.name.slice(0, 40) + '…' : v.name;
            ctx.fillText(label, x + 8, y + cellH - 8);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = v.thumbnail;
        }),
    ),
  );

  const a = document.createElement('a');
  a.download = `dtube-contact-sheet-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}
