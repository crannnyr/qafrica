export const SHIPBUBBLE_CATEGORIES = [
  { id: 8, label: 'General goods' },
  { id: 1, label: 'Electronics' },
  { id: 2, label: 'Clothing' },
  { id: 3, label: 'Cosmetics' },
  { id: 4, label: 'Food & beverages' },
  { id: 5, label: 'Documents' },
  { id: 6, label: 'Footwear' },
  { id: 7, label: 'Accessories' },
];

export const PICKUP_ADDRESS_FIELDS = [
  { key: 'first_name', label: 'First Name', placeholder: 'John' },
  { key: 'last_name',  label: 'Last Name',  placeholder: 'Doe' },
  { key: 'email',      label: 'Email',      placeholder: 'john@store.com', type: 'email' },
  { key: 'phone',      label: 'Phone',      placeholder: '08012345678' },
] as const;

export const PACKAGING_FIELDS = [
  { key: 'length_cm', label: 'Length (cm)', step: '1'   },
  { key: 'width_cm',  label: 'Width (cm)',  step: '1'   },
  { key: 'height_cm', label: 'Height (cm)', step: '1'   },
  { key: 'weight_kg', label: 'Weight (kg)', step: '0.1' },
] as const;