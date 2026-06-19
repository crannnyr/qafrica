export interface VariantOption {
  name: string;
  rawInput: string;
  values: string[];
}

export interface VariantCombination {
  id: string;
  options: Record<string, string>;
  price: number;
  stock: number;
  sku: string;
}