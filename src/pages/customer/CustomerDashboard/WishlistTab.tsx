import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabase';
import { useCartStore } from '@/stores';

export default function WishlistTab() {
  const { wishlist, removeFromWishlist } = useCartStore();
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchWishlistItems(); }, [wishlist]);

  const fetchWishlistItems = async () => {
    if (wishlist.length === 0) { setIsLoading(false); return; }
    try {
      const productIds = wishlist.map((w: any) => w.productId || w);
      const { data, error } = await supabase
        .from('products')
        .select('*, store:stores(name, slug)')
        .in('id', productIds);
      if (data && !error) setWishlistItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center py-10">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (wishlistItems.length === 0) return (
    <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
      <Heart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-500 mb-4">Your wishlist is empty</p>
      <Link to="/stores">
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">Browse Stores</Button>
      </Link>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {wishlistItems.map((item, index) => (
        <motion.div key={item.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.04 }}
          className="border border-gray-100 rounded-xl overflow-hidden group hover:border-gray-200 transition-colors">
          <div className="aspect-square bg-gray-50 relative overflow-hidden">
            {item.images?.[0] ? (
              <img src={item.images[0]} alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-200">{item.name?.charAt(0) ?? '?'}</span>
              </div>
            )}
            <button onClick={() => removeFromWishlist(item.id)}
              className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity">
              <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
            </button>
          </div>
          <div className="p-3">
            <p className="font-medium text-gray-900 text-sm line-clamp-1 mb-0.5">{item.name}</p>
            <p className="text-orange-600 font-bold text-sm">₦{item.selling_price?.toLocaleString()}</p>
            <Link to={`/${item.store?.slug}/product/${item.id}`}
              className="text-xs text-gray-400 hover:text-orange-500 flex items-center gap-1 mt-1 transition-colors">
              <Store className="w-3 h-3" />{item.store?.name}
            </Link>
          </div>
        </motion.div>
      ))}
    </div>
  );
}