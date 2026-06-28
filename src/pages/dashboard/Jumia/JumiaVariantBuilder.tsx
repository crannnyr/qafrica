// src/pages/dashboard/Jumia/JumiaVariantBuilder.tsx
// Thin adapter between JumiaAddItemPage (which uses VariantType) and
// JumiaVariantInputs (which uses a boolean hasVariants toggle).
// Keeps JumiaVariantInputs simple while letting the parent store the
// richer VariantType for submission to the server.

import type { JumiaVariant, VariantType } from '@/stores/jumiaStore';
import JumiaVariantInputs from './JumiaVariantInputs';

interface Props {
  variantType: VariantType;
  onVariantTypeChange: (type: VariantType) => void;
  variants: JumiaVariant[];
  onVariantsChange: (variants: JumiaVariant[]) => void;
  singleQuantity: number;
  onSingleQuantityChange: (qty: number) => void;
}

export default function JumiaVariantBuilder({
  variantType,
  onVariantTypeChange,
  variants,
  onVariantsChange,
  singleQuantity,
  onSingleQuantityChange,
}: Props) {
  const hasVariants = variantType !== 'none';

  const handleToggle = (value: boolean) => {
    // Default to 'colour' when enabling variants; back to 'none' when disabling.
    onVariantTypeChange(value ? 'colour' : 'none');
    if (!value) onVariantsChange([]);
  };

  return (
    <JumiaVariantInputs
      hasVariants={hasVariants}
      onToggleVariants={handleToggle}
      variants={variants}
      onChange={onVariantsChange}
      singleQuantity={singleQuantity}
      onSingleQuantityChange={onSingleQuantityChange}
    />
  );
}
