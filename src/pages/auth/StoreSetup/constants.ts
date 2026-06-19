// src/pages/auth/StoreSetup/constants.ts

import { Palette, Type, Store } from 'lucide-react';

export const RESERVED_SLUGS = new Set([
  'admin','finance','api','store','shop','dashboard','login','signup',
  'register','auth','payment','checkout','wallet','support','help',
  'billing','account','settings','staff','developer','dev','test',
  'demo','null','undefined','qafrica','system','internal','legal',
  'terms','privacy','about',
]);

export const THEMES = [
  { id: 'modern',  name: 'Modern',  description: 'Clean and minimalist', color: '#F97316' },
  { id: 'classic', name: 'Classic', description: 'Elegant and timeless', color: '#1F2937' },
  { id: 'vibrant', name: 'Vibrant', description: 'Bold and colorful',    color: '#8B5CF6' },
  { id: 'natural', name: 'Natural', description: 'Organic and earthy',   color: '#10B981' },
];

export const COLOR_PRESETS = [
  { primary: '#F97316', secondary: '#FED7AA', name: 'Orange' },
  { primary: '#3B82F6', secondary: '#BFDBFE', name: 'Blue'   },
  { primary: '#8B5CF6', secondary: '#DDD6FE', name: 'Purple' },
  { primary: '#10B981', secondary: '#A7F3D0', name: 'Green'  },
  { primary: '#EF4444', secondary: '#FECACA', name: 'Red'    },
  { primary: '#1F2937', secondary: '#E5E7EB', name: 'Dark'   },
];

export const SUB_STEPS = [
  { number: 1, title: 'Basic Info', icon: Store   },
  { number: 2, title: 'Theme',      icon: Palette },
  { number: 3, title: 'Branding',   icon: Type    },
];

export const INITIAL_FORM_DATA = {
  name:            '',
  slug:            '',
  description:     '',
  theme:           'modern',
  primary_color:   '#F97316',
  secondary_color: '#FED7AA',
};