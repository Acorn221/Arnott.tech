import type { FC } from "react";

const THEO_VIDEO_ID = "mMQCLQTky34";

/**
 * Embedded YouTube video of Theo ranting about Next.js
 * Autoplays muted (browser policy), user can unmute
 */
const TheoVideo: FC = () => {
  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden shadow-lg border border-zinc-700">
      <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700 flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">2x SPIN BOOST ACTIVE THEO COMPLAINING</span>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      </div>
      <iframe
        width="480"
        height="270"
        src={`https://www.youtube.com/embed/${THEO_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${THEO_VIDEO_ID}`}
        title="Theo complaining about Next.js"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="block"
      />
    </div>
  );
};

export default TheoVideo;
