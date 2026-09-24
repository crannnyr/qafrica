// src/pages/recommendations/CustomOrderRequestPage.tsx
// Public route /custom-order. Explains how custom sourcing works, then lets
// a signed-in customer submit a list of items (image + description + qty +
// estimated budget each) for admin to source and link individually. Sign-in
// is required to submit, not to read the explainer — matches the pattern
// used elsewhere in the import flow (browse freely, auth only at the point
// action is actually taken).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, ArrowLeft, Loader, X, Plus, Sparkles,
  ImagePlus, CheckCircle2, MessageSquareText, Hash, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/services';
import CONFIG from '@/lib/config';
import { useCustomerAuthStore } from '@/stores';
import ImportAuthSheet from './ImportAuthSheet';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/custom-orders`;

interface DraftItem {
  key: string;
  imageFile: File | null;
  imagePreview: string;
  imageUrl: string | null;
  isUploading: boolean;
  description: string;
  quantity: string;
  estimatedBudget: string;
}

const emptyItem = (): DraftItem => ({
  key: crypto.randomUUID(), imageFile: null, imagePreview: '', imageUrl: null,
  isUploading: false, description: '', quantity: '1', estimatedBudget: '',
});

export default function CustomOrderRequestPage() {
  const navigate = useNavigate();
  const { customer, isAuthenticated } = useCustomerAuthStore();
  const [showAuth, setShowAuth] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateItem = (key: string, patch: Partial<DraftItem>) =>
    setItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i));

  const removeItem = (key: string) => setItems(prev => prev.length > 1 ? prev.filter(i => i.key !== key) : prev);

  const handleImageSelect = async (key: string, file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB.'); return; }
    if (!customer) return;

    const preview = URL.createObjectURL(file);
    updateItem(key, { imageFile: file, imagePreview: preview, isUploading: true, imageUrl: null });
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${customer.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('custom-order-images').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('custom-order-images').getPublicUrl(path);
      updateItem(key, { imageUrl: publicUrl, isUploading: false });
    } catch (err: any) {
      toast.error(err?.message || 'Could not upload that image. Please try again.');
      updateItem(key, { isUploading: false, imageFile: null, imagePreview: '' });
    }
  };

  const canSubmit = items.every(i => i.imageUrl && i.description.trim() && Number(i.quantity) > 0) && !isSubmitting;

  const submit = async () => {
    if (!customer || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=submit-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          items: items.map(i => ({
            image_url: i.imageUrl, description: i.description.trim(),
            quantity: Number(i.quantity), estimated_budget_ngn: i.estimatedBudget ? Number(i.estimatedBudget) : null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Could not submit your request'); return; }
      setSubmitted(true);
    } catch {
      toast.error('Connection error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showAuth && <ImportAuthSheet onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center gap-2.5">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-xl flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <Link to="/recommendations" className="flex items-center gap-2">
            <img src="/qafrica-bag-logo.svg" alt="QAFRICA" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-bold text-gray-900 text-sm">Custom Order</span>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {submitted ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h2 className="font-black text-gray-900 text-lg mb-1.5">Request sent!</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              We're reviewing your custom order. Once we've found and linked everything, we'll email you —
              you can also check progress anytime from your dashboard's Custom tab.
            </p>
            <Link
              to="/importations/dashboard"
              className="inline-block px-5 py-3 bg-gray-900 hover:bg-gray-700 text-white text-sm font-bold rounded-xl transition-colors"
            >
              Go to my dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <h1 className="font-black text-gray-900 text-lg">Can't find it? We'll source it.</h1>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-3">
                Send us a photo of what you want, tell us how many you need and roughly what you'd like to pay,
                and our team will track it down from our vendor network in China.
              </p>
              <ol className="space-y-2">
                {[
                  'Add one or more items below — a photo, a short description, quantity, and your budget estimate.',
                  'We review your request and source matching products from our vetted vendors.',
                  'Once every item is found, we notify you by email and link each one in your dashboard.',
                  'You order each linked item individually, right from the Custom tab, through our normal checkout.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-orange-50 text-orange-500 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {!isAuthenticated ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <p className="text-sm text-gray-600 mb-4">Sign in to send a custom order request.</p>
                <button
                  onClick={() => setShowAuth(true)}
                  className="px-5 py-3 bg-gray-900 hover:bg-gray-700 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  Sign in to continue
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  <AnimatePresence initial={false}>
                    {items.map((item, idx) => (
                      <motion.div
                        key={item.key}
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="bg-white rounded-2xl border border-gray-100 p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Item {idx + 1}</p>
                          {items.length > 1 && (
                            <button onClick={() => removeItem(item.key)} className="text-gray-300 hover:text-red-400">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <label className="block mb-3">
                          <div className="relative w-full aspect-square max-w-[140px] mx-auto rounded-xl border-2 border-dashed border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50 cursor-pointer hover:border-orange-300 transition-colors">
                            {item.imagePreview ? (
                              <img src={item.imagePreview} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center px-2">
                                <ImagePlus className="w-5 h-5 text-gray-300 mx-auto mb-1" />
                                <p className="text-[10px] text-gray-400">Add photo</p>
                              </div>
                            )}
                            {item.isUploading && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Loader className="w-5 h-5 text-white animate-spin" />
                              </div>
                            )}
                            <input
                              type="file" accept="image/*" className="hidden"
                              onChange={e => e.target.files?.[0] && handleImageSelect(item.key, e.target.files[0])}
                            />
                          </div>
                        </label>

                        <div className="space-y-2">
                          <div className="relative">
                            <MessageSquareText className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-3" />
                            <textarea
                              value={item.description}
                              onChange={e => updateItem(item.key, { description: e.target.value })}
                              placeholder="Describe what you want (color, size, style, anything specific)…"
                              rows={2}
                              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-gray-400 resize-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <Hash className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="number" inputMode="numeric" min={1} value={item.quantity}
                                onChange={e => updateItem(item.key, { quantity: e.target.value })}
                                placeholder="Quantity"
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-gray-400"
                              />
                            </div>
                            <div className="relative">
                              <Wallet className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="number" inputMode="decimal" min={0} value={item.estimatedBudget}
                                onChange={e => updateItem(item.key, { estimatedBudget: e.target.value })}
                                placeholder="Budget per unit (₦)"
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-gray-400"
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => setItems(prev => [...prev, emptyItem()])}
                  className="w-full flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-xl text-xs font-bold text-gray-500 mb-4 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another item
                </button>

                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
                  Send request
                </button>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
