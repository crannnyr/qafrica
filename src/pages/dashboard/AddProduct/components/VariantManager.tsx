import { useState, useCallback } from 'react';
import { Plus, X, Info, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { VariantCombination, VariantOption } from '../types';

export function VariantManager({ variants, onChange, basePrice }: {
  variants: VariantCombination[];
  onChange: (variants: VariantCombination[]) => void;
  basePrice: number;
}) {
  const [options, setOptions] = useState<VariantOption[]>([
    { name: 'Color', rawInput: '', values: [] },
    { name: 'Size',  rawInput: '', values: [] },
  ]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const addOption    = () => { setOptions([...options, { name: '', rawInput: '', values: [] }]); setHasGenerated(false); };
  const removeOption = (i: number) => { setOptions(options.filter((_, idx) => idx !== i)); setHasGenerated(false); };
  const updateName   = (i: number, name: string) => { const n = [...options]; n[i] = { ...n[i], name }; setOptions(n); setHasGenerated(false); };
  const updateRaw    = (i: number, raw: string)  => { const n = [...options]; n[i] = { ...n[i], rawInput: raw }; setOptions(n); setHasGenerated(false); };

  const generateCombinations = useCallback(() => {
    const parsed = options.map(o => ({ ...o, values: o.rawInput.split(',').map(v => v.trim()).filter(Boolean) }));
    const valid  = parsed.filter(o => o.name.trim() && o.values.length > 0);
    if (valid.length === 0) { toast.error('Enter at least one option name and values'); return; }
    const names = valid.map(o => o.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) { toast.error('Option names must be unique'); return; }
    setOptions(parsed);

    const combos: VariantCombination[] = [];
    const gen = (cur: Record<string, string>, idx: number) => {
      if (idx === valid.length) {
        const ex = variants.find(v => Object.keys(cur).every(k => v.options[k] === cur[k]));
        combos.push(ex ? { ...ex, options: { ...cur } } : { id: Math.random().toString(36).substr(2, 9), options: { ...cur }, price: basePrice, stock: 0, sku: '' });
        return;
      }
      for (const val of valid[idx].values) { cur[valid[idx].name] = val; gen(cur, idx + 1); delete cur[valid[idx].name]; }
    };
    gen({}, 0);
    onChange(combos);
    setHasGenerated(true);
    toast.success(`${combos.length} combination${combos.length !== 1 ? 's' : ''} generated`);
  }, [options, basePrice, variants, onChange]);

  const updateVariant = (id: string, field: keyof VariantCombination, value: any) =>
    onChange(variants.map(v => v.id === id ? { ...v, [field]: value } : v));

  const inputCls = "px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs";

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          <p className="font-semibold mb-1">How variants work</p>
          <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
            <li>Name each option (e.g. <strong>Color</strong>)</li>
            <li>Enter values separated by commas (e.g. <strong>Red, Blue</strong>)</li>
            <li>Click <strong>Generate Combinations</strong></li>
            <li>Set price and stock per combination</li>
          </ol>
        </div>
      </div>

      {options.map((opt, i) => (
        <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <input type="text" value={opt.name} onChange={e => updateName(i, e.target.value)}
              placeholder="Option name (e.g. Color)"
              className="text-xs font-medium bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 w-40" />
            <button type="button" onClick={() => removeOption(i)}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">
              Remove
            </button>
          </div>
          <input type="text" value={opt.rawInput} onChange={e => updateRaw(i, e.target.value)}
            placeholder="e.g. Red, Blue, Green"
            className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white" />
          <p className="text-[10px] text-gray-400 mt-1">Separate each value with a comma.</p>
          {hasGenerated && opt.values.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {opt.values.map((val, vi) => (
                <span key={vi} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-medium border border-orange-200">{val}</span>
              ))}
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addOption}
        className="w-full border-dashed border-2 hover:border-orange-400 hover:bg-orange-50 text-xs h-9">
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Another Option
      </Button>

      <Button type="button" onClick={generateCombinations}
        disabled={!options.some(o => o.name.trim() && o.rawInput.trim())}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-200 disabled:text-gray-400 h-10 text-sm">
        <RefreshCw className="w-3.5 h-3.5 mr-2" /> Generate Combinations
      </Button>

      {variants.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Variant', 'Price (₦)', 'Stock', 'SKU', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {variants.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(v.options).map(([k, val]) => (
                        <span key={k} className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-medium">{k}: {val}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={v.price} onChange={e => updateVariant(v.id, 'price', parseFloat(e.target.value) || 0)}
                      className={`${inputCls} w-24`} min="0" step="0.01" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={v.stock} onChange={e => updateVariant(v.id, 'stock', parseInt(e.target.value) || 0)}
                      className={`${inputCls} w-16`} min="0" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={v.sku} onChange={e => updateVariant(v.id, 'sku', e.target.value)}
                      placeholder="Optional" className={`${inputCls} w-24`} />
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => onChange(variants.filter(vv => vv.id !== v.id))}
                      className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t text-[10px] text-gray-500">
                <td className="px-3 py-2">{variants.length} combination{variants.length !== 1 ? 's' : ''}</td>
                <td colSpan={4} className="px-3 py-2 text-right">Total stock: {variants.reduce((s, v) => s + (v.stock || 0), 0)} units</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}