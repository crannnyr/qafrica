// QAFRICA Platform Configuration
export const CONFIG = {
  // Platform Info
  PLATFORM_NAME: 'QAFRICA',
  PLATFORM_URL: 'qafrica.store',
  APP_URL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  PLATFORM_EMAIL: 'support@qafrica.store',
  
  // Supabase - FIXED: Removed trailing space
  SUPABASE_URL: 'https://bahiqhpypapvktpxrths.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaGlxaHB5cGFwdmt0cHhydGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzQ2NzEsImV4cCI6MjA4NzY1MDY3MX0.8UkRnUX39-XR3twjWlaiQlT4OMjyl4ROZlgmGEyjUC4',
  
  // Storage Buckets - MATCHED TO YOUR ACTUAL BUCKET NAMES
  STORAGE_BUCKETS: {
    PRODUCTS: 'products',           // Public - Product images
    STORE_LOGOS: 'store-logos',     // Public - Store logos
    STORE_BANNERS: 'store-banners', // Public - Store banners
    AVATARS: 'avatars',             // Public - User avatars
    REVIEW_IMAGES: 'review-images', // Public - Review photos
    RECEIPTS: 'receipts',           // Private - Expense receipts
    TAX_REPORTS: 'tax-reports',     // Private - Tax report files
  },
  
  // Paystack
  PAYSTACK_PUBLIC_KEY: 'pk_live_1129941b7ea653fcbd4e1042663fcb0e57957860',
  
  // Resend Email
  RESEND_API_KEY: 're_2xf4TkfF_3k9sS22aaFRh98RM4j9zgvoL',
  
  // Admin Account
  ADMIN_ACCOUNT_NUMBER: '9069149803',
  ADMIN_BANK_NAME: 'Paystack',
  
  // Pricing (in Naira)
  PRICING: {
    SINGLE_NICHE: 5000,
    THREE_NICHES: 10000,
    UNLIMITED: 100000,
  },
  
  // Platform Fees
  PLATFORM_MARKUP: 500, // Naira added to delivery
  DROPSHIPPER_FEE_PERCENT: 8, // 8% fee for imported products
  
  // Escrow
  ESCROW_DAYS: 7,
  
  // Subscription Durations
  SUBSCRIPTION_PERIODS: [
    { value: 1, label: '1 Month', multiplier: 1 },
    { value: 3, label: '3 Months', multiplier: 2.7 },
    { value: 6, label: '6 Months', multiplier: 5 },
    { value: 12, label: '1 Year', multiplier: 9 },
  ],
  
  // Niches
  NICHES: [
    { id: 'clothing', name: 'Clothing & Fashion', icon: 'Shirt', description: 'Apparel, accessories, and fashion items' },
    { id: 'jewelry', name: 'Jewelry & Watches', icon: 'Gem', description: 'Fine jewelry, watches, and accessories' },
    { id: 'electronics', name: 'Electronics', icon: 'Smartphone', description: 'Gadgets, devices, and tech accessories' },
    { id: 'beauty', name: 'Beauty & Cosmetics', icon: 'Sparkles', description: 'Skincare, makeup, and beauty products' },
    { id: 'home', name: 'Home & Garden', icon: 'Home', description: 'Furniture, decor, and household items' },
    { id: 'sports', name: 'Sports & Fitness', icon: 'Dumbbell', description: 'Sporting goods and fitness equipment' },
    { id: 'food', name: 'Food & Beverages', icon: 'Utensils', description: 'Groceries, snacks, and drinks' },
    { id: 'health', name: 'Health & Wellness', icon: 'Heart', description: 'Supplements, vitamins, and wellness products' },
    { id: 'toys', name: 'Toys & Games', icon: 'Gamepad', description: 'Toys, games, and entertainment' },
    { id: 'books', name: 'Books & Stationery', icon: 'BookOpen', description: 'Books, office supplies, and stationery' },
    { id: 'automotive', name: 'Automotive', icon: 'Car', description: 'Car parts and accessories' },
    { id: 'pets', name: 'Pet Supplies', icon: 'PawPrint', description: 'Pet food, toys, and accessories' },
  ],
  
  // Nigerian States
  NIGERIAN_STATES: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
    'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
    'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
  ],
  
  // Colors
  COLORS: {
    primary: '#F97316', // Dark Orange
    primaryDark: '#EA580C',
    primaryLight: '#FED7AA',
    white: '#FFFFFF',
    black: '#0F0F0F',
    gray: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#E5E5E5',
      300: '#D4D4D4',
      400: '#A3A3A4',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
    }
  }
};

export default CONFIG;