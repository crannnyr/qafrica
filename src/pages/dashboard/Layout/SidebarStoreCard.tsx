// src/pages/dashboard/Layout/SidebarStoreCard.tsx

import { Globe, Clock, CheckCircle2 } from 'lucide-react';

interface Store {
  name: string;
  slug: string;
  custom_domain?: string;
  domain_status?: string;
  logo_url?: string;
}

interface DomainRequest {
  admin_approved: boolean;
  status: string;
  domain_name: string;
}

interface Props {
  currentStore: Store;
  storeUrl: string;
  storeDisplayUrl: string;
  isDomainPending: boolean;
  domainRequest: DomainRequest | null;
}

export default function SidebarStoreCard({
  currentStore,
  storeUrl,
  storeDisplayUrl,
  isDomainPending,
  domainRequest,
}: Props) {
  return (
    <div className="px-3 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
      >
        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Globe className="w-4 h-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {currentStore.name}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {storeDisplayUrl}
          </p>

          {isDomainPending && (
            <p className="text-[11px] text-yellow-600 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" /> Pending approval
            </p>
          )}

          {currentStore.custom_domain && domainRequest?.admin_approved && (
            <p className="text-[11px] text-green-600 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" /> Domain active
            </p>
          )}
        </div>
      </a>
    </div>
  );
}