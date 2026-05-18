import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, Store, Package, ShoppingCart, Wallet, TrendingUp, 
  Calculator, Shield, HelpCircle, ChevronRight, ChevronDown,
  AlertCircle, CreditCard, Truck, User
} from 'lucide-react';

interface SectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionSection({ title, icon: Icon, children, defaultOpen = false }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto'}}
          className="p-4 sm:p-6 bg-white dark:bg-gray-900"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

export default function HowToUsePage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">How to Use QAFRICA</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Everything you need to know about using the QAFRICA platform
        </p>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 mb-8 text-white">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <BookOpen className="w-6 h-6" />
          Quick Start Guide
        </h2>
        <p className="mb-4 opacity-90">
          New to QAFRICA? Follow these simple steps to get your store up and running:
        </p>
        <ol className="space-y-2">
          {[
            'Sign up for an account',
            'Verify your email with the 5-digit code',
            'Select your store niche(s)',
            'Choose a pricing plan (or start free trial)',
            'Set up your store (name, logo, theme)',
            'Add your first products',
            'Configure delivery zones',
            'Start selling!'
          ].map((step, idx) => (
            <li key={idx} className="flex items-center gap-3">
              <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm font-medium">
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Getting Started */}
      <AccordionSection title="Getting Started" icon={User} defaultOpen={true}>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Creating Your Account</h3>
          <p className="text-gray-600 dark:text-gray-400">
            To get started with QAFRICA, you'll need to create an account. Click "Get Started" on the homepage 
            and fill in your details. After signing up, you'll receive a 5-digit verification code via email. 
            Enter this code to verify your account.
          </p>
          
          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Selecting Your Niche</h3>
          <p className="text-gray-600 dark:text-gray-400">
            QAFRICA offers 12 different niches to choose from. Your plan determines how many niches you can select:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li><strong>Starter (₦5,000/month):</strong> 1 niche</li>
            <li><strong>Growth (₦10,000/month):</strong> 3 niches</li>
            <li><strong>Enterprise (₦100,000/month):</strong> Unlimited niches</li>
          </ul>
          
          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Free Trial</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Not ready to commit? Start with our 3-day free trial to explore all features before choosing a plan.
          </p>
        </div>
      </AccordionSection>

      {/* Store Setup */}
      <AccordionSection title="Setting Up Your Store" icon={Store}>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Store Information</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Go to <strong>Settings</strong> to configure your store:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li><strong>Store Name:</strong> Choose a memorable name for your store</li>
            <li><strong>Slug:</strong> This becomes your store URL (e.g., /your-store)</li>
            <li><strong>Description:</strong> Tell customers what your store is about</li>
            <li><strong>Logo:</strong> Upload your store logo (recommended: 400x400px)</li>
            <li><strong>Banner:</strong> Add a banner image for your store homepage</li>
          </ul>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Choosing a Theme</h3>
          <p className="text-gray-600 dark:text-gray-400">
            QAFRICA offers 4 professionally designed themes:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            {[
              { name: 'Modern', color: 'Orange', desc: 'Clean, minimalist design perfect for any business' },
              { name: 'Elegant', color: 'Purple', desc: 'Sophisticated look for premium brands' },
              { name: 'Bold', color: 'Pink/Yellow', desc: 'Vibrant and eye-catching for trendy stores' },
              { name: 'Classic', color: 'Green', desc: 'Timeless design for traditional businesses' },
            ].map((theme) => (
              <div key={theme.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white">{theme.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{theme.desc}</p>
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Custom Domain</h3>
          <p className="text-gray-600 dark:text-gray-400">
            You can get a custom .store domain for ₦12,900 or connect your existing domain for ₦7,000. 
            Go to <strong>Custom Domain</strong> in your dashboard to set this up.
          </p>
        </div>
      </AccordionSection>

      {/* Products */}
      <AccordionSection title="Managing Products" icon={Package}>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Adding Products</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Navigate to <strong>Products</strong> and click "Add Product". Fill in:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li><strong>Product Name:</strong> Clear, descriptive name</li>
            <li><strong>Description:</strong> Detailed product information</li>
            <li><strong>Category:</strong> Organize your products</li>
            <li><strong>Images:</strong> Upload up to 5 product images</li>
            <li><strong>Pricing:</strong> Cost price, selling price, dropship price, wholesale price</li>
            <li><strong>Stock:</strong> Quantity available and low stock threshold</li>
          </ul>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Stock Management</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Set a <strong>Low Stock Threshold</strong> to receive alerts when inventory is running low. 
            Products automatically deactivate when out of stock.
          </p>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Import Catalog</h3>
          <p className="text-gray-600 dark:text-gray-400">
            The <strong>Import Catalog</strong> feature lets you import products from other QAFRICA sellers. 
            This is perfect for dropshipping - import products, set your markup, and start selling without 
            holding inventory.
          </p>
        </div>
      </AccordionSection>

      {/* Orders */}
      <AccordionSection title="Managing Orders" icon={ShoppingCart}>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Order Lifecycle</h3>
          <div className="space-y-3">
            {[
              { status: 'Pending', desc: 'Order placed, awaiting confirmation' },
              { status: 'Confirmed', desc: 'Seller has confirmed the order' },
              { status: 'Processing', desc: 'Order is being prepared' },
              { status: 'Shipped', desc: 'Order has been dispatched' },
              { status: 'Delivered', desc: 'Order received by customer' },
              { status: 'Completed', desc: 'Transaction complete' },
            ].map((item) => (
              <div key={item.status} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.status}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Escrow Protection</h3>
          <p className="text-gray-600 dark:text-gray-400">
            All payments are held in escrow for 7 days after delivery. This protects both buyers and sellers:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li>Buyers receive their products before payment is released</li>
            <li>Sellers are guaranteed payment for delivered orders</li>
            <li>Disputes can be raised within the 7-day window</li>
          </ul>
        </div>
      </AccordionSection>

      {/* Delivery Zones */}
      <AccordionSection title="Delivery Zones" icon={Truck}>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Setting Up Delivery</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Go to <strong>Delivery Zones</strong> to configure where you deliver and how much you charge:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li>Select Nigerian states you deliver to</li>
            <li>Set delivery price for each state</li>
            <li>Enable/disable zones as needed</li>
          </ul>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Tip:</strong> If a customer tries to order from a state you don't deliver to, 
              they'll see a friendly message with an option to contact you to request delivery.
            </p>
          </div>
        </div>
      </AccordionSection>

      {/* Wallet & Payments */}
      <AccordionSection title="Wallet & Payments" icon={Wallet}>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Your Wallet</h3>
          <p className="text-gray-600 dark:text-gray-400">
            The <strong>Wallet</strong> page shows your available balance from sales. After an order 
            is completed (7 days after delivery), the funds are released to your wallet.
          </p>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Withdrawals</h3>
          <p className="text-gray-600 dark:text-gray-400">
            You can withdraw funds to your bank account:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li>Minimum withdrawal: ₦5,000</li>
            <li>Processing time: 1-3 business days</li>
            <li>Add your bank account details in Settings</li>
          </ul>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Payment Methods</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Customers can pay using:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li><strong>Paystack:</strong> Card payments, bank transfer, USSD</li>
            <li><strong>Cash on Delivery:</strong> Pay when you receive (if enabled)</li>
          </ul>
        </div>
      </AccordionSection>

      {/* Tax & Expenses */}
      <AccordionSection title="Tax & Expenses" icon={Calculator}>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Tax Settings</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Go to <strong>Tax & Expenses</strong> to configure your tax settings:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li>Set your tax rate (e.g., 7.5% for VAT)</li>
            <li>Enter your Tax ID number</li>
            <li>Specify your country and state</li>
          </ul>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Business Expenses</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Track expenses to reduce your taxable income:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li>Advertising & Marketing</li>
            <li>Office Supplies</li>
            <li>Shipping & Delivery</li>
            <li>Software & Subscriptions</li>
            <li>And 10+ more categories</li>
          </ul>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Tax Reports</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Generate tax reports for any period. Export in PDF, CSV, or Excel format. 
            Reports include revenue, expenses, taxable income, and calculated tax amount.
          </p>
        </div>
      </AccordionSection>

      {/* Analytics */}
      <AccordionSection title="Analytics & Reports" icon={TrendingUp}>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Dashboard Analytics</h3>
          <p className="text-gray-600 dark:text-gray-400">
            The <strong>Analytics</strong> page provides insights into your store performance:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li>Total Revenue and Net Profit</li>
            <li>Items Sold and Active Products</li>
            <li>Product earnings breakdown</li>
            <li>Top performing products</li>
            <li>Stock alerts</li>
          </ul>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Time Period Filtering</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Filter analytics by time period: Last 7 days, 30 days, 90 days, or All Time.
          </p>
        </div>
      </AccordionSection>

      {/* Subscription */}
      <AccordionSection title="Subscription Management" icon={CreditCard}>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Pricing Plans</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { name: 'Starter', price: '₦5,000', features: ['1 Niche', 'Basic Analytics', 'Email Support'] },
              { name: 'Growth', price: '₦10,000', features: ['3 Niches', 'Advanced Analytics', 'Priority Support'] },
              { name: 'Enterprise', price: '₦100,000', features: ['Unlimited Niches', 'Full Analytics', 'Dedicated Support'] },
            ].map((plan) => (
              <div key={plan.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="font-bold text-gray-900 dark:text-white">{plan.name}</p>
                <p className="text-orange-600 font-bold">{plan.price}/mo</p>
                <ul className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {plan.features.map((f, i) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">What Happens If Subscription Expires?</h3>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-amber-800 dark:text-amber-300">
              If your subscription expires, your store will show a "Store Closed" message to visitors. 
              Renew your subscription at any time to reactivate your store. Your products and settings 
              are preserved.
            </p>
          </div>
        </div>
      </AccordionSection>

      {/* Security */}
      <AccordionSection title="Security & Best Practices" icon={Shield}>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Account Security</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li>Use a strong, unique password</li>
            <li>Enable email verification</li>
            <li>Don't share your login credentials</li>
            <li>Log out when using shared devices</li>
          </ul>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-6">Transaction Safety</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 ml-4">
            <li>All payments are secured by Paystack</li>
            <li>Escrow protection for 7 days</li>
            <li>Dispute resolution process available</li>
            <li>Never accept payments outside the platform</li>
          </ul>
        </div>
      </AccordionSection>

      {/* FAQ */}
      <AccordionSection title="Frequently Asked Questions" icon={HelpCircle}>
        <div className="space-y-6">
          {[
            {
              q: 'How do I reset my password?',
              a: 'Click "Forgot Password" on the login page. Enter your email and we\'ll send you a reset link.'
            },
            {
              q: 'Can I change my store niche after setup?',
              a: 'Yes, you can change niches in your Settings. Note that this may affect your subscription if you exceed your plan\'s niche limit.'
            },
            {
              q: 'How long does withdrawal take?',
              a: 'Withdrawals are processed within 1-3 business days.'
            },
            {
              q: 'What happens if a customer disputes an order?',
              a: 'Our support team will mediate. Both parties can provide evidence, and a fair resolution will be reached.'
            },
            {
              q: 'Can I cancel my subscription?',
              a: 'Yes, you can cancel anytime. Your store will remain active until the end of your billing period.'
            },
            {
              q: 'How do I contact support?',
              a: 'Email us at support@qafrica.store or use the contact form on our website.'
            },
          ].map((faq, idx) => (
            <div key={idx} className="border-b dark:border-gray-700 pb-4 last:border-0">
              <p className="font-medium text-gray-900 dark:text-white flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                {faq.q}
              </p>
              <p className="text-gray-600 dark:text-gray-400 mt-2 ml-7">{faq.a}</p>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Contact */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center mt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Still have questions?
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Our support team is here to help you succeed
        </p>
        <a 
          href="mailto:support@qafrica.store"
          className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
        >
          Contact Support
          <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
