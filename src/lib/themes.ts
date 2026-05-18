import type { Theme } from '@/types';

export const AVAILABLE_THEMES: Theme[] = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, minimalist design with focus on products',
    preview_image: '/themes/modern-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#F97316',
      secondary: '#FED7AA',
      accent: '#1F2937',
      background: '#FFFFFF',
      text: '#111827',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Sophisticated design for premium brands',
    preview_image: '/themes/elegant-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#7C3AED',
      secondary: '#DDD6FE',
      accent: '#1F2937',
      background: '#FAFAFA',
      text: '#1F2937',
    },
    fonts: {
      heading: 'Playfair Display',
      body: 'Inter',
    },
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Vibrant and eye-catching for trendy stores',
    preview_image: '/themes/bold-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#EC4899',
      secondary: '#FDE68A',
      accent: '#111827',
      background: '#FFFFFF',
      text: '#111827',
    },
    fonts: {
      heading: 'Poppins',
      body: 'Inter',
    },
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Timeless design for traditional businesses',
    preview_image: '/themes/classic-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#059669',
      secondary: '#D1FAE5',
      accent: '#374151',
      background: '#F9FAFB',
      text: '#111827',
    },
    fonts: {
      heading: 'Merriweather',
      body: 'Inter',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Ultra-clean design with maximum whitespace',
    preview_image: '/themes/minimal-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#1F2937',
      secondary: '#F3F4F6',
      accent: '#6B7280',
      background: '#FFFFFF',
      text: '#111827',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
  {
    id: 'tech',
    name: 'Tech',
    description: 'Futuristic design for technology stores',
    preview_image: '/themes/tech-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#0EA5E9',
      secondary: '#E0F2FE',
      accent: '#0F172A',
      background: '#FFFFFF',
      text: '#0F172A',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
  {
    id: 'warm',
    name: 'Warm',
    description: 'Cozy, inviting design with earthy tones',
    preview_image: '/themes/warm-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#D97706',
      secondary: '#FEF3C7',
      accent: '#78350F',
      background: '#FFFBEB',
      text: '#451A03',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
  {
    id: 'luxury',
    name: 'Luxury',
    description: 'Premium gold-accented design for high-end brands',
    preview_image: '/themes/luxury-preview.jpg',
    is_premium: true,
    colors: {
      primary: '#B45309',
      secondary: '#FEF3C7',
      accent: '#1C1917',
      background: '#FAFAF9',
      text: '#1C1917',
    },
    fonts: {
      heading: 'Playfair Display',
      body: 'Inter',
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Corporate design for B2B and office stores',
    preview_image: '/themes/professional-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#1E40AF',
      secondary: '#DBEAFE',
      accent: '#1E3A8A',
      background: '#FFFFFF',
      text: '#1E3A8A',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Artistic design with vibrant colors',
    preview_image: '/themes/creative-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#8B5CF6',
      secondary: '#F5D0FE',
      accent: '#C026D3',
      background: '#FAF5FF',
      text: '#581C87',
    },
    fonts: {
      heading: 'Poppins',
      body: 'Inter',
    },
  },
  {
    id: 'soft',
    name: 'Soft',
    description: 'Gentle pastel design for baby and wellness stores',
    preview_image: '/themes/soft-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#14B8A6',
      secondary: '#CCFBF1',
      accent: '#0F766E',
      background: '#F0FDFA',
      text: '#134E4A',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
  {
    id: 'clean',
    name: 'Clean',
    description: 'Pure and sanitary design for health stores',
    preview_image: '/themes/clean-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#06B6D4',
      secondary: '#CFFAFE',
      accent: '#0891B2',
      background: '#ECFEFF',
      text: '#164E63',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
  {
    id: 'fresh',
    name: 'Fresh',
    description: 'Natural green design for organic and food stores',
    preview_image: '/themes/fresh-preview.jpg',
    is_premium: false,
    colors: {
      primary: '#22C55E',
      secondary: '#DCFCE7',
      accent: '#15803D',
      background: '#F0FDF4',
      text: '#14532D',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
];

export const getThemeById = (id: string): Theme | undefined => {
  return AVAILABLE_THEMES.find(theme => theme.id === id);
};

export const getDefaultTheme = (): Theme => AVAILABLE_THEMES[0];
