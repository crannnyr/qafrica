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
  const [filteredStores, setFilteredStores]     = useState<StoreDisplay[]>([]);
  const [isLoading, setIsLoading]               = useState(true);
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy]                     = useState<SortBy>('popular');
  const [heroCollapsed, setHeroCollapsed]       = useState(false);

  useEffect(() => { fetchStores(); }, []);
  useEffect(() => { filterStores(); }, [stores, searchQuery, selectedCategory, sortBy]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*, products(count)')
        .eq('is_active', true)
        .or('is_blocked.eq.false,is_blocked.is.null')
        .order('created_at', { ascending: false });
      setStores(!error && data ? data : []);
    } catch (err) {
      console.error('Failed to fetch stores:', err);
      setStores([]);
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
    let filtered: StoreDisplay[] = stores.map((s) => ({
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