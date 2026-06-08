# QAfrica Repository Refactoring Plan
## Breaking Large Files into Smaller, More Maintainable Components

**Created:** June 8, 2026  
**Objective:** Improve code maintainability, testability, and debugging by decomposing large monolithic files into focused, single-responsibility components.

---

## Executive Summary

The QAfrica repository contains several large files that handle multiple responsibilities and are difficult to debug:

| File | Size | Current Responsibilities | Priority |
|------|------|--------------------------|----------|
| `ManualSalesPage.tsx` | 18.7 KB | Form handling, validation, database operations, UI rendering | **HIGH** |
| `src/lib/i18n.ts` | 12.2 KB | All translations (EN, YO, HA, IG), helper functions | **MEDIUM** |
| `src/lib/nicheCategories.ts` | 19.5 KB | All niche definitions, utilities, tier limits | **MEDIUM** |
| `src/lib/pricing.ts` | 8.3 KB | Pricing logic, calculations, tier management | **MEDIUM** |
| `src/App.tsx` | 17.1 KB | Route definitions, guards, authentication logic | **HIGH** |

---

## Detailed Refactoring Plan

### 1. **ManualSalesPage.tsx** - HIGH PRIORITY
**Current State:** 501 lines, mixed concerns  
**Issues:** 
- Form state management mixed with API calls
- Validation logic intertwined with UI
- Success/error handling not modularized
- Stock management logic embedded in component

**Proposed Structure:**
```
src/pages/dashboard/ManualSalesPage/
├── ManualSalesPage.tsx (Main component, ~80 lines)
├── components/
│   ├── ManualSaleForm.tsx (Form UI, ~150 lines)
│   ├── ProductSection.tsx (Product details, ~80 lines)
│   ├── CustomerSection.tsx (Customer info, ~100 lines)
│   ├── PaymentSection.tsx (Payment details, ~80 lines)
│   └── SuccessModal.tsx (Success state, ~50 lines)
├── hooks/
│   ├── useManualSaleForm.ts (Form state, ~100 lines)
│   ├── useProductLoader.ts (Product fetching, ~80 lines)
│   └── useManualSaleSubmit.ts (Submit logic, ~120 lines)
├── types.ts (TypeScript interfaces, ~20 lines)
└── utils.ts (Validation & helpers, ~60 lines)
```

**Benefits:**
- Each component has single responsibility
- Easier to unit test
- Form state isolated and reusable
- API logic separated from UI
- Validation logic testable independently

---

### 2. **src/lib/i18n.ts** - MEDIUM PRIORITY
**Current State:** 504 lines, all translations inline  
**Issues:**
- All language translations in one file
- Difficult to maintain and update individual languages
- Helper functions mixed with data
- Hard to add new languages

**Proposed Structure:**
```
src/lib/i18n/
├── index.ts (Main exports, ~50 lines)
├── types.ts (TypeScript interfaces, ~20 lines)
├── helpers.ts (getTranslation, etc., ~40 lines)
├── languageConfig.ts (Metadata, flags, names, ~30 lines)
├── translations/
│   ├── en.ts (English translations, ~115 lines)
│   ├── yo.ts (Yoruba translations, ~115 lines)
│   ├── ha.ts (Hausa translations, ~115 lines)
│   └── ig.ts (Igbo translations, ~115 lines)
└── storage.ts (localStorage logic, ~30 lines)
```

**Benefits:**
- Each language file is independently maintainable
- Easier to add new languages
- Translation updates don't affect other languages
- Storage logic isolated
- Helper functions clearly separated

---

### 3. **src/lib/nicheCategories.ts** - MEDIUM PRIORITY
**Current State:** 617 lines, monolithic  
**Issues:**
- All 16+ niches defined sequentially
- Difficult to modify individual niches
- Utility functions scattered throughout
- Tier limit logic mixed with niche data

**Proposed Structure:**
```
src/lib/niches/
├── index.ts (Main exports, ~40 lines)
├── types.ts (TypeScript interfaces, ~30 lines)
├── categories/
│   ├── fashion.ts (~55 lines)
│   ├── electronics.ts (~60 lines)
│   ├── beauty.ts (~55 lines)
│   ├── home.ts (~55 lines)
│   ├── food.ts (~60 lines)
│   ├── health.ts (~55 lines)
│   ├── sports.ts (~55 lines)
│   ├── baby.ts (~55 lines)
│   ├── automotive.ts (~55 lines)
│   ├── books.ts (~55 lines)
│   ├── jewelry.ts (~55 lines)
│   ├── handmade.ts (~50 lines)
│   ├── pets.ts (~50 lines)
│   ├── office.ts (~50 lines)
│   └── agriculture.ts (~60 lines)
├── categoryIndex.ts (Combines all, ~50 lines)
├── utils.ts (Utility functions, ~60 lines)
└── tierLimits.ts (Subscription tier logic, ~40 lines)
```

**Benefits:**
- Each niche independently maintainable
- Modifying one niche doesn't affect others
- Easy to add/remove niches
- Tier logic decoupled from data
- Utility functions clearly organized

---

### 4. **src/lib/pricing.ts** - MEDIUM PRIORITY
**Current State:** 297 lines, mixed data and logic  
**Issues:**
- Pricing tiers, durations, and calculations mixed
- Difficult to update pricing logic
- Lifetime pricing separate from tier definitions
- Trial logic scattered

**Proposed Structure:**
```
src/lib/pricing/
├── index.ts (Main exports, ~30 lines)
├── types.ts (TypeScript interfaces, ~30 lines)
├── tiers.ts (Pricing tier definitions, ~80 lines)
├── durations.ts (Duration plans, ~40 lines)
├── lifetime.ts (Lifetime pricing, ~20 lines)
├── trial.ts (Trial configuration, ~30 lines)
├── calculations.ts (Price calculation logic, ~70 lines)
├── validation.ts (Tier validation logic, ~80 lines)
└── utils.ts (Formatting & helpers, ~40 lines)
```

**Benefits:**
- Pricing tiers isolated and easily updatable
- Calculation logic independently testable
- Trial logic centralized
- Tier validation logic separated
- Lifetime pricing independently manageable

---

### 5. **src/App.tsx** - HIGH PRIORITY
**Current State:** 344 lines, many responsibilities  
**Issues:**
- All routes defined in one component
- Auth guards mixed with route logic
- Theme initialization mixed with routing
- Protected route logic not reusable

**Proposed Structure:**
```
src/
├── App.tsx (Main app wrapper, ~50 lines)
├── routes/
│   ├── index.ts (All route definitions, ~150 lines)
│   ├── publicRoutes.ts (Public routes, ~60 lines)
│   ├── authRoutes.ts (Auth routes, ~80 lines)
│   ├── dashboardRoutes.ts (Dashboard routes, ~100 lines)
│   ├── adminRoutes.ts (Admin routes, ~50 lines)
│   ├── developerRoutes.ts (Developer routes, ~80 lines)
│   ├── storeRoutes.ts (Store routes, ~40 lines)
│   ├── customerRoutes.ts (Customer routes, ~40 lines)
│   └── legalRoutes.ts (Legal routes, ~20 lines)
├── guards/
│   ├── ProtectedRoute.tsx (~50 lines)
│   ├── PublicRoute.tsx (~40 lines)
│   ├── AdminRoute.tsx (~30 lines)
│   ├── StaffRoute.tsx (~30 lines)
│   └── useRouteGuards.ts (~50 lines)
├── theme/
│   ├── themeInitializer.ts (~30 lines)
│   └── useTheme.ts (~40 lines)
└── config/
    └── routeConfig.ts (~40 lines)
```

**Benefits:**
- Routes organized by feature/domain
- Guard logic reusable and testable
- Theme initialization isolated
- Each route file has single responsibility
- Easier to add new routes or guards

---

## Implementation Roadmap

### Phase 1: Foundation & Utilities (Week 1)
- [ ] Create new folder structures
- [ ] Extract types.ts files for each module
- [ ] Extract utility functions
- [ ] Create index.ts files with exports

### Phase 2: Library Refactoring (Week 2)
- [ ] Refactor `src/lib/i18n.ts` → separate language files
- [ ] Refactor `src/lib/pricing.ts` → separate pricing modules
- [ ] Refactor `src/lib/nicheCategories.ts` → separate niche files
- [ ] Update all imports throughout codebase

### Phase 3: Component Refactoring (Week 3)
- [ ] Refactor `ManualSalesPage.tsx` → component structure with hooks
- [ ] Create custom hooks for form, product loading, submission
- [ ] Refactor `src/App.tsx` → separate route and guard modules
- [ ] Update all imports

### Phase 4: Testing & Validation (Week 4)
- [ ] Add unit tests for extracted utilities
- [ ] Add unit tests for custom hooks
- [ ] Add integration tests for components
- [ ] Performance testing
- [ ] Manual testing of all routes and pages

---

## Example Implementations

### Example 1: ManualSalesPage Hook - useManualSaleForm.ts
```typescript
// src/pages/dashboard/ManualSalesPage/hooks/useManualSaleForm.ts
import { useState } from 'react';

export interface ManualSaleForm {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  paymentMethod: 'cash' | 'transfer' | 'pos' | 'check';
  paymentStatus: 'pending' | 'received';
  notes: string;
}

export const useManualSaleForm = (initialForm: ManualSaleForm) => {
  const [form, setForm] = useState<ManualSaleForm>(initialForm);
  
  const updateField = (field: keyof ManualSaleForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };
  
  const resetForm = () => {
    setForm(initialForm);
  };
  
  return { form, setForm, updateField, resetForm };
};
```

### Example 2: i18n Language File - en.ts
```typescript
// src/lib/i18n/translations/en.ts
export const enTranslations = {
  nav: {
    home: 'Home',
    dashboard: 'Dashboard',
    // ... rest
  },
  auth: {
    login: 'Login',
    // ... rest
  },
  // ... rest
};
```

### Example 3: Niche Category Module - fashion.ts
```typescript
// src/lib/niches/categories/fashion.ts
import { Niche } from '../types';

export const fashionNiche: Niche = {
  id: 'fashion',
  name: 'Fashion & Apparel',
  icon: 'Shirt',
  description: 'Clothing, shoes, accessories, and fashion items',
  categories: [
    // ... categories
  ]
};
```

---

## Migration Guide for Developers

### Before (Current)
```typescript
import { getTranslation } from '@/lib/i18n';
import { NICHE_CATEGORIES, getNicheById } from '@/lib/nicheCategories';
import { calculateSubscriptionPrice } from '@/lib/pricing';
```

### After (New)
```typescript
import { getTranslation } from '@/lib/i18n';
import { getNicheById } from '@/lib/niches';
import { calculateSubscriptionPrice } from '@/lib/pricing';
```

**All exports will remain the same** - only the internal organization changes. This is a **non-breaking refactor**.

---

## Testing Strategy

### Unit Tests
- [ ] Test all utility functions independently
- [ ] Test custom hooks in isolation
- [ ] Test form validation logic
- [ ] Test pricing calculations
- [ ] Test niche utilities

### Integration Tests
- [ ] Test ManualSalesPage form submission
- [ ] Test route guards and navigation
- [ ] Test language switching
- [ ] Test pricing tier changes

### Performance Tests
- [ ] Verify bundle size reduction
- [ ] Check component render performance
- [ ] Test lazy loading of routes

---

## Estimated Impact

### Code Quality
- **Maintainability:** ↑ 70% (reduced cognitive load)
- **Testability:** ↑ 80% (isolated logic easier to test)
- **Readability:** ↑ 60% (clearer file structure)

### Performance
- **Bundle Size:** ~ (same with proper tree-shaking)
- **Initial Load:** ↑ 5-10% (better code splitting)
- **Runtime:** ↑ (negligible, improves with lazy loading)

### Developer Experience
- **Time to Find Code:** ↓ 50% (clear file organization)
- **Time to Add Feature:** ↓ 40% (reusable hooks and components)
- **Debugging:** ↑ 60% (isolated responsibilities)

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Breaking existing imports | Low | High | Keep re-exports in index.ts, gradual migration |
| Missing functionality | Medium | High | Comprehensive testing before deployment |
| Performance regression | Low | Medium | Performance benchmarks before/after |
| Developer friction | Medium | Medium | Clear documentation and examples |

---

## Success Criteria

✅ All large files broken into modules < 150 lines each  
✅ No breaking changes to public APIs  
✅ 100% test coverage for extracted utilities  
✅ Bundle size maintained or reduced  
✅ All routes and pages working as before  
✅ Documentation updated  
✅ Team training completed  

---

## Next Steps

1. **Review & Approve:** Get team consensus on structure
2. **Create Branch:** `refactor/decompose-large-files`
3. **Phase 1 Implementation:** Start with foundation utilities
4. **Incremental Merging:** Merge completed phases weekly
5. **Documentation:** Update dev docs with new structure
6. **Team Training:** Walkthrough with development team

---

## Questions & Discussions

- Should we use Storybook for component previews?
- Should we add pre-commit hooks for file size limits?
- Should we create a component library for reusable UI?
- Should we use a monorepo structure for better organization?

