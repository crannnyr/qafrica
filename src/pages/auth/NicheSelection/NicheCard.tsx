// src/pages/auth/NicheSelection/NicheCard.tsx

import { Check, Lock, ShoppingBag, Shirt, Gem, Smartphone,
  Sparkles, Home, Dumbbell, Utensils, Heart, Car, BookOpen,
  PawPrint, Palette, Briefcase, Wheat, Baby } from 'lucide-react';
import { motion } from 'framer-motion';

const ICON_MAP: Record<string, React.ElementType> = {
  Shirt, Gem, Smartphone, Sparkles, Home, Dumbbell,
  Utensils, Heart, Car, BookOpen, PawPrint, Palette,
  Briefcase, Wheat, Baby, ShoppingBag,
};

interface Props {
  niche: { id: string; name: string; icon: string; description: string };
  isSelected: boolean;
  isLocked: boolean;
  onToggle: (id: string) => void;
  index: number;
}

export default function NicheCard({ niche, isSelected, isLocked, onToggle, index }: Props) {
  const Icon = ICON_MAP[niche.icon] ?? ShoppingBag;

  return (
    <motion.button
      key={niche.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => onToggle(niche.id)}
      className={`relative p-6 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden ${
        isSelected
          ? 'border-orange-500 bg-orange-50 shadow-lg'
          : isLocked
            ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
            : 'border-gray-200 hover:border-orange-300 hover:shadow-md bg-white'
      }`}
    >
      {/* Selected badge */}
      {isSelected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Locked badge */}
      {isLocked && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
          <Lock className="w-3 h-3 text-gray-500" />
        </div>
      )}

      {/* Icon box */}
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
        isSelected ? 'bg-orange-500' : isLocked ? 'bg-gray-200' : 'bg-orange-100'
      }`}>
        <Icon className={`w-6 h-6 ${
          isSelected ? 'text-white' : isLocked ? 'text-gray-400' : 'text-orange-600'
        }`} />
      </div>

      {/* Text */}
      <h3 className={`font-semibold mb-1 ${
        isSelected ? 'text-orange-800' : isLocked ? 'text-gray-400' : 'text-gray-900'
      }`}>{niche.name}</h3>

      <p className={`text-sm ${
        isSelected ? 'text-orange-700' : isLocked ? 'text-gray-400' : 'text-gray-500'
      }`}>{niche.description}</p>
    </motion.button>
  );
}