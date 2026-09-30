// Dashboard setup guide: runs the spotlight tour on a store owner's first visit, and keeps a
// setup checklist in the corner (confirm email first) until every item is done.
// Mounted once in DashboardLayout. Staff never see it.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Circle, ChevronRight, Copy, PlayCircle, X, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import SpotlightTour from './SpotlightTour';
import { CHECKLIST, TOUR_STEPS, type TourStep } from './guideSteps';
import { useGuideProgress } from './useGuideProgress';

type Props = {
  /** Make sidebar targets visible: expand on desktop, slide in on phones. */
  openSidebar: () => void;
  closeMobileSidebar: () => void;
};

export const OPEN_GUIDE_EVENT = 'qafrica:open-guide';
export const REPLAY_TOUR_EVENT = 'qafrica:replay-tour';

export default function SetupGuide({ openSidebar, closeMobileSidebar }: Props) {
  const { guide, done, loaded, saveGuide, user, currentStore } = useGuideProgress();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [tourSteps, setTourSteps] = useState<TourStep[] | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);

  const isOwner = user?.role === 'store_owner';
  const doneCount = CHECKLIST.filter((c) => done[c.key]).length;
  const allDone = doneCount === CHECKLIST.length;
  const seenAll = useMemo(() => new Set([...(guide.seen ?? []), ...seen]), [guide.seen, seen]);
  const unseenCore = TOUR_STEPS.filter((s) => s.core && !seenAll.has(s.id));

  // First visit to the dashboard home: start the tour
  const tourFinished = !!(guide.tour_done_at || guide.tour_skipped_at);
  useEffect(() => {
    if (!isOwner || !loaded || tourFinished || tourSteps || pathname !== '/dashboard') return;
    const t = setTimeout(() => setTourSteps(TOUR_STEPS), 700);
    return () => clearTimeout(t);
  }, [isOwner, loaded, tourFinished, tourSteps, pathname]);

  // Other pages can open the checklist or replay the tour
  useEffect(() => {
    const open = () => setPanelOpen(true);
    const replay = () => { setPanelOpen(false); setSeen([]); navigate('/dashboard'); setTourSteps(TOUR_STEPS); };
    window.addEventListener(OPEN_GUIDE_EVENT, open);
    window.addEventListener(REPLAY_TOUR_EVENT, replay);
    return () => { window.removeEventListener(OPEN_GUIDE_EVENT, open); window.removeEventListener(REPLAY_TOUR_EVENT, replay); };
  }, [navigate]);

  const prepare = useCallback((step: TourStep) => {
    if (step.target?.startsWith('nav-') || step.target === 'sidebar-nav' || step.target === 'store-card') openSidebar();
    else closeMobileSidebar();
  }, [openSidebar, closeMobileSidebar]);

  const onSeen = useCallback((id: string) => setSeen((s) => (s.includes(id) ? s : [...s, id])), []);

  const finishTour = useCallback((reason: 'done' | 'skipped') => {
    const allSeen = Array.from(new Set([...(guide.seen ?? []), ...seen]));
    setTourSteps(null);
    closeMobileSidebar();
    void saveGuide(reason === 'done' ? { tour_done_at: new Date().toISOString(), seen: allSeen } : { tour_skipped_at: new Date().toISOString(), seen: allSeen });
    if (!allDone) setTimeout(() => setPanelOpen(true), 350);
  }, [guide.seen, seen, closeMobileSidebar, saveGuide, allDone]);

  const showCoreOnly = useCallback(() => {
    const rest = TOUR_STEPS.filter((s) => s.core && !seenAll.has(s.id));
    const finish = TOUR_STEPS.find((s) => s.id === 'finish')!;
    setTourSteps(null);
    setTimeout(() => setTourSteps([...rest, finish]), 50);
  }, [seenAll]);

  const storeUrl = currentStore
    ? currentStore.custom_domain && currentStore.domain_status === 'connected'
      ? `https://${currentStore.custom_domain}`
      : `${window.location.origin}/${currentStore.slug}`
    : '';

  const shareLink = async () => {
    try {
      if (navigator.share) await navigator.share({ title: currentStore?.name, url: storeUrl });
      else { await navigator.clipboard.writeText(storeUrl); toast.success('Store link copied. Paste it in your WhatsApp status or Instagram bio.'); }
      void saveGuide({ shared_link_at: new Date().toISOString() });
    } catch {
      /* share sheet closed */
    }
  };

  if (!isOwner) return null;

  return (
    <>
      {tourSteps && (
        <SpotlightTour
          key={tourSteps.length}
          steps={tourSteps}
          storeName={currentStore?.name}
          prepare={prepare}
          onSeen={onSeen}
          onClose={finishTour}
          unseenCore={unseenCore}
          onShowCore={showCoreOnly}
        />
      )}

      {/* Floating progress button */}
      {!tourSteps && loaded && !allDone && !guide.checklist_hidden_at && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2.5 rounded-full bg-gray-900 text-white pl-2 pr-4 h-12 shadow-xl hover:bg-gray-800"
        >
          <ProgressRing value={doneCount / CHECKLIST.length} />
          <span className="text-sm font-semibold">Setup {doneCount}/{CHECKLIST.length}</span>
        </motion.button>
      )}

      {/* Checklist panel */}
      <AnimatePresence>
        {panelOpen && !tourSteps && (
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed z-40 bottom-20 right-4 left-4 sm:left-auto sm:w-[380px] max-h-[75vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/5 p-5"
            aria-label="Setup checklist"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-bold text-gray-900 dark:text-white"><Rocket className="w-4 h-4 text-orange-500" /> Get your store ready</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{allDone ? 'All done. Nice work.' : `${CHECKLIST.length - doneCount} left. Start from the top.`}</p>
              </div>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Close" className="p-1 -m-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <motion.div className="h-full bg-orange-500 rounded-full" initial={false} animate={{ width: `${(doneCount / CHECKLIST.length) * 100}%` }} />
            </div>

            <ol className="mt-4 space-y-1">
              {CHECKLIST.map((c, i) => {
                const ok = done[c.key];
                const firstOpen = !ok && CHECKLIST.findIndex((x) => !done[x.key]) === i;
                const onClick = () => {
                  if (c.key === 'share') { void shareLink(); return; }
                  setPanelOpen(false);
                  navigate(c.to);
                };
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={onClick}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${firstOpen ? 'bg-orange-50 dark:bg-orange-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                      {ok ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <Circle className={`w-5 h-5 shrink-0 ${firstOpen ? 'text-orange-500' : 'text-gray-300'}`} />}
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm ${ok ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white font-medium'}`}>{i + 1}. {c.label}</span>
                        {!ok && <span className="block text-xs text-gray-500 dark:text-gray-400">{c.hint}</span>}
                      </span>
                      {!ok && (c.key === 'share' ? <Copy className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />)}
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setPanelOpen(false); setSeen([]); navigate('/dashboard'); setTourSteps(TOUR_STEPS); }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:underline underline-offset-4"
              >
                <PlayCircle className="w-4 h-4" /> Replay the tour
              </button>
              {allDone && (
                <button type="button" onClick={() => { setPanelOpen(false); void saveGuide({ checklist_hidden_at: new Date().toISOString() }); }} className="text-sm text-gray-500 hover:text-gray-800">
                  Hide checklist
                </button>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
      <motion.circle
        cx="17" cy="17" r={r} fill="none" stroke="#F97316" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - value) }}
        transform="rotate(-90 17 17)"
      />
    </svg>
  );
}
