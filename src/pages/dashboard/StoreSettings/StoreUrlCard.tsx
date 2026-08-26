import { Globe, Clock, Link2, AlertCircle } from 'lucide-react';

interface Props {
  customDomain?: string | null;
  domainStatus?: string | null;
  slug?: string;
  domainRequest: {
    admin_approved: boolean;
    status: string;
    domain_name: string;
    payment_status: string;
  } | null;
}

export default function StoreUrlCard({ customDomain, domainStatus, slug, domainRequest }: Props) {
  const getStoreUrlDisplay = () => {
    if (customDomain && domainStatus === 'connected' && domainRequest?.admin_approved) {
      return { url: `https://${customDomain}`, display: customDomain, status: 'active' as const, badge: 'Live Domain' };
    }
    if (customDomain && domainStatus === 'pending' && domainRequest?.domain_name && !domainRequest?.admin_approved) {
      return { url: `/${slug}`, display: `qafrica.store/${slug}`, status: 'pending' as const, badge: 'Pending Approval', pendingDomain: domainRequest.domain_name };
    }
    return { url: `/${slug}`, display: `qafrica.store/${slug}`, status: 'default' as const, badge: 'Default URL' };
  };
  const urlInfo = getStoreUrlDisplay();

  return (
    <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${urlInfo.status === 'active' ? 'bg-green-100 dark:bg-green-500/10' : urlInfo.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-500/10' : 'bg-blue-100 dark:bg-blue-500/10'}`}>
          {urlInfo.status === 'active' ? <Globe className="w-4 h-4 text-green-500" /> : urlInfo.status === 'pending' ? <Clock className="w-4 h-4 text-yellow-500" /> : <Link2 className="w-4 h-4 text-blue-500" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Store URL</p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${urlInfo.status === 'active' ? 'bg-green-100 dark:bg-green-500/10 text-green-800 dark:text-green-400' : urlInfo.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
            {urlInfo.badge}
          </span>
        </div>
      </div>
      <div className={`flex items-center gap-3 p-3 rounded-lg text-sm ${urlInfo.status === 'active' ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-800' : urlInfo.status === 'pending' ? 'bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-800' : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'}`}>
        <span className="text-gray-900 dark:text-white font-medium">{urlInfo.display}</span>
        {urlInfo.status === 'active' && (
          <a href={urlInfo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 ml-auto text-xs">
            Visit Store →
          </a>
        )}
      </div>
      {urlInfo.status === 'pending' && 'pendingDomain' in urlInfo && (
        <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700 dark:text-orange-300">
            Domain <strong>{urlInfo.pendingDomain}</strong> is awaiting admin approval. Your store is accessible via the default URL until then.
          </p>
        </div>
      )}
      {urlInfo.status === 'default' && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Set up a custom domain from the <a href="/dashboard/domain" className="text-orange-600 dark:text-orange-400 underline">Custom Domain</a> section.
        </p>
      )}
    </div>
  );
}
