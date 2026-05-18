// Multi-language support for QAFRICA
// Supported languages: English, Yoruba, Hausa, Igbo

export type Language = 'en' | 'yo' | 'ha' | 'ig';

export interface Translations {
  [key: string]: string | Translations;
}

export const translations = {
  en: {
    // Navigation
    nav: {
      home: 'Home',
      dashboard: 'Dashboard',
      products: 'Products',
      orders: 'Orders',
      wallet: 'Wallet',
      analytics: 'Analytics',
      settings: 'Settings',
      logout: 'Logout',
    },
    // Auth
    auth: {
      login: 'Login',
      signup: 'Sign Up',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot Password?',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
      verifyEmail: 'Verify Email',
      resendCode: 'Resend Code',
    },
    // Products
    products: {
      title: 'Products',
      addProduct: 'Add Product',
      bulkImport: 'Bulk Import',
      name: 'Name',
      price: 'Price',
      stock: 'Stock',
      category: 'Category',
      actions: 'Actions',
      noProducts: 'No products yet',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
    },
    // Orders
    orders: {
      title: 'Orders',
      orderId: 'Order ID',
      customer: 'Customer',
      date: 'Date',
      amount: 'Amount',
      status: 'Status',
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      noOrders: 'No orders yet',
    },
    // Store
    store: {
      title: 'My Store',
      viewStore: 'View Store',
      customize: 'Customize',
      share: 'Share Store',
      copyLink: 'Copy Link',
    },
    // Common
    common: {
      search: 'Search',
      filter: 'Filter',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      confirm: 'Confirm',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      submit: 'Submit',
      optional: 'Optional',
      required: 'Required',
    },
    // Checkout
    checkout: {
      title: 'Checkout',
      shipping: 'Shipping',
      payment: 'Payment',
      summary: 'Order Summary',
      subtotal: 'Subtotal',
      deliveryFee: 'Delivery Fee',
      total: 'Total',
      placeOrder: 'Place Order',
      payNow: 'Pay Now',
      cashOnDelivery: 'Cash on Delivery',
    },
    // Coupons
    coupons: {
      title: 'Coupons',
      createCoupon: 'Create Coupon',
      code: 'Code',
      discount: 'Discount',
      percentage: 'Percentage',
      fixed: 'Fixed Amount',
      minOrder: 'Minimum Order',
      usageLimit: 'Usage Limit',
      expires: 'Expires',
    },
  },
  yo: {
    // Navigation
    nav: {
      home: 'Ile',
      dashboard: 'Dasibodu',
      products: 'Awọn Ọja',
      orders: 'Awọn Bere',
      wallet: 'Apo',
      analytics: 'Atunyẹwo',
      settings: 'Eto',
      logout: 'Jade',
    },
    // Auth
    auth: {
      login: 'Wole',
      signup: 'Forukọsilẹ',
      email: 'Imeeli',
      password: 'Ọrọigbaniwọle',
      forgotPassword: 'Gbagbe Ọrọigbaniwọle?',
      noAccount: 'Ko ni akanti?',
      hasAccount: 'Ti ni akanti tẹlẹ?',
      verifyEmail: 'Jeri Imeeli',
      resendCode: 'Tun Firanṣẹ Koodu',
    },
    // Products
    products: {
      title: 'Awọn Ọja',
      addProduct: 'Fi Ọja kun',
      bulkImport: 'Gbigbe Nla',
      name: 'Orukọ',
      price: 'Iye',
      stock: 'Ohun-ini',
      category: 'Ẹka',
      actions: 'Awọn Iṣe',
      noProducts: 'Ko si ọja sibẹsibẹ',
      edit: 'Ṣatunṣe',
      delete: 'Paarẹ',
      save: 'Fipamọ',
      cancel: 'Fagilee',
    },
    // Orders
    orders: {
      title: 'Awọn Bere',
      orderId: 'ID Bere',
      customer: 'Onibara',
      date: 'Ọjọ',
      amount: 'Iye',
      status: 'Ipo',
      pending: 'Nduro',
      confirmed: 'Jeri',
      processing: 'Nṣiṣẹ',
      shipped: 'Ti firanṣẹ',
      delivered: 'Ti fi silẹ',
      cancelled: 'Ti fagilee',
      noOrders: 'Ko si bere sibẹsibẹ',
    },
    // Store
    store: {
      title: 'Ile-itaja Mi',
      viewStore: 'Wo Ile-itaja',
      customize: 'Ṣe Aṣa',
      share: 'Pin Ile-itaja',
      copyLink: 'Da ọna asopo',
    },
    // Common
    common: {
      search: 'Wa',
      filter: 'Yan',
      loading: 'Nṣiṣẹ...',
      error: 'Aṣiṣe',
      success: 'Aṣeyọri',
      confirm: 'Jeri',
      close: 'Pa',
      back: 'Pada',
      next: 'Tẹle',
      submit: 'Firanṣẹ',
      optional: 'Aṣayan',
      required: 'Ni a beere',
    },
    // Checkout
    checkout: {
      title: 'Iṣowo',
      shipping: 'Gbigbe',
      payment: 'Isanwo',
      summary: 'Akopọ Bere',
      subtotal: 'Apapọ Kekere',
      deliveryFee: 'Owo Gbigbe',
      total: 'Lapapọ',
      placeOrder: 'Fi Bere',
      payNow: 'San Nisisiyi',
      cashOnDelivery: 'Owo lori Gbigbe',
    },
    // Coupons
    coupons: {
      title: 'Awọn Kupọnu',
      createCoupon: 'Da Kupọnu',
      code: 'Koodu',
      discount: 'Eni owo',
      percentage: 'Ogorun',
      fixed: 'Iye Ti o Duro',
      minOrder: 'Bere Kekere',
      usageLimit: 'Iye Lilo',
      expires: 'Pari',
    },
  },
  ha: {
    // Navigation
    nav: {
      home: 'Gida',
      dashboard: 'Dashboard',
      products: 'Kayayyaki',
      orders: 'Umarni',
      wallet: 'Wallet',
      analytics: 'Bincike',
      settings: 'Saituna',
      logout: 'Fita',
    },
    // Auth
    auth: {
      login: 'Shiga',
      signup: 'Yiwa',
      email: 'Imel',
      password: 'Kalmar Sirri',
      forgotPassword: 'Manta Kalmar Sirri?',
      noAccount: 'Ba ka da asusu?',
      hasAccount: 'Kana da asusu?',
      verifyEmail: 'Tabbatar Imel',
      resendCode: 'Sake Aika Lamba',
    },
    // Products
    products: {
      title: 'Kayayyaki',
      addProduct: 'Kara Kayan',
      bulkImport: 'Bukuku Shigo',
      name: 'Suna',
      price: 'Farashi',
      stock: 'Kaya',
      category: 'Rukuni',
      actions: 'Ayyuka',
      noProducts: 'Babu kayayyaki tukuna',
      edit: 'Gyara',
      delete: 'Share',
      save: 'Ajiye',
      cancel: 'Soke',
    },
    // Orders
    orders: {
      title: 'Umarni',
      orderId: 'ID Umarni',
      customer: 'Abokin Ciniki',
      date: 'Kwanan Wata',
      amount: 'Adadin',
      status: 'Matsayi',
      pending: 'Jiran',
      confirmed: 'Tabbatar',
      processing: 'Gudanarwa',
      shipped: 'An Aika',
      delivered: 'An Isar',
      cancelled: 'An Soke',
      noOrders: 'Babu umarni tukuna',
    },
    // Store
    store: {
      title: 'Kantin Na',
      viewStore: 'Duba Kantin',
      customize: 'Keɓance',
      share: 'Raba Kantin',
      copyLink: 'Kwafi Hanya',
    },
    // Common
    common: {
      search: 'Nema',
      filter: 'Tace',
      loading: 'Gudanarwa...',
      error: 'Kuskure',
      success: 'Nasara',
      confirm: 'Tabbatar',
      close: 'Rufe',
      back: 'Baya',
      next: 'Gaba',
      submit: 'Aika',
      optional: 'Zaɓi',
      required: 'Ana Bukata',
    },
    // Checkout
    checkout: {
      title: 'Biyan Kuɗi',
      shipping: 'Aikawa',
      payment: 'Biyan Kuɗi',
      summary: 'Taƙaitaccen Umarni',
      subtotal: 'Ƙarin Jimla',
      deliveryFee: 'Kudin Aikawa',
      total: 'Jimla',
      placeOrder: 'Sanya Umarni',
      payNow: 'Biya Yanzu',
      cashOnDelivery: 'Kuɗi a Lokacin Isarwa',
    },
    // Coupons
    coupons: {
      title: 'Kuponni',
      createCoupon: 'Ƙirƙiri Kupon',
      code: 'Lamba',
      discount: 'Rangwame',
      percentage: 'Kashi Dari',
      fixed: 'Adadin Tsaye',
      minOrder: 'Mafi ƙarancin Umarni',
      usageLimit: 'Iyakar Amfani',
      expires: 'Ya Karewa',
    },
  },
  ig: {
    // Navigation
    nav: {
      home: 'Ulọ',
      dashboard: 'Dashboard',
      products: 'Ihe Ndị Ahịa',
      orders: 'Iwu',
      wallet: 'Akpa',
      analytics: 'Nyocha',
      settings: 'Ntọala',
      logout: 'Pụọ',
    },
    // Auth
    auth: {
      login: 'Banye',
      signup: 'Debanye',
      email: 'Email',
      password: 'Okwuntughe',
      forgotPassword: 'Chefuo Okwuntughe?',
      noAccount: 'Enweghị akaụntụ?',
      hasAccount: 'Inweela akaụntụ?',
      verifyEmail: 'Kwenye Email',
      resendCode: 'Zipu Koodu Ọzọ',
    },
    // Products
    products: {
      title: 'Ihe Ndị Ahịa',
      addProduct: 'Tinye Ihe',
      bulkImport: 'Bukuku Nhazi',
      name: 'Aha',
      price: 'Ọnụahịa',
      stock: 'Ihe dị',
      category: 'Ẹkwa',
      actions: 'Omume',
      noProducts: 'Enweghị ihe ahịa ọ bụla',
      edit: 'Dezie',
      delete: 'Hichapụ',
      save: 'Chekwaa',
      cancel: 'Kagbuo',
    },
    // Orders
    orders: {
      title: 'Iwu',
      orderId: 'ID Iwu',
      customer: 'Onye ahịa',
      date: 'Ụbọchị',
      amount: 'Ọnụego',
      status: 'Ọnọdụ',
      pending: 'Nche',
      confirmed: 'Kwenyere',
      processing: 'Nhazi',
      shipped: 'Ezipula',
      delivered: 'E nyefere',
      cancelled: 'Kagburu',
      noOrders: 'Enweghị iwu ọ bụla',
    },
    // Store
    store: {
      title: 'Ụlọ Ahịa M',
      viewStore: 'Lelee Ụlọ Ahịa',
      customize: 'Hazie',
      share: 'Kekọrịta Ụlọ Ahịa',
      copyLink: 'Detuo Njikọ',
    },
    // Common
    common: {
      search: 'Chọọ',
      filter: 'Mgbakwunye',
      loading: 'Nhazi...',
      error: 'Mmehie',
      success: 'Ihe meere nke ọma',
      confirm: 'Kwenye',
      close: 'Mechie',
      back: 'Nazọ',
      next: 'Osote',
      submit: 'Nye',
      optional: 'Nhọrọ',
      required: 'Achọrọ',
    },
    // Checkout
    checkout: {
      title: 'Nlele',
      shipping: 'Mbupu',
      payment: 'Ịkwụ Ụgwọ',
      summary: 'Nchikọta Iwu',
      subtotal: 'Mkpokọta Obere',
      deliveryFee: 'Ụgwọ Mbupu',
      total: 'Mkpokọta',
      placeOrder: 'Tinye Iwu',
      payNow: 'Kwụọ Ụgwọ Ugbu a',
      cashOnDelivery: 'Ego na Mbupu',
    },
    // Coupons
    coupons: {
      title: 'Kupọnu',
      createCoupon: 'Mepụta Kupọnu',
      code: 'Koodu',
      discount: 'Mbelata',
      percentage: 'Pasentị',
      fixed: 'Ọnụego Ejirila',
      minOrder: 'Iwu Kacha Nta',
      usageLimit: 'Oke Iji',
      expires: 'Gbakarịrị',
    },
  },
};

// Get nested translation value
export function getTranslation(
  lang: Language,
  key: string,
  params?: Record<string, string>
): string {
  const keys = key.split('.');
  let value: any = translations[lang];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English
      value = translations['en'];
      for (const fk of keys) {
        if (value && typeof value === 'object' && fk in value) {
          value = value[fk];
        } else {
          return key; // Return key if translation not found
        }
      }
      break;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Replace parameters
  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      return params[paramKey] || match;
    });
  }

  return value;
}

// Language names
export const languageNames: Record<Language, string> = {
  en: 'English',
  yo: 'Yorùbá',
  ha: 'Hausa',
  ig: 'Igbo',
};

// Language flags/emojis
export const languageFlags: Record<Language, string> = {
  en: '🇳🇬',
  yo: '🇳🇬',
  ha: '🇳🇬',
  ig: '🇳🇬',
};

// Storage key
const LANGUAGE_STORAGE_KEY = 'qafrica_language';

// Get saved language
export function getSavedLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
  return saved && ['en', 'yo', 'ha', 'ig'].includes(saved) ? saved : 'en';
}

// Save language preference
export function saveLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}
