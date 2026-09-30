import { Loader2, ArrowLeft, Ticket } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AiSupportInbox from '@/pages/import-admin/AiSupportInbox';
import AiSupportConversationSearch from './AiSupportConversationSearch';
import ImportSupportTickets from './ImportSupportTickets';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

export default function ImportAdminV2Support() {
  const token = getManagementToken();
  const [searchParams] = useSearchParams();
  const ticketsView = searchParams.get('view') === 'tickets';
  const { loading, error, hasPermission } = useImportAdminPermissions(token);

  if (!token) return null;

  if (loading) {
    return (
      <div className="min-h-[240px] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-sm font-bold text-red-700">Could not load permissions</h2>
        <p className="text-xs text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!hasPermission('import.messages.view')) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-bold text-gray-900">Support access required</h2>
        <p className="text-xs text-gray-500 mt-1">Your manager account does not have permission to view support conversations.</p>
      </div>
    );
  }

  if (ticketsView) {
    return (
      <div className="space-y-4">
        <Link to="/import-admin-v2/support" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back to Support
        </Link>
        <ImportSupportTickets />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI Support</h1>
          <p className="text-sm text-gray-500 mt-1">Live AI, human handoffs and resolved conversations.</p>
        </div>
        <Link to="/import-admin-v2/support?view=tickets" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <Ticket className="w-4 h-4" /> Support Tickets
        </Link>
      </div>
      <AiSupportConversationSearch token={token} />
      <div data-qafrica-ai-support-inbox>
        <AiSupportInbox token={token} />
      </div>
    </div>
  );
}
