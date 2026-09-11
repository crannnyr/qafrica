// src/components/ImportQtyControl.tsx
//
// One quantity control, three sizes, used everywhere a cart quantity is
// shown: the catalog grid card (xs), the product detail page (md), and the
// checkout sheet (sm). Typing a number commits on blur or Enter; the +/-
// buttons keep working exactly as before for a quick single-unit nudge.
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const SIZES = {
  xs: { btn: 'w-5 h-5', icon: 'w-2.5 h-2.5', input: 'w-6 text-xs' },
  sm: { btn: 'w-6 h-6', icon: 'w-2.5 h-2.5', input: 'w-8 text-sm' },
  md: { btn: 'w-8 h-8', icon: 'w-3.5 h-3.5', input: 'w-10 text-base' },
} as const;

export default function ImportQtyControl({
  quantity,
  size = 'md',
  onDecrement,
  onIncrement,
  onSetQuantity,
  className = '',
  textClassName = 'text-gray-900',
  iconClassName = 'text-gray-500',
  buttonClassName = 'bg-gray-100 hover:bg-gray-200',
}: {
  quantity: number;
  size?: keyof typeof SIZES;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Called on blur/Enter with the typed value. 0 or empty means "remove". */
  onSetQuantity: (n: number) => void;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  buttonClassName?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const dims = SIZES[size];

  const commit = () => {
    if (draft === null) return;
    const n = draft.trim() === '' ? 0 : Number(draft);
    onSetQuantity(Number.isFinite(n) ? n : quantity);
    setDraft(null);
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={onDecrement}
        aria-label="Decrease quantity"
        className={`${dims.btn} rounded-full ${buttonClassName} flex items-center justify-center flex-shrink-0 transition-colors`}
      >
        <Minus className={`${dims.icon} ${iconClassName}`} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label="Quantity"
        value={draft ?? String(quantity)}
        onFocus={e => { setDraft(String(quantity)); e.target.select(); }}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={`${dims.input} font-bold ${textClassName} text-center bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      />
      <button
        type="button"
        onClick={onIncrement}
        aria-label="Increase quantity"
        className={`${dims.btn} rounded-full ${buttonClassName} flex items-center justify-center flex-shrink-0 transition-colors`}
      >
        <Plus className={`${dims.icon} ${iconClassName}`} />
      </button>
    </div>
  );
}
