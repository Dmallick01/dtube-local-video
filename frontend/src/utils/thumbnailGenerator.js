function captureFrame(video, url) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return null;
  }
}

function seekAndCapture(file, timeSec) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 6000);

    video.onloadedmetadata = () => {
      const t = Math.min(Math.max(0, timeSec), Math.max(0, (video.duration || 1) - 0.1));
      video.currentTime = t || 0;
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      const thumb = captureFrame(video, url);
      URL.revokeObjectURL(url);
      resolve(thumb);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}

export const generateThumbnail = (file) => seekAndCapture(file, 0);

export const generateThumbnailAtTime = (file, timeSec) => seekAndCapture(file, timeSec);
