// src/pages/customer/StoreDiscoveryPage.tsx

import { useState, useEffect } from 'react';
import { supabase } from '@/services';

import DiscoveryHero from './StoreDiscovery/DiscoveryHero';
import CategoryFilter from './StoreDiscovery/CategoryFilter';
import StoreGridControls from './StoreDiscovery/StoreGridControls';
import StoreGrid from './StoreDiscovery/StoreGrid';
import SellerCallToAction from './StoreDiscovery/SellerCallToAction';
import type { StoreDisplay, SortBy } from './StoreDiscovery/constants';

export default function StoreDiscoveryPage() {
  const [stores, setStores]                     = useState<any[]>([]);
  const [paidOwnerIds, setPaidOwnerIds]         = useState<Set<string>>(new Set());
  const [filteredStores, setFilteredStores]     = useState<StoreDisplay[]>([]);
  const [isLoading, setIsLoading]               = useState(true);
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy]                     = useState<SortBy>('popular');
  const [heroCollapsed, setHeroCollapsed]       = useState(false);

  useEffect(() => { fetchStores(); }, []);
  useEffect(() => { filterStores(); }, [stores, paidOwnerIds, searchQuery, selectedCategory, sortBy]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*, products(count)')
        .eq('is_active', true)
        .or('is_blocked.eq.false,is_blocked.is.null')
        .order('created_at', { ascending: false });
      const storeList = !error && data ? data : [];
      setStores(storeList);

      // Store-section visibility requires an active PAID (non-free) plan —
      // fetched separately since stores don't carry their own tier field.
      const ownerIds = [...new Set(storeList.map((s: any) => s.owner_id).filter(Boolean))];
      if (ownerIds.length > 0) {
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('user_id, tier, is_active, expires_at')
          .in('user_id', ownerIds)
          .eq('is_active', true)
          .neq('tier', 'free');

        const paidSet = new Set<string>(
          (subs ?? [])
            .filter((s: any) => !s.expires_at || new Date(s.expires_at) > new Date())
            .map((s: any) => s.user_id),
        );
        setPaidOwnerIds(paidSet);
      } else {
        setPaidOwnerIds(new Set());
      }
    } catch (err) {
      console.error('Failed to fetch stores:', err);
      setStores([]);
      setPaidOwnerIds(new Set());
    } finally {
      setIsLoading(false);
    }
  };

  const getProductCount = (productsObj: any) => {
    if (!productsObj) return 0;
    if (Array.isArray(productsObj) && productsObj.length > 0) return productsObj[0].count || 0;
    if (typeof productsObj.count === 'number') return productsObj.count;
    return 0;
  };

  const filterStores = () => {
    if (stores.length === 0 && isLoading) return;

    // Store-section visibility gate: must be on an active paid plan, have at
    // least 5 product postings, and have both a logo and store banner set.
    let filtered: StoreDisplay[] = stores
      .filter((s) => {
        const hasPaidPlan  = paidOwnerIds.has(s.owner_id);
        const hasEnoughProducts = getProductCount(s.products) >= 5;
        const hasBranding  = !!s.logo_url && !!s.banner_url;
        return hasPaidPlan && hasEnoughProducts && hasBranding;
      })
      .map((s) => ({
        id:            s.id,
        name:          s.name,
        slug:          s.slug,
        description:   s.description,
        logo_url:      s.logo_url   || null,
        banner_url:    s.banner_url || null,
        primary_color: s.primary_color,
        niches:        s.niches     || [],
        product_count: getProductCount(s.products),
        rating:        4.5,
        review_count:  100,
        is_verified:   s.is_verified,
        created_at:    s.created_at,
      }));

    if (searchQuery) {
      filtered = filtered.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((s) => s.niches?.includes(selectedCategory));
    }
    switch (sortBy) {
      case 'rating':  filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      case 'newest':  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      default:        filtered.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
    }
    setFilteredStores(filtered);
  };

  return (
    // ── No spacer div — hero is sticky, content flows naturally beneath ──
    <div className="min-h-screen bg-gray-50">
      <DiscoveryHero
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        collapsed={heroCollapsed}
        onCollapse={() => setHeroCollapsed(true)}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CategoryFilter
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
        />
        <StoreGridControls
          totalCount={filteredStores.length}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
        <StoreGrid stores={filteredStores} isLoading={isLoading} />
        <SellerCallToAction />
      </div>
    </div>
  );
}