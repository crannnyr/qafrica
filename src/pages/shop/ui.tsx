// Small, consistent building blocks for shopper pages (cart, checkout, tracking, account).
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, X, Check, Minus, Plus } from 'lucide-react';


/** ⓘ button that opens a short plain-language explanation. Bottom sheet on phones, centred on desktop. */
export function InfoButton({ title, children, label }: { title: string; children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label ?? `What is ${title}?`}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 align-middle"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-xl" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-mt-1 -mr-1 p-1.5 rounded-full hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 text-[13px] leading-relaxed text-gray-600 space-y-2">{children}</div>
            <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full h-10 rounded-lg bg-gray-900 text-white text-[13px] font-semibold">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function PageHeader({ title, right, back = true }: { title: ReactNode; right?: ReactNode; back?: boolean | string }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-2xl mx-auto h-12 px-2 flex items-center gap-1">
        {back ? (
          <button
            type="button"
            onClick={() => (typeof back === 'string' ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate('/stores'))}
            aria-label="Back"
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="flex-1 min-w-0 text-[15px] font-semibold truncate">{title}</h1>
        {right}
      </div>
    </header>
  );
}

export function RoundCheck({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
        checked ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-300'
      }`}
    >
      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
    </button>
  );
}

export function QtyStepper({ value, max = 99, onChange, label }: { value: number; max?: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center h-7 rounded-md border border-gray-200" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label="Decrease quantity" className="w-7 h-full flex items-center justify-center text-gray-600 disabled:opacity-30">
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-7 text-center text-[13px] tabular-nums" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity" className="w-7 h-full flex items-center justify-center text-gray-600 disabled:opacity-30">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

/** Reusable explanation of how QAFRICA holds money (escrow). */
export function EscrowExplainer() {
  return (
    <>
      <p>You pay QAFRICA securely through Nomba (card, bank transfer or USSD). The seller does not receive your money straight away.</p>
      <p>We hold it until your order is delivered. If there's a problem, report it from your order page before the money is released and we'll step in.</p>
    </>
  );
}

export function Field(props: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string;
  type?: string; autoComplete?: string; inputMode?: 'text' | 'email' | 'tel'; placeholder?: string; optional?: boolean;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="block text-[12px] font-medium text-gray-700 mb-1">
        {props.label} {props.optional && <span className="text-gray-400 font-normal">(optional)</span>}
      </label>
      <input
        id={props.id}
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        placeholder={props.placeholder}
        aria-invalid={!!props.error}
        aria-describedby={props.error ? `${props.id}-err` : undefined}
        className={`w-full h-11 px-3 rounded-lg border bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-900 ${props.error ? 'border-[#C4320A]' : 'border-gray-300'}`}
      />
      {props.error && <p id={`${props.id}-err`} className="mt-1 text-[12px] text-[#C4320A]">{props.error}</p>}
    </div>
  );
}
