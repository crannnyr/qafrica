import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, CheckCircle, XCircle, Clock, ExternalLink, 
  Search, Filter, RefreshCw, AlertCircle, Check, X,
  ChevronDown, ChevronUp, Edit2, Save, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminStore } from '@/stores';
import { supabase } from '@/services';
import { toast } from 'sonner';

interface DomainRequest {
  id: string;
  store_id: string;
  user_id: string;
  domain_name: string;
  domain_type: 'new' | 'existing';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  amount_paid: number;
  payment_status: 'paid' | 'unpaid';
  payment_reference: string;
  admin_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  admin_notes: string | null;
  registrar_info: any;
  dns_records: any;
  requested_at: string;
  created_at: string;
  store: {
    name: string;
    slug: string;
    custom_domain: string;
    domain_status: string;
    owner_id: string;
  };
  owner: {
    full_name: string;
    email: string;
    phone: string;
  };
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'processing';

export default function AdminDomainRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<DomainRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<DomainRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DomainRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchDomainRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, searchQuery, statusFilter]);

  const fetchDomainRequests = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('domain_requests')
        .select(`
          *,
          store:store_id (
            name,
            slug,
            custom_domain,
            domain_status,
            owner_id
          ),
          owner:user_id (
            full_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching domain requests:', error);
        toast.error('Failed to load domain requests');
        return;
      }

      setRequests(data as DomainRequest[] || []);
    } catch (err) {
      console.error('Error:', err);
      toast.error('An error occurred');
    }
    setIsLoading(false);
  };

  const filterRequests = () => {
    let filtered = requests;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(req => 
        req.domain_name.toLowerCase().includes(query) ||
        req.store?.name.toLowerCase().includes(query) ||
        req.owner?.email.toLowerCase().includes(query) ||
        req.owner?.full_name.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'approved') {
        filtered = filtered.filter(req => req.admin_approved === true);
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(req => req.status === 'pending' && !req.admin_approved);
      } else if (statusFilter === 'rejected') {
        filtered = filtered.filter(req => req.status === 'rejected');
      } else if (statusFilter === 'processing') {
        filtered = filtered.filter(req => req.status === 'processing');
      }
    }

    setFilteredRequests(filtered);
  };

  const handleApprove = async (request: DomainRequest) => {
    if (!confirm(`Are you sure you want to approve ${request.domain_name}?`)) return;

    setIsProcessing(true);
    try {
      const { error: requestError } = await supabase
        .from('domain_requests')
        .update({
          admin_approved: true,
          status: 'completed',
          approved_at: new Date().toISOString(),
          admin_notes: adminNote || 'Domain approved and configured'
        })
        .eq('id', request.id);

      if (requestError) throw requestError;

      const { error: storeError } = await supabase
        .from('stores')
        .update({
          domain_status: 'connected',
          custom_domain: request.domain_name
        })
        .eq('id', request.store_id);

      if (storeError) throw storeError;

      toast.success(`Domain ${request.domain_name} approved successfully`);

      // Change 2: Email on approve
      if (request.owner?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: request.owner.email,
            subject: `QAFRICA — Your domain ${request.domain_name} is live!`,
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <div style="background:#F97316;border-radius:12px;padding:12px 18px;margin-bottom:24px;display:inline-block;">
                <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
              </div>
              <h2 style="color:#111827;">Your domain is live! 🎉</h2>
              <p style="color:#6B7280;">Hi ${request.owner.full_name || 'there'}, your domain <strong>${request.domain_name}</strong> has been approved and connected to your store <strong>${request.store?.name}</strong>.</p>
              <p style="color:#6B7280;margin-top:12px;">Visit your store at <a href="https://${request.domain_name}" style="color:#F97316;">https://${request.domain_name}</a></p>
            </div>`,
          },
        }).catch(console.error);
      }

      setAdminNote('');
      setExpandedId(null);
      fetchDomainRequests();
    } catch (err: any) {
      console.error('Error approving domain:', err);
      toast.error(`Failed to approve: ${err.message}`);
    }
    setIsProcessing(false);
  };

  const handleReject = async (request: DomainRequest) => {
    if (!confirm(`Are you sure you want to reject ${request.domain_name}?`)) return;

    setIsProcessing(true);
    try {
      const { error: requestError } = await supabase
        .from('domain_requests')
        .update({
          admin_approved: false,
          status: 'rejected',
          admin_notes: adminNote || 'Domain request rejected'
        })
        .eq('id', request.id);

      if (requestError) throw requestError;

      const { error: storeError } = await supabase
        .from('stores')
        .update({
          domain_status: 'none',
          custom_domain: null
        })
        .eq('id', request.store_id);

      if (storeError) throw storeError;

      toast.success(`Domain ${request.domain_name} rejected`);

      // Change 2: Email on reject
      if (request.owner?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: request.owner.email,
            subject: 'QAFRICA — Domain Request Update',
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <div style="background:#F97316;border-radius:12px;padding:12px 18px;margin-bottom:24px;display:inline-block;">
                <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
              </div>
              <h2 style="color:#111827;">Domain Request Update</h2>
              <p style="color:#6B7280;">Hi ${request.owner.full_name || 'there'}, unfortunately your domain request for <strong>${request.domain_name}</strong> could not be processed.</p>
              <p style="color:#6B7280;margin-top:8px;"><strong>Reason:</strong> ${adminNote || 'Please contact support for more information.'}</p>
              <p style="color:#6B7280;margin-top:8px;">If a payment was made, our team will process a refund within 3-5 business days.</p>
            </div>`,
          },
        }).catch(console.error);
      }

      setAdminNote('');
      setExpandedId(null);
      fetchDomainRequests();
    } catch (err: any) {
      console.error('Error rejecting domain:', err);
      toast.error(`Failed to reject: ${err.message}`);
    }
    setIsProcessing(false);
  };

  // Change 1: handleRevert
  const handleRevert = async (request: DomainRequest) => {
    if (!confirm(`Revert ${request.store?.name} back to their default /${request.store?.slug} URL?`)) return;
    setIsProcessing(true);
    try {
      await supabase
        .from('domain_requests')
        .update({ status: 'rejected', admin_notes: adminNote || 'Reverted to default URL by admin' })
        .eq('id', request.id);

      await supabase
        .from('stores')
        .update({ custom_domain: null, domain_status: 'none' })
        .eq('id', request.store_id);

      if (request.owner?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: request.owner.email,
            subject: 'QAFRICA — Domain Update',
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <div style="background:#F97316;border-radius:12px;padding:12px 18px;margin-bottom:24px;display:inline-block;">
                <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
              </div>
              <h2 style="color:#111827;">Your store has been reverted to its default URL</h2>
              <p style="color:#6B7280;">Hi ${request.owner.full_name || 'there'}, your store <strong>${request.store?.name}</strong> is now accessible at <strong>qafrica.store/${request.store?.slug}</strong>.</p>
              <p style="color:#6B7280;margin-top:12px;">${adminNote || 'If you have questions, please contact support.'}</p>
            </div>`,
          },
        });
      }

      toast.success('Store reverted to default URL');
      setAdminNote('');
      fetchDomainRequests();
    } catch (err: any) {
      toast.error(`Failed to revert: ${err.message}`);
    }
    setIsProcessing(false);
  };

  const handleSetProcessing = async (request: DomainRequest) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('domain_requests')
        .update({
          status: 'processing',
          admin_notes: adminNote || 'Domain configuration in progress'
        })
        .eq('id', request.id);

      if (error) throw error;

      await supabase
        .from('stores')
        .update({
          domain_status: 'processing'
        })
        .eq('id', request.store_id);

      toast.success('Status updated to processing');
      setAdminNote('');
      fetchDomainRequests();
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
    }
    setIsProcessing(false);
  };

  const getStatusBadge = (request: DomainRequest) => {
    if (request.status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }
    if (request.admin_approved && request.status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" />
          Approved
        </span>
      );
    }
    if (request.status === 'processing') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Processing
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Domain Requests</h1>
        <p className="text-gray-500 mt-1">
          Manage custom domain requests from store owners
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-yellow-700">
            {requests.filter(r => r.status === 'pending' && !r.admin_approved).length}
          </p>
          <p className="text-sm text-yellow-600">Pending</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-700">
            {requests.filter(r => r.status === 'processing').length}
          </p>
          <p className="text-sm text-blue-600">Processing</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">
            {requests.filter(r => r.admin_approved).length}
          </p>
          <p className="text-sm text-green-600">Approved</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-700">
            {requests.filter(r => r.status === 'rejected').length}
          </p>
          <p className="text-sm text-red-600">Rejected</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by domain, store name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
          className="px-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 outline-none"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <Button
          onClick={fetchDomainRequests}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">No domain requests</h3>
            <p className="text-gray-500">No requests match your current filters</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Header - Always visible */}
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      request.admin_approved ? 'bg-green-100' : 
                      request.status === 'rejected' ? 'bg-red-100' :
                      request.status === 'processing' ? 'bg-blue-100' : 'bg-yellow-100'
                    }`}>
                      <Globe className={`w-6 h-6 ${
                        request.admin_approved ? 'text-green-600' : 
                        request.status === 'rejected' ? 'text-red-600' :
                        request.status === 'processing' ? 'text-blue-600' : 'text-yellow-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {request.domain_name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span>{getStatusBadge(request)}</span>
                        <span>•</span>
                        <span>{request.store?.name}</span>
                        <span>•</span>
                        <span>{request.domain_type === 'new' ? 'New Domain' : 'Existing Domain'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        ₦{request.amount_paid.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(request.requested_at || request.created_at)}
                      </p>
                    </div>
                    {expandedId === request.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedId === request.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-200 bg-gray-50"
                  >
                    <div className="p-6 space-y-6">
                      {/* Store & Owner Info */}
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-orange-500" />
                            Store Information
                          </h4>
                          <div className="space-y-2 text-sm">
                            <p><span className="text-gray-500">Store Name:</span> <span className="font-medium">{request.store?.name}</span></p>
                            <p><span className="text-gray-500">Current Slug:</span> <span className="font-medium">{request.store?.slug}</span></p>
                            <p><span className="text-gray-500">Current Domain:</span> <span className="font-medium">{request.store?.custom_domain || 'None'}</span></p>
                            <p><span className="text-gray-500">Store Status:</span> <span className="font-medium capitalize">{request.store?.domain_status}</span></p>
                            <a 
                              href={`/my-site/${request.store?.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 mt-2"
                            >
                              View Store <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-orange-500" />
                            Owner Information
                          </h4>
                          <div className="space-y-2 text-sm">
                            <p><span className="text-gray-500">Name:</span> <span className="font-medium">{request.owner?.full_name}</span></p>
                            <p><span className="text-gray-500">Email:</span> <span className="font-medium">{request.owner?.email}</span></p>
                            <p><span className="text-gray-500">Phone:</span> <span className="font-medium">{request.owner?.phone || 'N/A'}</span></p>
                            <p><span className="text-gray-500">Payment Ref:</span> <span className="font-medium font-mono text-xs">{request.payment_reference}</span></p>
                            <p><span className="text-gray-500">Amount Paid:</span> <span className="font-medium">₦{request.amount_paid.toLocaleString()}</span></p>
                          </div>
                        </div>
                      </div>

                      {/* Admin Notes */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Admin Notes
                        </label>
                        <textarea
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="Add notes about this domain request..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none min-h-[80px]"
                        />
                        {request.admin_notes && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                            <span className="font-medium">Previous note:</span> {request.admin_notes}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {request.status !== 'completed' && request.status !== 'rejected' && (
                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={() => handleApprove(request)}
                            disabled={isProcessing}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Check className="w-4 h-4 mr-2" />
                            )}
                            Approve & Connect
                          </Button>

                          <Button
                            onClick={() => handleSetProcessing(request)}
                            disabled={isProcessing}
                            variant="outline"
                            className="border-blue-500 text-blue-600 hover:bg-blue-50"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Mark Processing
                          </Button>

                          <Button
                            onClick={() => handleReject(request)}
                            disabled={isProcessing}
                            variant="outline"
                            className="border-red-500 text-red-600 hover:bg-red-50"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      )}

                      {request.status === 'completed' && (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg">
                          <CheckCircle className="w-5 h-5" />
                          <span>This domain was approved on {request.approved_at ? formatDate(request.approved_at) : 'N/A'}</span>
                        </div>
                      )}

                      {request.status === 'rejected' && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-lg">
                          <XCircle className="w-5 h-5" />
                          <span>This domain request was rejected</span>
                        </div>
                      )}

                      {/* Change 3: Revert button — shown for any request with a connected domain */}
                      {request.store?.domain_status !== 'none' && (
                        <Button
                          onClick={() => handleRevert(request)}
                          disabled={isProcessing}
                          variant="outline"
                          className="border-gray-400 text-gray-600 hover:bg-gray-50"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Revert to Default URL
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}