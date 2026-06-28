// src/pages/dashboard/JumiaAddItemPage.tsx
// Wires together Badges 3 (terms), 4 (label), 5 (live fees).

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuthStore, useStoreStore } from '@/stores';
import { useJumiaStore, type JumiaVariant, type VariantType } from '@/stores/jumiaStore';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';
import { supabase } from '@/services';
import JumiaVariantBuilder from './Jumia/JumiaVariantBuilder';
import JumiaFulfillmentChoice from './Jumia/JumiaFulfillmentChoice';
import JumiaPlanGate from './Jumia/JumiaPlanGate';
import JumiaImageUpload from './Jumia/JumiaImageUpload';
import JumiaFeeCalculator from './Jumia/JumiaFeeCalculator';
import JumiaFeeBreakdown from './Jumia/JumiaFeeBreakdown';
import JumiaTermsModal from './Jumia/JumiaTermsModal';
import JumiaCategorySelect from './Jumia/JumiaCategorySelect';
import { useJumiaFees } from './Jumia/useJumiaFees';
import { generateJumiaLabel } from './Jumia/generateJumiaLabel';

const SUBMISSION_FEE = 1500;

function JumiaAddItemForm() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentStore, products, fetchUserStore } = useStoreStore();
  const { dropOffLocations, fetchDropOffLocations, createSubmission, uploadSubmissionImages } = useJumiaStore();
  const { logistics, core, agentFeeForQty, isLoading: feesLoading } = useJumiaFees();

  const [isLoadingStore, setIsLoadingStore] = useState(!currentStore);
  const [sourceProductId, setSourceProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [variantType, setVariantType] = useState<VariantType>('none');
  const [variants, setVariants] = useState<JumiaVariant[]>([]);
  const [singleQuantity, setSingleQuantity] = useState(core.min_quantity);
  const [method, setMethod] = useState<'self_dropoff' | 'agent_pickup' | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  // Badge 3: terms
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDropOffLocations();
    if (!user?.id) return;
    if (currentStore) { setIsLoadingStore(false); return; }
    setIsLoadingStore(true);
    fetchUserStore(user.id).finally(() => setIsLoadingStore(false));
  }, [user?.id, currentStore, fetchUserStore, fetchDropOffLocations]);

  const totalQuantity = variantType === 'none'
    ? singleQuantity
    : variants.reduce((s, v) => s + v.quantity_sent, 0);

  const agentFee = agentFeeForQty(totalQuantity);
  const totalFee = SUBMISSION_FEE + (method === 'agent_pickup' ? agentFee : 0);

  const selectExistingProduct = (id: string) => {
    const p = products?.find((pr) => pr.id === id);
    if (!p) return;
    setSourceProductId(id);
    setName(p.name);
    setCategory(p.category || '');
    setPrice(String(p.selling_price ?? ''));
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Item name is required';
    if (!category.trim()) return 'Category is required';
    if (!price || Number(price) <= 0) return 'Enter a valid selling price';
    if (!contactPhone.trim()) return 'A contact phone number is required';
    if (images.length < 3) return 'Upload at least 3 photos of the item';
    if (variantType === 'none') {
      if (singleQuantity < core.min_quantity) return `Minimum ${core.min_quantity} units required`;
      if (singleQuantity > core.max_quantity) return `Maximum ${core.max_quantity} units allowed`;
    } else {
      if (variants.length === 0) return 'Add at least one variant';
      if (variants.some((v) => v.quantity_sent < core.min_quantity))
        return `Each variant needs at least ${core.min_quantity} units`;
      if (variants.some((v) => v.quantity_sent > core.max_quantity))
        return `Each variant cannot exceed ${core.max_quantity} units`;
    }
    if (!method) return 'Choose a fulfilment method';
    if (method === 'self_dropoff' && !locationId) return 'Select your nearest drop-off location';
    if (!termsAccepted) return 'Please read and accept the seller agreement';
    return null;
  };

  const handleSubmitClick = () => {
    // Pre-validate everything except terms, then show terms modal if not yet accepted
    const preCheck = (() => {
      if (!name.trim()) return 'Item name is required';
      if (!category.trim()) return 'Category is required';
      if (!price || Number(price) <= 0) return 'Enter a valid selling price';
      if (!contactPhone.trim()) return 'A contact phone number is required';
      if (images.length < 3) return 'Upload at least 3 photos of the item';
      if (variantType === 'none' && singleQuantity < core.min_quantity)
        return `Minimum ${core.min_quantity} units required`;
      if (!method) return 'Choose a fulfilment method';
      if (method === 'self_dropoff' && !locationId) return 'Select your nearest drop-off location';
      return null;
    })();

    if (preCheck) { toast.error(preCheck); return; }
    if (!termsAccepted) { setShowTerms(true); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) { toast.error(error); return; }
    if (!user?.email) { toast.error('You must be logged in'); return; }

    setIsSubmitting(true);
    const reference = generateReference('JUMIA');
    const includesAgentFee = method === 'agent_pickup';

    const { success, id, error: createError } = await createSubmission({
      owner_id: user.id,
      source_product_id: sourceProductId,
      name, category,
      selling_price: Number(price),
      contact_phone: contactPhone.trim(),
      variant_type: variantType,
      variants: variantType !== 'none' ? variants : [],
      quantity_sent: variantType === 'none' ? singleQuantity : totalQuantity,
      quantity_remaining: variantType === 'none' ? singleQuantity : totalQuantity,
      fulfillment_method: method!,
      drop_off_location_id: method === 'self_dropoff' ? locationId : null,
      images,
      status: 'pending_payment',
      payment_reference: reference,
      payment_status: 'unpaid',
    });

    if (!success || !id) {
      toast.error(createError || 'Could not create submission');
      setIsSubmitting(false);
      return;
    }

    try {
      await loadPaystackScript();
      initializePayment({
        email: user.email,
        amount: toKobo(totalFee),
        reference,
        metadata: { type: 'jumia_submission', submission_id: id, owner_id: user.id, includes_agent_fee: includesAgentFee },
        onSuccess: async () => {
          toast.success('Payment confirmed!');
          // Badge 4: generate and download label immediately
          try {
            const { data: sub } = await supabase
              .from('jumia_submissions')
              .select('*')
              .eq('id', id)
              .single();
            if (sub) {
              await generateJumiaLabel(sub, currentStore?.name ?? 'My Store', user.full_name ?? user.email);
              await supabase.from('jumia_submissions').update({ label_downloaded_at: new Date().toISOString() }).eq('id', id);
              toast.success('Your shipping label has been downloaded — print and paste it on your package.');
            }
          } catch {
            toast.error('Label download failed — you can re-download it from your Jumia items list.');
          }
          navigate('/dashboard/jumia');
        },
        onCancel: () => {
          toast.error('Payment not completed. Your submission is saved — pay from your Jumia items list.');
          navigate('/dashboard/jumia');
        },
      });
    } catch {
      toast.error('Could not load payment. Your submission is saved — try again from your Jumia items list.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Link to="/dashboard/jumia" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Jumia
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Send an Item to Jumia</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Submission fee ₦{SUBMISSION_FEE.toLocaleString()} — non-refundable.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 dark:text-red-400 font-medium leading-relaxed">
          You must have at least {core.min_quantity} physical units ready before submitting.
          For variants, you need {core.min_quantity} of <strong>each</strong> variant — not {core.min_quantity} total.
          Maximum {core.max_quantity.toLocaleString()} units per submission.
        </p>
      </div>

      {isLoadingStore ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center text-gray-400 text-sm">Loading your store…</div>
      ) : !currentStore ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 font-medium mb-1">We couldn't find your store</p>
          <p className="text-gray-400 text-sm">Try refreshing, or contact support.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-6">

          {products && products.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Use an existing store product (optional)</label>
              <select value={sourceProductId ?? ''} onChange={(e) => e.target.value ? selectExistingProduct(e.target.value) : setSourceProductId(null)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm">
                <option value="">Enter a new item instead</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm" />

          <JumiaCategorySelect value={category} onChange={setCategory} />

          <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Phone number — for drop-off scheduling"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm" />

          <JumiaImageUpload images={images} onImagesChange={setImages}
            uploadImages={(files) => uploadSubmissionImages(user!.id, files)} />

          <div className="space-y-3">
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
              placeholder="Selling price on Jumia (₦)"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm" />
            <JumiaFeeCalculator sellingPrice={price} onSellingPriceChange={setPrice} />
          </div>

          <JumiaVariantBuilder
            variantType={variantType} onVariantTypeChange={setVariantType}
            variants={variants} onVariantsChange={setVariants}
            singleQuantity={singleQuantity} onSingleQuantityChange={setSingleQuantity}
          />

          <JumiaFulfillmentChoice
            method={method} onMethodChange={setMethod}
            locations={dropOffLocations} selectedLocationId={locationId} onLocationChange={setLocationId}
            agentFee={agentFee}
          />

          {/* Badge 5: live fee breakdown for agent pickup */}
          {method === 'agent_pickup' && (
            <JumiaFeeBreakdown logistics={logistics} quantity={totalQuantity} isLoading={feesLoading} />
          )}

          {/* Terms acceptance state indicator */}
          {termsAccepted && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                  <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              Seller agreement accepted
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Submission fee</span>
              <span className="font-bold text-gray-900 dark:text-white">₦{SUBMISSION_FEE.toLocaleString()}</span>
            </div>
            {method === 'agent_pickup' && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Logistics & packaging</span>
                <span className="font-bold text-gray-900 dark:text-white">₦{agentFee.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-gray-100 dark:border-gray-700 pt-2">
              <span className="text-gray-900 dark:text-white">Total due now</span>
              <span className="text-orange-600 text-base">₦{totalFee.toLocaleString()}</span>
            </div>
          </div>

          <Button onClick={handleSubmitClick} disabled={isSubmitting}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 rounded-xl font-bold text-base">
            {isSubmitting ? 'Processing…' : termsAccepted ? `Pay ₦${totalFee.toLocaleString()} & Submit` : 'Review Agreement & Pay'}
          </Button>
        </div>
      )}

      {/* Badge 3: Terms modal */}
      <JumiaTermsModal
        isOpen={showTerms}
        onAccept={() => { setTermsAccepted(true); setShowTerms(false); handleSubmit(); }}
        onClose={() => setShowTerms(false)}
      />
    </div>
  );
}

export default function JumiaAddItemPage() {
  return (
    <JumiaPlanGate>
      <JumiaAddItemForm />
    </JumiaPlanGate>
  );
}
