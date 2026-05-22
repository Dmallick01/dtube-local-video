export const generateThumbnail = (file) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    // Timeout fallback just in case the video metadata hangs
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 5000);

    video.onloadedmetadata = () => {
      // Seek to 10%
      video.currentTime = Math.max(0, (video.duration * 0.1) || 1);
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const thumbUrl = canvas.toDataURL('image/jpeg', 0.6);
        URL.revokeObjectURL(url);
        resolve(thumbUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(null); // Return null instead of rejecting to keep the process moving
    };
  });
};
