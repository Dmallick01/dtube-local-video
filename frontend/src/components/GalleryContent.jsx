import React from 'react';
import VideoCard from './VideoCard';
import VideoListView from './VideoListView';

export default function GalleryContent({
  groups,
  viewMode,
  gridCols,
  favorites,
  progressMap,
  onPlay,
  onToggleFavorite,
  onAddQueue,
}) {
  const minCol = gridCols === 'compact' ? 200 : gridCols === 'wide' ? 360 : 260;

  return (
    <div className="gallery-groups">
      {groups.map((group) => (
        <section key={group.key} className="gallery-group">
          <h3 className="group-header">
            {group.label}
            <span className="group-count">{group.videos.length}</span>
          </h3>
          {viewMode === 'list' ? (
            <VideoListView
              videos={group.videos}
              favorites={favorites}
              progressMap={progressMap}
              onPlay={onPlay}
              onToggleFavorite={onToggleFavorite}
              onAddQueue={onAddQueue}
            />
          ) : (
            <div
              className="video-grid"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))` }}
            >
              {group.videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  isFavorite={favorites.has(video.id)}
                  onToggleFavorite={() => onToggleFavorite(video.id)}
                  watchSeconds={progressMap[video.id] || 0}
                  onClick={() => onPlay(video)}
                  onAddQueue={() => onAddQueue(video.id)}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
