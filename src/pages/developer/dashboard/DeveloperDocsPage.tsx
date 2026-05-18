// src/pages/developer/dashboard/DeveloperDocsPage.tsx
import { useState } from 'react';
import {
  Book, Copy, Check, ChevronDown, ChevronRight,
  ExternalLink, Terminal, Zap, Package, Download,
  ShoppingBag, ClipboardList, Webhook, Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';

const BASE_URL = `${CONFIG.SUPABASE_URL}/functions/v1`;

// ── Helpers ───────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden mt-3 mb-1">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="text-xs text-gray-500 font-mono">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="px-4 py-3 text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-green-500/20 text-green-400 border border-green-500/30',
  POST:   'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  PATCH:  'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  PUT:    'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

function EndpointRow({
  method, path, description, params, request, response, open, onToggle,
}: {
  method: string; path: string; description: string;
  params?: string; request?: string; response?: string;
  open: boolean; onToggle: () => void;
}) {
  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-800 hover:bg-gray-750 transition-colors text-left"
      >
        <span className={`text-xs font-bold px-2 py-0.5 rounded-md font-mono flex-shrink-0 ${METHOD_COLORS[method]}`}>
          {method}
        </span>
        <code className="text-sm text-gray-200 font-mono flex-1 truncate">{path}</code>
        <span className="text-xs text-gray-500 hidden sm:block flex-shrink-0 max-w-xs truncate">{description}</span>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 bg-gray-900">
          <p className="text-sm text-gray-400 pt-3 mb-2">{description}</p>
          {params && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 mt-3">Query Parameters</p>
              <CodeBlock code={params} language="params" />
            </>
          )}
          {request && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 mt-3">Request Body</p>
              <CodeBlock code={request} language="json" />
            </>
          )}
          {response && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 mt-3">Response</p>
              <CodeBlock code={response} language="json" />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────
function Section({
  id, icon: Icon, title, children,
}: {
  id: string; icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div id={id} className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 mb-3 group"
      >
        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-orange-400" />
        </div>
        <h2 className="text-base font-bold text-white flex-1 text-left group-hover:text-orange-400 transition-colors">
          {title}
        </h2>
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ── Sidebar nav ───────────────────────────────────────────────
const NAV = [
  { id: 'auth',      label: 'Authentication' },
  { id: 'products',  label: 'Products' },
  { id: 'imports',   label: 'Imports' },
  { id: 'orders',    label: 'Orders' },
  { id: 'delivery',  label: 'Delivery' },
  { id: 'webhooks',  label: 'Webhooks' },
  { id: 'errors',    label: 'Errors' },
];

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperDocsPage() {
  const [openEndpoints, setOpenEndpoints] = useState<Record<string, boolean>>({});

  function toggle(key: string) {
    setOpenEndpoints((p) => ({ ...p, [key]: !p[key] }));
  }

  const authHeader = `Authorization: Bearer qaf_dev_live_<your-api-key>\nContent-Type: application/json`;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-gray-950">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-52 bg-gray-900 border-r border-gray-800 flex-shrink-0 overflow-y-auto">
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Book className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-bold text-white">API Reference</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">v1.0</p>
        </div>
        <nav className="px-3 py-3 space-y-0.5">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="block px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto px-4 py-4 border-t border-gray-800">
          <a
            href="https://qafrica.store"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-orange-400 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> qafrica.store
          </a>
        </div>
      </aside>

      {/* ── Content ──────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">

          {/* Hero */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">QAFRICA Developer API</h1>
                <p className="text-sm text-gray-400">v1.0 · REST · JSON</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Integrate QAFRICA's product catalog, ordering system, and fulfillment
              infrastructure into your platform. All endpoints return JSON.
            </p>
          </div>

          {/* Base URL */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Base URL</p>
            <CodeBlock code={BASE_URL} language="url" />
          </div>

          {/* ── AUTH ─────────────────────────────────────── */}
          <Section id="auth" icon={Terminal} title="Authentication">
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              Every API request must include your API key in the{' '}
              <code className="text-orange-400 font-mono text-xs bg-gray-800 px-1.5 py-0.5 rounded">Authorization</code>
              {' '}header as a Bearer token. Generate keys from{' '}
              <a href="/developer/dashboard/api-keys" className="text-orange-400 hover:underline">API Keys</a>.
            </p>
            <CodeBlock code={authHeader} language="http" />
            <div className="mt-4 p-3.5 bg-gray-800 border border-gray-700 rounded-xl">
              <p className="text-xs font-semibold text-gray-400 mb-2">Key format</p>
              <code className="text-xs font-mono text-orange-300">
                qaf_dev_live_&#x3C;40-hex-chars&#x3E;   Production<br />
                qaf_dev_test_&#x3C;40-hex-chars&#x3E;   Test
              </code>
            </div>
          </Section>

          {/* ── PRODUCTS ─────────────────────────────────── */}
          <Section id="products" icon={Package} title="Products">
            <EndpointRow
              method="GET" path="/api-products"
              description="Browse all importable products in the QAFRICA catalog."
              open={!!openEndpoints['GET-products']} onToggle={() => toggle('GET-products')}
              params={`niche        string  Filter by niche (e.g. clothing, electronics)\ncategory     string  Filter by category\nsearch       string  Full-text search on product name\nmin_price    number  Minimum selling price (NGN)\nmax_price    number  Maximum selling price (NGN)\nin_stock     boolean Only return products with stock > 0\npage         integer Page number (default: 1)\nlimit        integer Results per page (default: 20, max: 100)`}
              response={`{
  "data": [
    {
      "id": "uuid",
      "name": "Classic Polo Shirt",
      "images": ["https://..."],
      "niche": "clothing",
      "category": "tops",
      "selling_price": 8500,
      "dropship_price": 6000,
      "stock_quantity": 45,
      "has_variants": false,
      "weight_kg": 0.3,
      "store": { "id": "uuid", "name": "StyleHub Lagos", "slug": "stylehub-lagos" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 342, "pages": 18 }
}`}
            />
            <EndpointRow
              method="GET" path="/api-products/:id"
              description="Get full detail for a single product, including variants and store delivery zones."
              open={!!openEndpoints['GET-product-id']} onToggle={() => toggle('GET-product-id')}
              response={`{
  "data": {
    "id": "uuid",
    "name": "Classic Polo Shirt",
    "description": "...",
    "images": ["https://..."],
    "niche": "clothing",
    "selling_price": 8500,
    "dropship_price": 6000,
    "stock_quantity": 45,
    "has_variants": true,
    "variants": [
      { "id": "v1", "options": { "Size": "M", "Color": "White" }, "price": 8500, "stock": 20 }
    ],
    "weight_kg": 0.3,
    "store": {
      "id": "uuid",
      "name": "StyleHub Lagos",
      "delivery_zones": [
        { "state": "Lagos", "price": 1500, "is_active": true }
      ]
    }
  }
}`}
            />
            <EndpointRow
              method="GET" path="/api-products/niches"
              description="List all available niches with importable product counts."
              open={!!openEndpoints['GET-niches']} onToggle={() => toggle('GET-niches')}
              response={`{
  "data": [
    { "id": "clothing",     "importable_product_count": 234 },
    { "id": "electronics",  "importable_product_count": 87  },
    { "id": "beauty",       "importable_product_count": 156 }
  ]
}`}
            />
            <EndpointRow
              method="POST" path="/api-products"
              description="Push a product from your own catalog into QAFRICA (Growth plan or higher)."
              open={!!openEndpoints['POST-products']} onToggle={() => toggle('POST-products')}
              request={`{
  "name": "Handcrafted Leather Wallet",
  "niche": "clothing",
  "category": "accessories",
  "selling_price": 12000,
  "dropship_price": 9000,
  "stock_quantity": 50,
  "images": ["https://cdn.yoursite.com/wallet.jpg"],
  "weight_kg": 0.15,
  "is_importable": true
}`}
              response={`{
  "data": {
    "id": "uuid",
    "name": "Handcrafted Leather Wallet",
    "selling_price": 12000,
    "stock_quantity": 50,
    "created_at": "2026-03-21T..."
  }
}`}
            />
          </Section>

          {/* ── IMPORTS ──────────────────────────────────── */}
          <Section id="imports" icon={Download} title="Imports">
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              Import QAFRICA products into your catalog. Imported products can then be listed
              on your platform and ordered via{' '}
              <code className="text-orange-400 font-mono text-xs bg-gray-800 px-1 py-0.5 rounded">POST /api-orders</code>.
            </p>
            <EndpointRow
              method="POST" path="/api-imports"
              description="Import a QAFRICA product into your developer catalog."
              open={!!openEndpoints['POST-imports']} onToggle={() => toggle('POST-imports')}
              request={`{
  "product_id": "uuid",
  "custom_selling_price": 9500
}`}
              response={`{
  "data": {
    "id": "import-uuid",
    "name": "Classic Polo Shirt",
    "dropship_price": 6000,
    "custom_selling_price": 9500,
    "is_active": true
  }
}`}
            />
            <EndpointRow
              method="GET" path="/api-imports"
              description="List all products in your import catalog with live stock sync."
              open={!!openEndpoints['GET-imports']} onToggle={() => toggle('GET-imports')}
              params={`page    integer\nlimit   integer (max 100)`}
            />
            <EndpointRow
              method="PATCH" path="/api-imports/:id"
              description="Update your custom selling price or active status for an import."
              open={!!openEndpoints['PATCH-imports']} onToggle={() => toggle('PATCH-imports')}
              request={`{ "custom_selling_price": 10500 }`}
            />
            <EndpointRow
              method="DELETE" path="/api-imports/:id"
              description="Remove a product from your import catalog."
              open={!!openEndpoints['DELETE-imports']} onToggle={() => toggle('DELETE-imports')}
            />
          </Section>

          {/* ── ORDERS ───────────────────────────────────── */}
          <Section id="orders" icon={ClipboardList} title="Orders">
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              Create orders after your customer pays on your platform via Paystack.
              QAFRICA verifies the payment, creates the order, and handles fulfillment.
            </p>
            <EndpointRow
              method="POST" path="/api-orders"
              description="Create an order. Called after successful Paystack payment on your platform."
              open={!!openEndpoints['POST-orders']} onToggle={() => toggle('POST-orders')}
              request={`{
  "payment_reference": "PST_1742649600_ABC123",
  "payment_method": "paystack",
  "split_code": "SPL_xxxxxxxx",
  "customer": {
    "name": "Amaka Johnson",
    "email": "amaka@gmail.com",
    "phone": "08012345678"
  },
  "delivery_address": {
    "street": "12 Allen Avenue",
    "city": "Ikeja",
    "state": "Lagos",
    "country": "Nigeria"
  },
  "items": [
    {
      "import_catalog_id": "import-uuid",
      "quantity": 2,
      "variant_options": { "Size": "M", "Color": "Blue" }
    }
  ]
}`}
              response={`{
  "data": {
    "order_id": "uuid",
    "order_number": "QAF-2026-00289",
    "status": "confirmed",
    "payment_status": "paid",
    "total": 15500,
    "developer_commission": 1240,
    "split_applied": true
  }
}`}
            />
            <EndpointRow
              method="GET" path="/api-orders"
              description="List all orders placed through your API key."
              open={!!openEndpoints['GET-orders']} onToggle={() => toggle('GET-orders')}
              params={`status     string   Filter: pending | confirmed | shipped | delivered | cancelled\ndate_from  string   ISO 8601 start date\ndate_to    string   ISO 8601 end date\npage       integer\nlimit      integer`}
            />
            <EndpointRow
              method="GET" path="/api-orders/:id"
              description="Get full order detail including items, delivery address, and tracking info."
              open={!!openEndpoints['GET-order-id']} onToggle={() => toggle('GET-order-id')}
            />
            <EndpointRow
              method="POST" path="/api-orders/:id/cancel"
              description="Cancel an order. Only allowed when status is pending or confirmed."
              open={!!openEndpoints['POST-cancel']} onToggle={() => toggle('POST-cancel')}
              request={`{ "reason": "Customer requested cancellation" }`}
            />
          </Section>

          {/* ── DELIVERY ─────────────────────────────────── */}
          <Section id="delivery" icon={Truck} title="Delivery">
            <EndpointRow
              method="GET" path="/api-delivery/zones/:store_id"
              description="Get all delivery zones for a store. Use the original store ID from a product's store field."
              open={!!openEndpoints['GET-zones']} onToggle={() => toggle('GET-zones')}
              response={`{
  "store": { "id": "uuid", "name": "StyleHub Lagos", "delivery_mode": "manual" },
  "zones": [
    { "state": "Lagos",  "price": 1500, "price_with_platform_fee": 2000 },
    { "state": "Abuja",  "price": 2500, "price_with_platform_fee": 3000 },
    { "state": "Rivers", "price": 2000, "price_with_platform_fee": 2500 }
  ]
}`}
            />
            <EndpointRow
              method="POST" path="/api-delivery/calculate"
              description="Calculate delivery fees for a cart of items to a specific state."
              open={!!openEndpoints['POST-delivery']} onToggle={() => toggle('POST-delivery')}
              request={`{
  "state": "Lagos",
  "items": [
    { "import_catalog_id": "uuid", "quantity": 2 }
  ]
}`}
              response={`{
  "state": "Lagos",
  "can_deliver_all": true,
  "summary": {
    "subtotal": 17000,
    "delivery_fee": 2000,
    "platform_fee": 500,
    "total": 19500
  }
}`}
            />
          </Section>

          {/* ── WEBHOOKS ─────────────────────────────────── */}
          <Section id="webhooks" icon={Webhook} title="Webhooks">
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              QAFRICA sends signed POST requests to your registered URL on order status changes.
              Verify the signature on every request.
            </p>

            <div className="mb-4 p-4 bg-gray-800 border border-gray-700 rounded-xl">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Signature verification</p>
              <CodeBlock code={`// Every webhook includes this header:
X-QAFRICA-Signature: sha256=<hmac-hex>

// Verify in Node.js:
const crypto = require("crypto");
const sig = req.headers["x-qafrica-signature"];
const body = JSON.stringify(req.body);
const expected = "sha256=" + crypto
  .createHmac("sha256", YOUR_WEBHOOK_SECRET)
  .update(body).digest("hex");
if (sig !== expected) return res.status(401).end();`} language="javascript" />
            </div>

            <div className="mb-4 p-4 bg-gray-800 border border-gray-700 rounded-xl">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Supported events</p>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {[
                  'order.created', 'order.confirmed', 'order.processing',
                  'order.shipped', 'order.out_for_delivery', 'order.delivered',
                  'order.cancelled', 'order.refunded',
                  'product.stock_updated', 'product.price_updated', 'product.deactivated',
                  'developer.plan_expiring',
                ].map((ev) => (
                  <code key={ev} className="text-xs font-mono text-orange-300 bg-gray-900 px-2 py-1 rounded">
                    {ev}
                  </code>
                ))}
              </div>
            </div>

            <EndpointRow
              method="POST" path="/api-webhooks"
              description="Register a webhook URL to receive event notifications."
              open={!!openEndpoints['POST-webhooks']} onToggle={() => toggle('POST-webhooks')}
              request={`{
  "url": "https://myplatform.com/qafrica-events",
  "events": ["order.created", "order.shipped", "order.delivered"]
}`}
              response={`{
  "id": "uuid",
  "url": "https://myplatform.com/qafrica-events",
  "events": ["order.created", "order.shipped", "order.delivered"],
  "signing_secret": "a1b2c3...",
  "warning": "Store this signing_secret securely. It will not be shown again."
}`}
            />
            <EndpointRow
              method="GET"    path="/api-webhooks"
              description="List all registered webhook configurations with delivery stats."
              open={!!openEndpoints['GET-webhooks']} onToggle={() => toggle('GET-webhooks')}
            />
            <EndpointRow
              method="DELETE" path="/api-webhooks/:id"
              description="Remove a webhook configuration."
              open={!!openEndpoints['DELETE-webhooks']} onToggle={() => toggle('DELETE-webhooks')}
            />
            <EndpointRow
              method="POST"   path="/api-webhooks/:id/test"
              description="Send a test payload to your registered URL to verify your receiver works."
              open={!!openEndpoints['POST-test-webhook']} onToggle={() => toggle('POST-test-webhook')}
            />
          </Section>

          {/* ── ERRORS ───────────────────────────────────── */}
          <Section id="errors" icon={Terminal} title="Error Codes">
            <div className="space-y-2">
              {[
                { code: 'invalid_api_key',          status: '401', desc: 'Key not found, revoked, or expired.' },
                { code: 'api_key_expired',           status: '401', desc: 'Key has passed its expiry date.' },
                { code: 'insufficient_plan',         status: '403', desc: 'Action requires a higher plan.' },
                { code: 'subscription_expired',      status: '402', desc: 'Developer plan has expired.' },
                { code: 'paystack_not_connected',    status: '422', desc: 'Paystack Connect not completed.' },
                { code: 'payment_verification_failed', status: '402', desc: 'Paystack returned non-success.' },
                { code: 'payment_amount_mismatch',   status: '402', desc: 'Paid amount does not match total.' },
                { code: 'product_not_found',         status: '404', desc: 'Product not active or importable.' },
                { code: 'import_already_exists',     status: '409', desc: 'Already imported this product.' },
                { code: 'stock_insufficient',        status: '422', desc: 'Requested quantity exceeds stock.' },
                { code: 'delivery_zone_not_found',   status: '422', desc: 'No delivery to specified state.' },
                { code: 'order_not_cancellable',     status: '422', desc: 'Status prevents cancellation.' },
                { code: 'rate_limit_exceeded',       status: '429', desc: 'Too many requests. See X-RateLimit headers.' },
              ].map((err) => (
                <div key={err.code} className="flex items-start gap-3 p-3 bg-gray-800 border border-gray-700 rounded-xl">
                  <code className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-1 rounded flex-shrink-0">
                    {err.status}
                  </code>
                  <code className="text-xs font-mono text-orange-300 flex-shrink-0 mt-1">{err.code}</code>
                  <p className="text-xs text-gray-400 mt-1">{err.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-600">
              QAFRICA Developer API v1.0 · Need help?{' '}
              <a href="mailto:support@qafrica.store" className="text-orange-500 hover:underline">
                support@qafrica.store
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}