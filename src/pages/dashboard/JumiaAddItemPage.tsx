// src/pages/dashboard/JumiaAddItemPage.tsx
// Orchestrates the full "send item to Jumia" flow. Keeps logic here, UI pieces in Jumia/ subfolder.

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuthStore, useStoreStore } from '@/stores';
import { useJumiaStore, type JumiaVariant } from '@/stores/jumiaStore';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';
import JumiaVariantInputs from './Jumia/JumiaVariantInputs';
import JumiaFulfillmentChoice from './Jumia/JumiaFulfillmentChoice';
import JumiaPlanGate from './Jumia/JumiaPlanGate';
import JumiaImageUpload from './Jumia/JumiaImageUpload';
import JumiaFeeCalculator from './Jumia/JumiaFeeCalculator';

const SUBMISSION_FEE = 1500;
const AGENT_FEE = 7500;

function JumiaAddItemForm() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentStore, products, fetchUserStore } = useStoreStore();
  const { dropOffLocations, fetchDropOffLocations, createSubmission, uploadSubmissionImages } = useJumiaStore();

  const [isLoadingStore, setIsLoadingStore] = useState(!currentStore);
  const [sourceProductId, setSourceProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<JumiaVariant[]>([]);
  const [singleQuantity, setSingleQuantity] = useState(10);
  const [method, setMethod] = useState<'self_dropoff' | 'agent_pickup' | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDropOffLocations();
    if (!user?.id) return;
    if (currentStore) { setIsLoadingStore(false); return; }
    setIsLoadingStore(true);
    fetchUserStore(user.id).finally(() => setIsLoadingStore(false));
  }, [user?.id, currentStore, fetchUserStore, fetchDropOffLocations]);

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
    if (!price || Number(price) <= 0) return 'Enter a valid price';
    if (!contactPhone.trim()) return 'A phone number is required so we can reach you about drop-off';
    if (images.length < 3) return 'Upload at least 3 photos of the item';
    if (hasVariants) {
      if (variants.length === 0) return 'Add at least one variant';
      if (variants.some((v) => !v.label.trim())) return 'Every variant needs a label';
      if (variants.some((v) => v.quantity_sent < 10)) return 'Each variant needs at least 10 units';
    } else if (singleQuantity < 10) {
      return 'You need at least 10 units of this item';
    }
    if (!method) return 'Choose how you want to send this item to Jumia';
    if (method === 'self_dropoff' && !locationId) return 'Select a drop-off location';
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) { toast.error(error); return; }
    if (!user?.email) { toast.error('You must be logged in'); return; }

    setIsSubmitting(true);

    // Generate the reference up front and save it on the row immediately, so the
    // paystack-webhook (charge.success) has something to match against the moment
    // Paystack confirms payment server-side — independent of whether this tab stays open.
    const reference = generateReference('JUMIA');
    const includesAgentFee = method === 'agent_pickup';
    const totalDue = SUBMISSION_FEE + (includesAgentFee ? AGENT_FEE : 0);

    const { success, id, error: createError } = await createSubmission({
      owner_id: user.id,
      source_product_id: sourceProductId,
      name, category,
      selling_price: Number(price),
      contact_phone: contactPhone.trim(),
      has_variants: hasVariants,
      variants: hasVariants ? variants : [],
      quantity_sent: hasVariants ? 0 : singleQuantity,
      quantity_remaining: hasVariants ? 0 : singleQuantity,
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
        amount: toKobo(totalDue),
        reference,
        metadata: {
          type: 'jumia_submission',
          submission_id: id,
          owner_id: user.id,
          includes_agent_fee: includesAgentFee,
        },
        onSuccess: () => {
          // The webhook updates the database when Paystack confirms server-side.
          // This toast just reflects what the user saw in the popup — fetchSubmissions
          // on the next page load will reflect the real, verified status.
          toast.success('Payment received — your item is being scheduled.');
          navigate('/dashboard/jumia');
        },
        onCancel: () => {
          toast.error('Payment was not completed. Your item is saved as unpaid — you can pay from your Jumia items list.');
          navigate('/dashboard/jumia');
        },
      });
    } catch {
      toast.error('Could not load payment popup. Your item is saved as unpaid — try paying again from your Jumia items list.');
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
          Submission costs ₦{SUBMISSION_FEE.toLocaleString()} — this keeps out invalid
          submissions and is non-refundable.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">
          You must have at least 10 units of this exact item ready before submitting.
          If it has variants (like colors or sizes), you need at least 10 of EACH variant
          — not 10 total. Submissions without enough stock will be rejected.
        </p>
      </div>

      {isLoadingStore ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-12 text-center text-gray-400 text-sm">
          Loading your store…
        </div>
      ) : !currentStore ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">We couldn't find your store</p>
          <p className="text-gray-400 text-sm mb-4">Every account gets a store on signup — try refreshing, or contact support if this keeps happening.</p>
        </div>
      ) : (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-6">
        {products && products.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Use an item you already have (optional)</label>
            <select
              value={sourceProductId ?? ''}
              onChange={(e) => e.target.value ? selectExistingProduct(e.target.value) : setSourceProductId(null)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm"
            >
              <option value="">Enter a new item instead</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name"
            className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g. Phone Accessories)"
            className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm" />
        </div>

        <input
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="Phone number (so we can reach you about drop-off)"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm"
        />

        <JumiaImageUpload images={images} onImagesChange={setImages} uploadImages={(files) => uploadSubmissionImages(user!.id, files)} />

        <div>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Selling price (₦)"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm mb-3" />
          <JumiaFeeCalculator sellingPrice={price} onSellingPriceChange={setPrice} />
        </div>

        <JumiaVariantInputs
          hasVariants={hasVariants} onToggleVariants={setHasVariants}
          variants={variants} onChange={setVariants}
          singleQuantity={singleQuantity} onSingleQuantityChange={setSingleQuantity}
        />

        <JumiaFulfillmentChoice
          method={method} onMethodChange={setMethod}
          locations={dropOffLocations} selectedLocationId={locationId} onLocationChange={setLocationId}
          agentFee={AGENT_FEE}
        />

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 rounded-xl font-bold"
        >
          {isSubmitting ? 'Processing…' : `Pay ₦${(SUBMISSION_FEE + (method === 'agent_pickup' ? AGENT_FEE : 0)).toLocaleString()} & Submit`}
        </Button>
      </div>
      )}
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
