import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useStoreStore, useAuthStore } from '@/stores';

import TabNav from './StoreSettings/TabNav';
import AccountTab from './StoreSettings/AccountTab';
import GeneralTab from './StoreSettings/GeneralTab';
import ImagesTab from './StoreSettings/ImagesTab';
import BrandingTab from './StoreSettings/BrandingTab';
import PaymentsTab from './StoreSettings/PaymentsTab';
import SocialTab from './StoreSettings/SocialTab';
import LocationTab from './StoreSettings/LocationTab';
import PasswordTab from './StoreSettings/PasswordTab';
import StaffTab from './StoreSettings/Staff/StaffTab';
import { TABS, type Tab } from './StoreSettings/constants';

export default function StoreSettingsPage() {
  const { currentStore } = useStoreStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (TABS.some((x) => x.id === t)) return t as Tab;
    // Until the email is confirmed, Settings opens on it (setup guide step 1)
    return useAuthStore.getState().user?.email_verified ? 'general' : 'account';
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>
        <p className="text-gray-500 mt-1">Manage your store preferences</p>
      </div>

      <TabNav activeTab={activeTab} onChange={setActiveTab} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'account'  && <AccountTab />}
          {activeTab === 'general'  && <GeneralTab />}
          {activeTab === 'images'   && <ImagesTab />}
          {activeTab === 'branding' && <BrandingTab />}
          {activeTab === 'payments' && <PaymentsTab />}
          {activeTab === 'social'   && <SocialTab />}
          {activeTab === 'location' && <LocationTab />}
          {activeTab === 'password' && <PasswordTab />}
          {activeTab === 'staff'    && (
            <StaffTab storeId={currentStore?.id ?? ''} ownerId={user?.id ?? ''} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
