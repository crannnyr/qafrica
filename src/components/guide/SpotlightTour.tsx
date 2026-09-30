// Spotlight tour: dims the page, cuts a glowing window around the element being explained,
// and shows a card beside it (a bottom sheet on phones). The window glides between steps.
// Skipping before the core steps have been seen shows what the seller would miss first.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, X, Sparkles, CheckCircle2 } from 'lucide-react';
import type { TourStep } from './guideSteps';

type Rect = { x: number; y: number; w: number; h: number };
type Props = {
  steps: TourStep[];
  storeName?: string;
  /** Called before a step shows, so the dashboard can open the sidebar for menu targets. */
  prepare?: (step: TourStep) => void;
  onSeen: (id: string) => void;
  /** 'done' = reached the end; 'skipped' = chose to skip anyway. */
  onClose: (reason: 'done' | 'skipped') => void;
  /** Core steps not seen yet; used by the skip warning. */
  unseenCore: TourStep[];
  onShowCore: () => void;
};

const PAD = 8;
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function findTarget(step?: TourStep): HTMLElement | null {
  if (!step?.target) return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(step.target)}"]`));
  // First one that is actually on screen (sidebars render twice on some layouts)
  return els.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
  }) ?? null;
}

export default function SpotlightTour({ steps, storeName, prepare, onSeen, onClose, unseenCore, onShowCore }: Props) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;
  const mobile = vw < 640;

  // Let the dashboard open whatever the step points at, then mark it seen
  useLayoutEffect(() => {
    if (!step) return;
    prepare?.(step);
    onSeen(step.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  // Track the target's position (sidebars slide in, pages scroll, windows resize)
  useEffect(() => {
    let frame = 0;
    let alive = true;
    const started = performance.now();
    const measure = () => {
      if (!alive) return;
      const el = findTarget(step);
      if (el) {
        if (performance.now() - started < 80) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const r = el.getBoundingClientRect();
        setRect((prev) => {
          const next = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
          return prev && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5 && Math.abs(prev.w - next.w) < 0.5 && Math.abs(prev.h - next.h) < 0.5 ? prev : next;
        });
      } else {
        setRect(null);
      }
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => { alive = false; cancelAnimationFrame(frame); };
  }, [step]);

  useEffect(() => { cardRef.current?.focus({ preventScroll: true }); }, [index, confirmSkip]);

  const next = useCallback(() => (last ? onClose('done') : setIndex((i) => i + 1)), [last, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const trySkip = useCallback(() => {
    if (unseenCore.length > 0) setConfirmSkip(true);
    else onClose('skipped');
  }, [unseenCore.length, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmSkip) { if (e.key === 'Escape') setConfirmSkip(false); return; }
      if (e.key === 'Escape') trySkip();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmSkip, next, back, trySkip]);

  if (!step) return null;

  // Card placement: beside the target on wide screens, bottom sheet on phones, centred when no target
  const cardW = 360;
  let cardStyle: React.CSSProperties;
  if (mobile) {
    cardStyle = { left: 12, right: 12, bottom: 12 };
  } else if (!rect) {
    cardStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 420 };
  } else if (rect.x + rect.w + 16 + cardW < vw) {
    cardStyle = { left: rect.x + rect.w + 16, top: Math.min(Math.max(16, rect.y), vh - 300), width: cardW };
  } else if (rect.y + rect.h + 16 + 260 < vh) {
    cardStyle = { left: Math.min(Math.max(16, rect.x), vw - cardW - 16), top: rect.y + rect.h + 16, width: cardW };
  } else {
    cardStyle = { left: Math.min(Math.max(16, rect.x), vw - cardW - 16), top: Math.max(16, rect.y - 276), width: cardW };
  }

  const spring = reduceMotion() ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 30 };
  const title = step.id === 'welcome' && storeName ? `Let's get ${storeName} ready` : step.title;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Dashboard tour">
      {/* Dimmed layer with a window cut around the target */}
      <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <mask id="qafrica-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <motion.rect
                initial={false}
                animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }}
                transition={spring}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(15,23,42,0.62)" mask="url(#qafrica-tour-mask)" />
      </svg>

      {/* Glowing, pulsing ring around the target */}
      {rect && (
        <motion.div
          aria-hidden="true"
          className="absolute rounded-[14px] pointer-events-none"
          initial={false}
          animate={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          transition={spring}
          style={{ boxShadow: '0 0 0 2px #F97316, 0 0 0 6px rgba(249,115,22,0.25), 0 0 32px 4px rgba(249,115,22,0.35)' }}
        >
          {!reduceMotion() && (
            <motion.span
              className="absolute inset-0 rounded-[14px] border-2 border-orange-400"
              animate={{ scale: [1, 1.08, 1], opacity: [0.9, 0, 0.9] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </motion.div>
      )}

      {/* Step card */}
      <AnimatePresence mode="wait">
        {!confirmSkip ? (
          <motion.div
            key={step.id}
            ref={cardRef}
            tabIndex={-1}
            initial={reduceMotion() ? false : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion() ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="absolute bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 p-5 outline-none"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-600">
                {step.core ? <><CheckCircle2 className="w-3.5 h-3.5" /> Must know</> : <><Sparkles className="w-3.5 h-3.5" /> Tour</>}
              </span>
              <span className="text-xs text-gray-400 tabular-nums">{index + 1} of {steps.length}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-snug">{title}</h2>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.body}</p>

            {step.cta && (
              <button
                type="button"
                onClick={() => { onClose(last ? 'done' : 'skipped'); navigate(step.cta!.to); }}
                className="mt-3 text-sm font-semibold text-orange-600 hover:underline underline-offset-4"
              >
                {step.cta.label} →
              </button>
            )}

            {/* Progress dots */}
            <div className="mt-4 flex gap-1" aria-hidden="true">
              {steps.map((s, i) => (
                <span key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-5 bg-orange-500' : i < index ? 'w-1.5 bg-orange-300' : 'w-1.5 bg-gray-200'}`} />
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {!last && (
                <button type="button" onClick={trySkip} className="text-sm text-gray-500 hover:text-gray-800 mr-auto">
                  Skip tour
                </button>
              )}
              {last && <span className="mr-auto" />}
              {index > 0 && (
                <button type="button" onClick={back} aria-label="Back" className="h-10 w-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={next} className="h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold inline-flex items-center gap-1.5">
                {index === 0 ? "Let's go" : last ? 'Finish' : 'Next'} {!last && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="confirm-skip"
            ref={cardRef}
            tabIndex={-1}
            initial={reduceMotion() ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 p-5 outline-none"
            style={mobile ? { left: 12, right: 12, bottom: 12 } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 440 }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">Before you go: {unseenCore.length} thing{unseenCore.length > 1 ? 's' : ''} every seller must know</h2>
              <button type="button" onClick={() => setConfirmSkip(false)} aria-label="Back to the tour" className="p-1 -m-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <ul className="mt-3 space-y-2">
              {unseenCore.map((s) => (
                <li key={s.id} className="flex gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
                  <span><span className="font-medium text-gray-900">{s.title}.</span> {s.short ?? s.body}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={() => onClose('skipped')} className="h-10 px-4 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Skip anyway</button>
              <button type="button" onClick={onShowCore} className="h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">
                Show me (about 1 minute)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
