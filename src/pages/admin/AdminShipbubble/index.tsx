import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';
import { KPICards } from './components/KPICards';
import { GlobalToggle } from './components/GlobalToggle';
import { StoresTable } from './components/StoresTable';

export interface StoreRow {
  id: string;
  name: string;
  slug: string;
  delivery_mode: string;
  shipbubble_enabled: boolean;
  owner_email?: string;
}

export interface KPIData {
  total: number;
  shipbubble: number;
  manual: number;
  enabled: number;
}

export default function AdminShipbubblePage() {
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [isTogglingGlobal, setIsTogglingGlobal] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [kpi, setKpi] = useState<KPIData>({ total: 0, shipbubble: 0, manual: 0, enabled: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [togglingStoreId, setTogglingStoreId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch global setting
      const { data: setting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'shipbubble_globally_enabled')
        .single();
      setGlobalEnabled(setting?.value === true);

      // Fetch stores with owner email
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name, slug, delivery_mode, shipbubble_enabled, owner_id')
        .order('name');

      if (storeData) {
        // Fetch owner emails
        const ownerIds = [...new Set(storeData.map(s => s.owner_id).filter(Boolean))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', ownerIds);

        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.email]));

        const rows: StoreRow[] = storeData.map(s => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          delivery_mode: s.delivery_mode || 'manual',
          shipbubble_enabled: s.shipbubble_enabled || false,
          owner_email: profileMap[s.owner_id] || '—',
        }));

        setStores(rows);
        setKpi({
          total:      rows.length,
          shipbubble: rows.filter(s => s.delivery_mode === 'shipbubble').length,
          manual:     rows.filter(s => s.delivery_mode !== 'shipbubble').length,
          enabled:    rows.filter(s => s.shipbubble_enabled).length,
        });
      }
    } catch (err) {
      toast.error('Failed to load Shipbubble data');
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleGlobalToggle = async () => {
    setIsTogglingGlobal(true);
    try {
      const newValue = !globalEnabled;

      const { error } = await supabase
        .from('platform_settings')
        .update({ value: newValue, updated_at: new Date().toISOString() })
        .eq('key', 'shipbubble_globally_enabled');

      if (error) throw error;

      // If turning off globally — reset all stores to manual
      if (!newValue) {
        await supabase
          .from('stores')
          .update({ delivery_mode: 'manual' })
          .eq('delivery_mode', 'shipbubble');
        toast.success('Shipbubble disabled globally — all stores reset to manual');
      } else {
        toast.success('Shipbubble enabled globally');
      }

      setGlobalEnabled(newValue);
      await fetchData();
    } catch (err) {
      toast.error('Failed to update global setting');
    }
    setIsTogglingGlobal(false);
  };

  const handleStoreToggle = async (storeId: string, current: boolean) => {
    setTogglingStoreId(storeId);
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          shipbubble_enabled: !current,
          // If disabling, also reset delivery mode to manual
          ...(current ? { delivery_mode: 'manual' } : {}),
        })
        .eq('id', storeId);

      if (error) throw error;
      toast.success(!current ? 'Shipbubble enabled for store' : 'Shipbubble disabled for store');
      await fetchData();
    } catch (err) {
      toast.error('Failed to update store');
    }
    setTogglingStoreId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="w-6 h-6 text-orange-500" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Shipbubble Control</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage delivery modes across all stores</p>
        </div>
      </div>

      <KPICards kpi={kpi} isLoading={isLoading} />
      <GlobalToggle
        enabled={globalEnabled}
        isToggling={isTogglingGlobal}
        onToggle={handleGlobalToggle}
      />
      <StoresTable
        stores={stores}
        isLoading={isLoading}
        globalEnabled={globalEnabled}
        togglingStoreId={togglingStoreId}
        onToggle={handleStoreToggle}
      />
    </div>
  );
}