// Qbot — the QAFRICA mascot guide. A speech-bubble callout paired with a cutout character
// image, used across onboarding (homepage, signup, and later steps) to keep users motivated
// and feeling guided through an ecosystem rather than dropped into a form.
//
// Usage:
//   <QbotGuide
//     stepId="home-intro"
//     message="Hey, I'm Qbot — not just an AI, I'm about to become your best business analyst..."
//     ctaLabel="Start My Store"
//     onCta={() => navigate('/signup')}
//     imageSrc="https://.../qbot-wave.webp"
//     imageSize="lg"
//   />
//
// Each step should pass a unique `stepId` — once a user dismisses that step's bubble it won't
// nag them again on that step (remembered per-browser). A fresh `stepId` on a later page always
// shows again, so the guide still greets them at each stage of the journey.
//
// Positioning: `position="corner"` floats bottom-right, out of the way of page content — used
// on roomy desktop/tablet viewports. On phones there usually isn't enough vertical room below
// the hero for a corner card without it covering the primary CTA, so below the `sm` breakpoint
// this always renders as a full backdrop popup instead, regardless of the `position` prop.

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export type QbotPosition = 'corner' | 'center' | 'inline';
export type QbotImageSize = 'md' | 'lg';

interface QbotGuideProps {
  /** Unique id for this step/page — used to remember dismissal so it doesn't repeat. */
  stepId: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
  /** Cutout character image (transparent background). Falls back to the QAFRICA bag mark. */
  imageSrc?: string;
  /** 'corner' floats bottom-right on desktop (always 'center' on phones — see file header).
   *  'inline' sits in normal page flow (e.g. above a form), character pointing down at
   *  whatever follows it — never forced to 'center' on mobile since it doesn't float. */
  position?: QbotPosition;
  /** 'md' = small icon inline with the text. 'lg' = full character peeking above the bubble. */
  imageSize?: QbotImageSize;
  /** Delay before it appears, so it doesn't fight page-entrance animations. */
  delayMs?: number;
  /** Skip the "seen it" memory and always show (rarely needed). */
  alwaysShow?: boolean;
}

const DISMISSED_KEY = 'qafrica_qbot_dismissed';
const MOBILE_QUERY = '(max-width: 639px)';

function getDismissed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}');
  } catch {
    return {};
  }
}

function markDismissed(stepId: string) {
  try {
    const all = getDismissed();
    all[stepId] = true;
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(all));
  } catch {
    // private mode / storage blocked — fine, it'll just show again next time
  }
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

export default function QbotGuide({
  stepId,
  message,
  ctaLabel,
  onCta,
  imageSrc = '/qafrica-bag-logo.svg',
  position = 'corner',
  imageSize = 'md',
  delayMs = 600,
  alwaysShow = false,
}: QbotGuideProps) {
  const [visible, setVisible] = useState(false);
  const isMobile = useIsMobile();
  // Only the floating 'corner' widget needs to fall back on phones (not enough room without
  // covering page content) — 'inline' already sits safely in the page's own flow.
  const effectivePosition: QbotPosition = isMobile && position === 'corner' ? 'center' : position;

  useEffect(() => {
    if (!alwaysShow && getDismissed()[stepId]) return;
    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [stepId, delayMs, alwaysShow]);

  const dismiss = () => {
    setVisible(false);
    markDismissed(stepId);
  };

  const handleCta = () => {
    onCta?.();
    dismiss();
  };

  const isLg = imageSize === 'lg';
  const isCenter = effectivePosition === 'center';
  const isInline = effectivePosition === 'inline';
  const isCorner = effectivePosition === 'corner';

  const card = (
    <div className={`relative ${isLg ? 'pt-9 sm:pt-11' : ''}`}>
      {/* Full-body character, peeking above the bubble */}
      {isLg && (
        <motion.img
          src={imageSrc}
          alt="Qbot"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-20 sm:w-24 h-auto object-contain drop-shadow-xl select-none pointer-events-none"
          draggable={false}
        />
      )}

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 p-4 pr-9">
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className={isLg ? 'text-center' : 'flex items-start gap-3'}>
          {!isLg && (
            <motion.img
              src={imageSrc}
              alt="Qbot"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-11 h-11 sm:w-14 sm:h-14 flex-shrink-0 object-contain drop-shadow-md"
            />
          )}
          <div className="min-w-0 pt-0.5">
            <p className="text-[11px] sm:text-xs font-semibold text-orange-500 mb-0.5">Qbot</p>
            <p className="text-[13px] sm:text-sm text-gray-700 dark:text-gray-200 leading-snug">{message}</p>
            {ctaLabel && (
              <button
                onClick={handleCta}
                className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3.5 py-2 rounded-lg transition-colors ${isLg ? 'w-full justify-center' : ''}`}
              >
                {ctaLabel}
              </button>
            )}
          </div>
        </div>

        {/* Speech-bubble tail, corner mode only — inline already connects via the overlapping character */}
        {isCorner && (
          <div className="hidden sm:block absolute -bottom-1.5 right-10 w-3 h-3 bg-white dark:bg-gray-800 rotate-45 ring-1 ring-black/5 dark:ring-white/10" />
        )}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {visible && (
        <>
          {isCenter && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[90]"
              onClick={dismiss}
            />
          )}

          {isCenter && (
            <div className="fixed inset-0 z-[91] flex items-center justify-center p-5 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className="w-full max-w-xs pointer-events-auto"
              >
                {card}
              </motion.div>
            </div>
          )}

          {isCorner && (
            <motion.div
              initial={{ opacity: 0, y: 40, x: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className={`fixed z-[91] bottom-6 right-6 ${isLg ? 'w-80' : 'w-72'}`}
            >
              {card}
            </motion.div>
          )}

          {isInline && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="relative w-full max-w-xs mx-auto"
            >
              {card}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
