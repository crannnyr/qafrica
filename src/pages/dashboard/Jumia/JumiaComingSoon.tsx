// src/pages/dashboard/Jumia/JumiaComingSoon.tsx
// "Coming soon" explainer for the Sell-on-Jumia service.
// Readable on its own: what the service is, how it works, what we accept,
// and exactly what Jumia deducts per sale (2026 rates, VAT inclusive).

import { Link } from 'react-router-dom';
import { Clock, PackageCheck, MapPin, ShieldAlert, Truck, Wallet, ArrowLeft } from 'lucide-react';

const COMMISSIONS: { category: string; rate: string; note?: string }[] = [
  { category: 'Mobile phones', rate: '7%' },
  { category: 'Laptops', rate: '8%' },
  { category: 'Tablets', rate: '11%' },
  { category: 'Laptop peripherals (mice, keyboards, hubs)', rate: '11%' },
  { category: 'Audio (earbuds, speakers)', rate: '14%' },
  { category: 'Phone & electronics accessories', rate: '16%' },
  { category: 'Clothing, footwear & fashion', rate: '17%' },
];

const SHIPPING: { size: string; example: string; express: string; dropship: string }[] = [
  { size: 'Extra small', example: 'Clothing, accessories', express: '₦400', dropship: '₦650' },
  { size: 'Small', example: 'Phones, earbuds', express: '₦600', dropship: '₦1,000' },
  { size: 'Medium', example: 'Laptops, shoe boxes', express: '₦900', dropship: '₦1,700' },
  { size: 'Large', example: 'Bulky items', express: '₦4,300', dropship: '₦3,800' },
];

const STEPS = [
  { icon: PackageCheck, title: 'Submit your item', body: 'Add photos, price and quantity. We review it before it goes to Jumia.' },
  { icon: MapPin, title: 'Get it to us', body: 'Lagos sellers can drop items off themselves. Outside Lagos, we arrange pickup.' },
  { icon: Truck, title: 'We list and ship', body: 'We list the item on Jumia and handle delivery to the buyer.' },
  { icon: Wallet, title: 'You get paid', body: 'After the sale is confirmed, your earnings land in your wallet, minus the fees below.' },
];

interface Props {
  /** Show a "back" link (used on standalone/public pages). */
  backTo?: string;
}

export default function JumiaComingSoon({ backTo }: Props) {
  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {backTo && (
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      )}

      {/* Hero */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 dark:bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
          <Clock className="w-3.5 h-3.5" /> Coming soon
        </span>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Sell on Jumia with us</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
          Hand us your products and we'll sell them on Jumia for you: listing, storage and delivery included.
          We're finishing the setup now. Read how it works below so you're ready when it opens.
        </p>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">How it works</h2>
        <ol className="grid sm:grid-cols-2 gap-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300">{i + 1}</span>
                <Icon className="w-4 h-4 text-orange-500" />
                <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Rules */}
      <section className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div className="text-sm text-red-900 dark:text-red-200">
          <p className="font-semibold">Original products only</p>
          <p className="mt-1">
            Fake, replica or copied-brand items are strictly not allowed. Genuine branded goods are fine.
            Items that fail our check are returned and the account may be suspended. Jumia enforces the same rule.
          </p>
        </div>
      </section>

      {/* What we accept */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">What Jumia takes from each sale</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          At launch we accept clothing, footwear, phones and gadgets only. Every sale has two Jumia charges.
          Both already include 7.5% VAT.
        </p>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-medium text-gray-900 dark:text-white">1. Commission (a percentage of the selling price)</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {COMMISSIONS.map((c) => (
                <tr key={c.category} className="border-b last:border-0 border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{c.category}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">{c.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-medium text-gray-900 dark:text-white">2. Shipping contribution (a flat fee per order, by size)</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium text-right">Stored at Jumia</th>
                <th className="px-4 py-2 font-medium text-right">Shipped from us</th>
              </tr>
            </thead>
            <tbody>
              {SHIPPING.map((s) => (
                <tr key={s.size} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2.5">
                    <div className="text-gray-900 dark:text-white">{s.size}</div>
                    <div className="text-xs text-gray-500">{s.example}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{s.express}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{s.dropship}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
            Items stored in Jumia's warehouse are free for the first 15 days. After that Jumia charges a small daily storage fee per item.
          </p>
        </div>

        {/* Worked examples */}
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 text-sm">
            <p className="font-medium text-gray-900 dark:text-white">₦20,000 shirt</p>
            <p className="mt-1 text-gray-600 dark:text-gray-400">₦3,400 commission (17%) + ₦650 shipping = <b>₦4,050</b> to Jumia, about 20%.</p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 text-sm">
            <p className="font-medium text-gray-900 dark:text-white">₦150,000 phone</p>
            <p className="mt-1 text-gray-600 dark:text-gray-400">₦10,500 commission (7%) + ₦1,000 shipping = <b>₦11,500</b> to Jumia, under 8%.</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Our service fee is shown separately before you submit. Rates are Jumia Nigeria's 2026 fees and may change.
        </p>
      </section>
    </div>
  );
}
