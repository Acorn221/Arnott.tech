import { type FC, useEffect, useRef } from "react";
import type { SpinResult } from "./SlotMachineContext";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: SpinResult | null;
  screenshot: string | null;
}

const ShareDialog: FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  result,
  screenshot,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen || !result) return null;

  const { backend, frontend, database, score } = result;

  const shareText = `🎰 My Tech Stack Slot Machine Result!\n\n` +
    `Backend: ${backend.name}\n` +
    `Frontend: ${frontend.name}\n` +
    `Database: ${database.name}\n\n` +
    `${score.emoji} Score: ${score.score}/100 - ${score.label}`;

  const shareUrl = window.location.href;

  // Twitter share URL
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

  // LinkedIn share URL - pre-filled text, no URL
  const linkedInText = `🎰 Just spun the Tech Stack Slot Machine!\n\n` +
    `My stack: ${backend.name} + ${frontend.name} + ${database.name}\n\n` +
    `${score.emoji} Score: ${score.score}/100 - ${score.label}\n\n` +
    `Try your luck at https://a.rno.tt`;
  const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(linkedInText)}`;

  // Download screenshot
  const handleDownload = () => {
    if (!screenshot) return;
    const link = document.createElement("a");
    link.href = screenshot;
    link.download = `tech-stack-${score.score}.png`;
    link.click();
  };

  // Twitter share - download image and open Twitter
  const handleTwitterShare = () => {
    handleDownload();
    window.open(twitterUrl, "_blank");
  };

  // LinkedIn share - download image and open LinkedIn
  const handleLinkedInShare = () => {
    handleDownload();
    window.open(linkedInUrl, "_blank");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="relative mx-4 max-w-md w-full bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden"
        style={{
          animation: "dialogSlideIn 0.3s ease-out",
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700/50 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🎰</span>
            Share Your Result
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Screenshot Preview */}
        {screenshot && (
          <div className="px-6 pt-4">
            <div className="rounded-lg overflow-hidden border border-gray-700/50 shadow-inner">
              <img
                src={screenshot}
                alt="Slot Machine Result"
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

        {/* Result Summary */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-400">
                <span className="text-gray-300">{backend.shortName}</span> + <span className="text-gray-300">{frontend.shortName}</span> + <span className="text-gray-300">{database.shortName}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{score.emoji}</span>
              <span
                className="text-lg font-bold"
                style={{ color: score.color }}
              >
                {score.score}
              </span>
            </div>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="px-6 pb-6 flex flex-col gap-3">
          {/* Social Share */}
          <div className="flex gap-3">
            <button
              onClick={handleTwitterShare}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-semibold rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Post on X</span>
            </button>
            <button
              onClick={handleLinkedInShare}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span>Share on LinkedIn</span>
            </button>
          </div>

          {/* Download Button */}
          {screenshot && (
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors border border-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Screenshot</span>
            </button>
          )}
        </div>

        {/* CSS Animation */}
        <style>{`
          @keyframes dialogSlideIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default ShareDialog;

