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
 * Embedded YouTube video of Theo ranting about Next.js
 * Shows one video based on level, higher levels = different video + higher multiplier
 * Autoplays muted
 */
export const TheoVideo = ({ level = 1 }: TheoVideoProps) => {
  const videoIndex = Math.min(level - 1, THEO_VIDEOS.length - 1);
  const videoId = THEO_VIDEOS[videoIndex];
  const multiplier = level + 1;

  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden shadow-lg border border-zinc-700">
      <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700 flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">
          {multiplier}x SPIN BOOST ACTIVE
        </span>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      </div>
      <iframe
        key={videoId}
        width={400}
        height={225}
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`}
        title="Theo complaining"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ display: "block" }}
      />
    </div>
  );
};
