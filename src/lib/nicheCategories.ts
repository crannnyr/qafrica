// Niche Categories System for QuickSell Africa
// Each niche has specific categories that products can be posted under

export interface NicheCategory {
  id: string;
  name: string;
  subcategories: string[];
}

export interface Niche {
  id: string;
  name: string;
  icon: string;
  description: string;
  categories: NicheCategory[];
}

export const NICHE_CATEGORIES: Record<string, Niche> = {
  fashion: {
    id: 'fashion',
    name: 'Fashion & Apparel',
    icon: 'Shirt',
    description: 'Clothing, shoes, accessories, and fashion items',
    categories: [
      {
        id: 'mens-clothing',
        name: "Men's Clothing",
        subcategories: ['Shirts', 'Trousers', 'Suits', 'Traditional Wear', 'Underwear', 'Activewear', 'Jackets', 'Shorts']
      },
      {
        id: 'womens-clothing',
        name: "Women's Clothing",
        subcategories: ['Dresses', 'Tops', 'Skirts', 'Trousers', 'Traditional Wear', 'Lingerie', 'Activewear', 'Jackets']
      },
      {
        id: 'kids-clothing',
        name: "Kids' Clothing",
        subcategories: ['Boys Clothing', 'Girls Clothing', 'Baby Clothing', 'School Uniforms']
      },
      {
        id: 'footwear',
        name: 'Footwear',
        subcategories: ['Men Shoes', 'Women Shoes', 'Kids Shoes', 'Sandals', 'Slippers', 'Sneakers', 'Boots']
      },
      {
        id: 'accessories',
        name: 'Accessories',
        subcategories: ['Bags', 'Wallets', 'Belts', 'Hats & Caps', 'Scarves', 'Ties', 'Sunglasses', 'Watches', 'Jewelry']
      },
      {
        id: 'fabrics',
        name: 'Fabrics & Textiles',
        subcategories: ['Ankara', 'Lace', 'George', 'Aso Oke', 'Cashmere', 'Silk', 'Cotton', 'Chiffon']
      }
    ]
  },

  electronics: {
    id: 'electronics',
    name: 'Electronics & Gadgets',
    icon: 'Smartphone',
    description: 'Phones, computers, appliances, and electronic devices',
    categories: [
           {
        id: 'phones',
        name: 'Mobile Phones',
        subcategories: ['Smartphones', 'Feature Phones', 'Phone Accessories', 'Cases & Covers', 'Screen Protectors', 'Chargers', 'Power Banks']
      },
      {
        id: 'wearables',
        name: 'Wearables & Smart Devices',
        subcategories: ['Smart Glasses', 'Smart Watches', 'Fitness Trackers', 'VR Headsets', 'Smart Rings', 'AR Devices']
      },
      {
        id: 'computers',
        name: 'Computers & Laptops',
        subcategories: ['Laptops', 'Desktop Computers', 'Tablets', 'Computer Accessories', 'Keyboards', 'Mice', 'Monitors', 'Printers']
      },
      {
        id: 'audio',
        name: 'Audio & Sound',
        subcategories: ['Headphones', 'Earphones', 'Speakers', 'Microphones', 'Home Theater', 'Soundbars', 'Radio']
      },
      {
        id: 'gaming',
        name: 'Gaming',
        subcategories: ['Game Consoles', 'Video Games', 'Gaming Accessories', 'Controllers', 'Gaming Headsets']
      },
      {
        id: 'cameras',
        name: 'Cameras & Photography',
        subcategories: ['Digital Cameras', 'DSLR', 'Action Cameras', 'Camera Lenses', 'Camera Accessories', 'Tripods']
      },
      {
        id: 'appliances',
        name: 'Home Appliances',
        subcategories: ['Televisions', 'Refrigerators', 'Air Conditioners', 'Fans', 'Washing Machines', 'Microwaves', 'Blenders', 'Irons']
      }
    ]
  },

  beauty: {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    icon: 'Sparkles',
    description: 'Skincare, makeup, haircare, and personal care products',
    categories: [
      {
        id: 'skincare',
        name: 'Skincare',
        subcategories: ['Face Creams', 'Serums', 'Cleansers', 'Toners', 'Moisturizers', 'Sunscreen', 'Face Masks', 'Eye Care']
      },
      {
        id: 'makeup',
        name: 'Makeup',
        subcategories: ['Foundation', 'Powder', 'Lipstick', 'Eyeshadow', 'Mascara', 'Eyeliner', 'Blush', 'Makeup Remover', 'Makeup Tools']
      },
      {
        id: 'haircare',
        name: 'Hair Care',
        subcategories: ['Shampoo', 'Conditioner', 'Hair Cream', 'Hair Oil', 'Hair Treatments', 'Hair Color', 'Wigs & Extensions', 'Hair Accessories']
      },
      {
        id: 'fragrances',
        name: 'Fragrances',
        subcategories: ['Perfumes', 'Body Sprays', 'Colognes', 'Attar', 'Fragrance Sets']
      },
      {
        id: 'personal-care',
        name: 'Personal Care',
        subcategories: ['Body Lotion', 'Deodorant', 'Oral Care', 'Shaving Products', 'Sanitary Products', 'Baby Care']
      },
      {
        id: 'beauty-tools',
        name: 'Beauty Tools',
        subcategories: ['Hair Dryers', 'Straighteners', 'Curlers', 'Trimmers', 'Manicure Tools', 'Makeup Brushes']
      }
    ]
  },

  home: {
    id: 'home',
    name: 'Home & Living',
    icon: 'Home',
    description: 'Furniture, decor, kitchen items, and home essentials',
    categories: [
      {
        id: 'furniture',
        name: 'Furniture',
        subcategories: ['Sofas', 'Chairs', 'Tables', 'Beds', 'Wardrobes', 'Bookshelves', 'TV Stands', 'Office Furniture']
      },
      {
        id: 'bedding',
        name: 'Bedding & Bath',
        subcategories: ['Bed Sheets', 'Duvets', 'Pillows', 'Blankets', 'Towels', 'Bath Mats', 'Curtains']
      },
      {
        id: 'kitchen',
        name: 'Kitchen & Dining',
        subcategories: ['Cookware', 'Utensils', 'Plates & Bowls', 'Glasses & Cups', 'Storage Containers', 'Kitchen Appliances']
      },
      {
        id: 'decor',
        name: 'Home Decor',
        subcategories: ['Wall Art', 'Mirrors', 'Vases', 'Candles', 'Rugs', 'Cushions', 'Clocks', 'Photo Frames']
      },
      {
        id: 'lighting',
        name: 'Lighting',
        subcategories: ['Ceiling Lights', 'Table Lamps', 'Floor Lamps', 'Wall Lights', 'Outdoor Lights', 'LED Lights']
      },
      {
        id: 'storage',
        name: 'Storage & Organization',
        subcategories: ['Storage Boxes', 'Baskets', 'Shelves', 'Hangers', 'Shoe Racks', 'Laundry Baskets']
      }
    ]
  },

  food: {
    id: 'food',
    name: 'Food & Groceries',
    icon: 'Utensils',
    description: 'Food items, beverages, and grocery products',
    categories: [
      {
        id: 'staples',
        name: 'Food Staples',
        subcategories: ['Rice', 'Beans', 'Garri', 'Semolina', 'Yam Flour', 'Wheat', 'Pasta', 'Noodles']
      },
      {
        id: 'beverages',
        name: 'Beverages',
        subcategories: ['Soft Drinks', 'Juices', 'Water', 'Tea', 'Coffee', 'Energy Drinks', 'Wine', 'Beer']
      },
      {
        id: 'snacks',
        name: 'Snacks & Confectionery',
        subcategories: ['Biscuits', 'Chips', 'Chocolates', 'Candy', 'Nuts', 'Popcorn', 'Cakes']
      },
      {
        id: 'condiments',
        name: 'Condiments & Sauces',
        subcategories: ['Oil', 'Spices', 'Seasoning', 'Tomato Paste', 'Mayonnaise', 'Ketchup', 'Honey']
      },
      {
        id: 'fresh',
        name: 'Fresh Food',
        subcategories: ['Vegetables', 'Fruits', 'Meat', 'Fish', 'Poultry', 'Eggs', 'Dairy']
      },
      {
        id: 'packaged',
        name: 'Packaged Foods',
        subcategories: ['Canned Foods', 'Frozen Foods', 'Breakfast Cereals', 'Baby Food', 'Health Foods']
      }
    ]
  },

  health: {
    id: 'health',
    name: 'Health & Wellness',
    icon: 'Heart',
    description: 'Health products, supplements, and wellness items',
    categories: [
      {
        id: 'supplements',
        name: 'Vitamins & Supplements',
        subcategories: ['Multivitamins', 'Vitamin C', 'Vitamin D', 'Protein Supplements', 'Herbal Supplements', 'Omega-3']
      },
      {
        id: 'medical',
        name: 'Medical Supplies',
        subcategories: ['First Aid', 'Thermometers', 'Blood Pressure Monitors', 'Glucometers', 'Masks', 'Sanitizers']
      },
      {
        id: 'fitness',
        name: 'Fitness & Exercise',
        subcategories: ['Exercise Equipment', 'Yoga Mats', 'Resistance Bands', 'Dumbbells', 'Skipping Ropes', 'Gym Gloves']
      },
      {
        id: 'sexual',
        name: 'Sexual Wellness',
        subcategories: ['Condoms', 'Lubricants', 'Sexual Health Supplements']
      },
      {
        id: 'wellness',
        name: 'Wellness Products',
        subcategories: ['Massage Oils', 'Essential Oils', 'Aromatherapy', 'Detox Products']
      }
    ]
  },

  sports: {
    id: 'sports',
    name: 'Sports & Outdoors',
    icon: 'Dumbbell',
    description: 'Sports equipment, outdoor gear, and fitness items',
    categories: [
      {
        id: 'team-sports',
        name: 'Team Sports',
        subcategories: ['Football', 'Basketball', 'Volleyball', 'Tennis', 'Cricket', 'Jerseys', 'Sports Shoes']
      },
      {
        id: 'outdoor',
        name: 'Outdoor Recreation',
        subcategories: ['Camping Gear', 'Hiking Equipment', 'Fishing Gear', 'Cycling', 'Swimming Gear']
      },
      {
        id: 'fitness-gear',
        name: 'Fitness Equipment',
        subcategories: ['Treadmills', 'Exercise Bikes', 'Weights', 'Bench Press', 'Home Gym Equipment']
      },
      {
        id: 'sportswear',
        name: 'Sportswear',
        subcategories: ['Activewear', 'Tracksuits', 'Sports Shorts', 'Sports Bras', 'Compression Wear']
      },
      {
        id: 'accessories-sports',
        name: 'Sports Accessories',
        subcategories: ['Water Bottles', 'Gym Bags', 'Sweatbands', 'Sports Watches', 'Protective Gear']
      }
    ]
  },

  baby: {
    id: 'baby',
    name: 'Baby & Kids',
    icon: 'Baby',
    description: 'Baby products, toys, and children items',
    categories: [
      {
        id: 'baby-clothing',
        name: 'Baby Clothing',
        subcategories: ['Onesies', 'Baby Dresses', 'Baby Suits', 'Sleepwear', 'Baby Shoes', 'Socks']
      },
      {
        id: 'baby-care',
        name: 'Baby Care',
        subcategories: ['Diapers', 'Baby Wipes', 'Baby Lotion', 'Baby Oil', 'Baby Shampoo', 'Baby Food']
      },
      {
        id: 'baby-gear',
        name: 'Baby Gear',
        subcategories: ['Strollers', 'Car Seats', 'Baby Carriers', 'Cribs', 'High Chairs', 'Playpens']
      },
      {
        id: 'toys',
        name: 'Toys & Games',
        subcategories: ['Educational Toys', 'Action Figures', 'Dolls', 'Board Games', 'Puzzles', 'Remote Control Toys']
      },
      {
        id: 'kids-learning',
        name: 'Kids Learning',
        subcategories: ['Books', 'Art Supplies', 'School Bags', 'Stationery', 'Learning Tablets']
      }
    ]
  },

  automotive: {
    id: 'automotive',
    name: 'Automotive',
    icon: 'Car',
    description: 'Car parts, accessories, and automotive products',
    categories: [
      {
        id: 'car-parts',
        name: 'Car Parts',
        subcategories: ['Engine Parts', 'Brake Parts', 'Suspension', 'Electrical Parts', 'Filters', 'Belts']
      },
      {
        id: 'car-care',
        name: 'Car Care',
        subcategories: ['Car Wash', 'Wax & Polish', 'Tire Care', 'Interior Cleaners', 'Air Fresheners']
      },
      {
        id: 'car-accessories',
        name: 'Car Accessories',
        subcategories: ['Seat Covers', 'Floor Mats', 'Steering Covers', 'Car Electronics', 'GPS', 'Dash Cams']
      },
      {
        id: 'tools',
        name: 'Tools & Equipment',
        subcategories: ['Hand Tools', 'Power Tools', 'Tool Sets', 'Car Jacks', 'Tire Inflators']
      },
      {
        id: 'motorcycle',
        name: 'Motorcycle',
        subcategories: ['Motorcycle Parts', 'Motorcycle Accessories', 'Helmets', 'Riding Gear']
      }
    ]
  },

  books: {
    id: 'books',
    name: 'Books & Media',
    icon: 'BookOpen',
    description: 'Books, magazines, and media products',
    categories: [
      {
        id: 'fiction',
        name: 'Fiction',
        subcategories: ['Novels', 'Romance', 'Thriller', 'Science Fiction', 'Fantasy', 'African Literature']
      },
      {
        id: 'non-fiction',
        name: 'Non-Fiction',
        subcategories: ['Biography', 'Self-Help', 'Business', 'History', 'Religion', 'Cookbooks']
      },
      {
        id: 'educational',
        name: 'Educational',
        subcategories: ['Textbooks', 'Reference Books', 'Study Guides', 'Children Books', 'Language Learning']
      },
      {
        id: 'religious',
        name: 'Religious & Spiritual',
        subcategories: ['Bibles', 'Qurans', 'Christian Books', 'Islamic Books', 'Devotionals']
      },
      {
        id: 'media',
        name: 'Music & Movies',
        subcategories: ['Music CDs', 'Movie DVDs', 'Vinyl Records', 'Digital Music']
      }
    ]
  },

  jewelry: {
    id: 'jewelry',
    name: 'Jewelry & Watches',
    icon: 'Gem',
    description: 'Fine jewelry, fashion jewelry, and timepieces',
    categories: [
      {
        id: 'fine-jewelry',
        name: 'Fine Jewelry',
        subcategories: ['Gold Jewelry', 'Silver Jewelry', 'Diamond Jewelry', 'Gemstone Jewelry']
      },
      {
        id: 'fashion-jewelry',
        name: 'Fashion Jewelry',
        subcategories: ['Necklaces', 'Earrings', 'Bracelets', 'Rings', 'Anklets', 'Brooches']
      },
      {
        id: 'watches',
        name: 'Watches',
        subcategories: ['Men Watches', 'Women Watches', 'Smart Watches', 'Luxury Watches', 'Watch Accessories']
      },
      {
        id: 'bridal',
        name: 'Bridal Jewelry',
        subcategories: ['Engagement Rings', 'Wedding Bands', 'Bridal Sets', 'Bridal Accessories']
      },
      {
        id: 'beads',
        name: 'Beads & Traditional',
        subcategories: ['Coral Beads', 'Amber Beads', 'Waist Beads', 'Traditional Jewelry']
      }
    ]
  },

  handmade: {
    id: 'handmade',
    name: 'Handmade & Crafts',
    icon: 'Palette',
    description: 'Handcrafted items, art, and custom products',
    categories: [
      {
        id: 'art',
        name: 'Art & Paintings',
        subcategories: ['Paintings', 'Drawings', 'Prints', 'Sculptures', 'Photography']
      },
      {
        id: 'crafts',
        name: 'Crafts',
        subcategories: ['Pottery', 'Woodwork', 'Textile Crafts', 'Paper Crafts', 'Beadwork', 'Leather Crafts']
      },
      {
        id: 'custom',
        name: 'Custom Made',
        subcategories: ['Custom Clothing', 'Custom Shoes', 'Custom Jewelry', 'Personalized Gifts']
      },
      {
        id: 'supplies',
        name: 'Craft Supplies',
        subcategories: ['Fabrics', 'Yarn', 'Beads', 'Paints', 'Craft Tools', 'Sewing Supplies']
      }
    ]
  },

  pets: {
    id: 'pets',
    name: 'Pet Supplies',
    icon: 'Dog',
    description: 'Pet food, accessories, and care products',
    categories: [
      {
        id: 'pet-food',
        name: 'Pet Food',
        subcategories: ['Dog Food', 'Cat Food', 'Bird Food', 'Fish Food', 'Pet Treats']
      },
      {
        id: 'pet-care',
        name: 'Pet Care',
        subcategories: ['Pet Shampoo', 'Pet Vitamins', 'Flea & Tick', 'Pet Grooming']
      },
      {
        id: 'pet-accessories',
        name: 'Pet Accessories',
        subcategories: ['Collars & Leashes', 'Pet Beds', 'Pet Toys', 'Feeding Bowls', 'Pet Carriers']
      },
      {
        id: 'pet-health',
        name: 'Pet Health',
        subcategories: ['Pet Medications', 'First Aid', 'Dental Care', 'Joint Care']
      }
    ]
  },

  office: {
    id: 'office',
    name: 'Office & School',
    icon: 'Briefcase',
    description: 'Office supplies, stationery, and school items',
    categories: [
      {
        id: 'stationery',
        name: 'Stationery',
        subcategories: ['Pens & Pencils', 'Notebooks', 'Paper', 'Envelopes', 'Folders', 'Staplers']
      },
      {
        id: 'office-supplies',
        name: 'Office Supplies',
        subcategories: ['Ink & Toner', 'Calculators', 'Scissors', 'Tape', 'Glue', 'Paper Clips']
      },
      {
        id: 'school',
        name: 'School Supplies',
        subcategories: ['School Bags', 'Lunch Boxes', 'Water Bottles', 'Uniforms', 'Art Supplies']
      },
      {
        id: 'presentation',
        name: 'Presentation',
        subcategories: ['Whiteboards', 'Markers', 'Projectors', 'Flip Charts', 'Pointer']
      }
    ]
  },

  agriculture: {
    id: 'agriculture',
    name: 'Agriculture',
    icon: 'Wheat',
    description: 'Farming supplies, seeds, and agricultural products',
    categories: [
      {
        id: 'seeds',
        name: 'Seeds & Seedlings',
        subcategories: ['Vegetable Seeds', 'Fruit Seeds', 'Grain Seeds', 'Flower Seeds', 'Seedlings']
      },
      {
        id: 'fertilizers',
        name: 'Fertilizers & Chemicals',
        subcategories: ['Organic Fertilizers', 'NPK Fertilizers', 'Pesticides', 'Herbicides', 'Fungicides']
      },
      {
        id: 'equipment',
        name: 'Farm Equipment',
        subcategories: ['Sprayers', 'Water Pumps', 'Cutlasses', 'Hoes', 'Shovels', 'Wheelbarrows']
      },
      {
        id: 'livestock',
        name: 'Livestock & Poultry',
        subcategories: ['Animal Feed', 'Poultry Feed', 'Veterinary Products', 'Livestock Equipment']
      },
      {
        id: 'produce',
        name: 'Farm Produce',
        subcategories: ['Fresh Vegetables', 'Fresh Fruits', 'Grains', 'Tubers', 'Poultry Products']
      }
    ]
  }
};

// Get all niche IDs
export const getAllNicheIds = (): string[] => {
  return Object.keys(NICHE_CATEGORIES);
};

// Get niche by ID
export const getNicheById = (id: string): Niche | null => {
  return NICHE_CATEGORIES[id] || null;
};

// Get categories for a niche
export const getNicheCategories = (nicheId: string): NicheCategory[] => {
  return NICHE_CATEGORIES[nicheId]?.categories || [];
};

// Get all subcategories for a niche category
export const getSubcategories = (nicheId: string, categoryId: string): string[] => {
  const niche = NICHE_CATEGORIES[nicheId];
  if (!niche) return [];
  
  const category = niche.categories.find(c => c.id === categoryId);
  return category?.subcategories || [];
};

// Check if a niche exists
export const nicheExists = (nicheId: string): boolean => {
  return nicheId in NICHE_CATEGORIES;
};

// Get niche display info (for dropdowns, etc.)
export const getNicheDisplayList = () => {
  return Object.values(NICHE_CATEGORIES).map(niche => ({
    id: niche.id,
    name: niche.name,
    icon: niche.icon,
    description: niche.description
  }));
};

// Subscription tiers and their niche limits
export const SUBSCRIPTION_NICHE_LIMITS: Record<string, number> = {
  'free': 1,           // 4-day trial - 1 niche only
  'one_niche': 1,      // Starter plan
  'three_niches': 3,   // Growth plan  
  'unlimited': Infinity // Enterprise plan
};
// Normalize tier IDs for consistent enforcement
export const normalizeTierId = (tier: string | null | undefined): string => {
  if (!tier) return 'one_niche'; // Default fallback
  
  // Map legacy IDs to new standard
  const tierMap: Record<string, string> = {
    'single': 'one_niche',
    'three': 'three_niches',
    'starter': 'one_niche',
    'growth': 'three_niches',
    'enterprise': 'unlimited'
  };
  
  return tierMap[tier] || tier;
};
export const canAddNiche = (currentNiches: string[], tier: string): boolean => {
  const normalizedTier = normalizeTierId(tier);
  const limit = SUBSCRIPTION_NICHE_LIMITS[normalizedTier] || 1;
  return currentNiches.length < limit;
};

export const getRemainingNicheSlots = (currentNiches: string[], tier: string): number => {
  const normalizedTier = normalizeTierId(tier);
  const limit = SUBSCRIPTION_NICHE_LIMITS[normalizedTier] || 1;
  return Math.max(0, limit - currentNiches.length);
};
