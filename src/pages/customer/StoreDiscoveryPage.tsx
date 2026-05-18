import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Search, Store as StoreIcon, Star, TrendingUp, MapPin,
  ShoppingBag, Filter, ChevronRight, Sparkles, ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabase';
import type { Store } from '@/types';

// Featured categories
const categories = [
  { id: 'all', name: 'All Stores', icon: StoreIcon },
  { id: 'fashion', name: 'Fashion', icon: ShoppingBag },
  { id: 'electronics', name: 'Electronics', icon: TrendingUp },
  { id: 'beauty', name: 'Beauty', icon: Sparkles },
  { id: 'home', name: 'Home', icon: MapPin },
];

interface StoreDisplay {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  niches: string[];
  product_count: number;
  rating: number;
  review_count: number;
  is_verified: boolean;
  created_at: string;
}

export default function StoreDiscoveryPage() {
  const [stores, setStores] = useState<any[]>([]); // Changed to any[] to accommodate the count relation safely
  const [filteredStores, setFilteredStores] = useState<StoreDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'rating'>('popular');

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    filterStores();
  }, [stores, searchQuery, selectedCategory, sortBy]);

  const fetchStores = async () => {
    try {
      // Fetch stores along with the count of their associated products
      const { data, error } = await supabase
        .from('stores')
        .select('*, products(count)')
        .eq('is_active', true)
        .or('is_blocked.eq.false,is_blocked.is.null')
        .order('created_at', { ascending: false });

      if (data && !error) {
        setStores(data);
      } else {
        setStores([]);
      }
    } catch (err) {
      console.error('Failed to fetch stores:', err);
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getProductCount = (productsObj: any) => {
    if (!productsObj) return 0;
    if (Array.isArray(productsObj) && productsObj.length > 0) {
      return productsObj[0].count || 0;
    }
    if (typeof productsObj.count === 'number') {
      return productsObj.count;
    }
    return 0;
  };

  const filterStores = () => {
    if (stores.length === 0 && isLoading) return;
    
    let filtered: StoreDisplay[] = stores.length > 0 
      ? stores.map(s => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          description: s.description,
          logo_url: s.logo_url || null,
          banner_url: s.banner_url || null,
          primary_color: s.primary_color,
          niches: s.niches || [],
          // Dynamically set the product count from the relation
          product_count: getProductCount(s.products),
          rating: 4.5, // Can be connected to reviews(rating) later
          review_count: 100, // Can be connected to reviews(count) later
          is_verified: s.is_verified,
          created_at: s.created_at,
        }))
      : [];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(store =>
        store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(store =>
        store.niches?.includes(selectedCategory)
      );
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      default:
        filtered.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
    }

    setFilteredStores(filtered);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Discover Amazing Stores
            </h1>
            <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
              Browse hundreds of verified sellers across Nigeria. 
              Find everything you need in one place.
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stores..."
                className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-orange-300"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Sort and Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {filteredStores.length} store{filteredStores.length !== 1 ? 's' : ''} found
          </p>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        {/* Stores Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="text-center py-16">
            <StoreIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No stores found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStores.map((store, index) => (
              <motion.div
                key={store.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={`/${store.slug}`}
                  className="block bg-white rounded-xl border hover:shadow-lg transition-shadow overflow-hidden group"
                >
                  {/* UPDATED: Store Banner with Image Support */}
                  <div 
                    className="h-24 relative bg-cover bg-center"
                    style={{ 
                      backgroundImage: store.banner_url ? `url(${store.banner_url})` : 'none',
                      backgroundColor: store.banner_url ? 'transparent' : (store.primary_color || '#F97316')
                    }}
                  >
                    {/* Overlay for better text contrast if banner exists */}
                    {store.banner_url && (
                      <div className="absolute inset-0 bg-black/20" />
                    )}
                    <div className="absolute -bottom-8 left-4">
                      <div className="w-16 h-16 bg-white rounded-xl shadow-md flex items-center justify-center relative z-10">
                        {store.logo_url ? (
                          <img 
                            src={store.logo_url} 
                            alt={store.name}
                            className="w-12 h-12 object-contain"
                          />
                        ) : (
                          <span 
                            className="text-2xl font-bold"
                            style={{ color: store.primary_color || '#F97316' }}
                          >
                            {store.name.charAt(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Store Info */}
                  <div className="pt-10 pb-4 px-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg group-hover:text-orange-600 transition-colors">
                          {store.name}
                        </h3>
                        {store.is_verified && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3 fill-current" />
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{store.rating || 4.5}</span>
                      </div>
                    </div>

                    <p className="text-gray-500 text-sm line-clamp-2 mb-4">
                      {store.description || 'No description available'}
                    </p>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {store.product_count || 0} products
                      </span>
                      <span className="text-orange-600 font-medium flex items-center gap-1">
                        Visit Store
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* Call to Action for Sellers */}
        <div className="mt-16 bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">Have products to sell?</h2>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto">
            Join thousands of sellers on QuickSell Africa and reach millions of customers across Nigeria.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8">
                Start Selling
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}