// Videos per level (level 1, 2, 3)
const THEO_VIDEOS = [
  "mMQCLQTky34", // Level 1: Original rant
  "Sc5ca-VJdxY", // Level 2
  "X1Gfv7P-XRw", // Level 3
];

interface TheoVideoProps {
  level?: number; // 1-3
}

/**
 * Embedded YouTube videos of Theo ranting about Next.js
 * Shows all unlocked videos tiled horizontally
 * Autoplays muted
 */
export const TheoVideo = ({ level = 1 }: TheoVideoProps) => {
  // Get videos to show (all up to current level)
  const videosToShow = THEO_VIDEOS.slice(
    0,
    Math.min(level, THEO_VIDEOS.length),
  );

  // Calculate size based on number of videos
  const videoWidth = level === 1 ? 480 : level === 2 ? 380 : 320;
  const videoHeight = level === 1 ? 340 : level === 2 ? 250 : 210;

  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden shadow-lg border border-zinc-700">
      <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700 flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">
          {level + 1}x SPIN BOOST ACTIVE THEO COMPLAINING
        </span>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", flexWrap: "nowrap" }}
      >
        {videosToShow.map((videoId, index) => (
          <iframe
            key={videoId}
            width={videoWidth}
            height={videoHeight}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`}
            title={`Theo complaining ${index + 1}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ display: "block", flexShrink: 0 }}
          />
        ))}
      </div>
    </div>
  );
};
