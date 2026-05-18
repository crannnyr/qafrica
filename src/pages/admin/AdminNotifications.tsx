import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Plus, Trash2, Eye, EyeOff, Loader2,
  Users, Store, X, Check, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

interface ModalNotification {
  id: string;
  title: string;
  body: string;
  target_type: 'all' | 'specific';
  target_store_ids: string[] | null;
  is_active: boolean;
  created_at: string;
}

interface StoreOption {
  id: string;
  name: string;
  owner_id: string;
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<ModalNotification[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [storeSearch, setStoreSearch] = useState('');

  useEffect(() => {
    loadNotifications();
    loadStores();
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('modal_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setNotifications(data as ModalNotification[]);
    setIsLoading(false);
  };

  const loadStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name, owner_id')
      .eq('is_active', true)
      .order('name');
    if (data) setStores(data as StoreOption[]);
  };

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!body.trim())  { toast.error('Message body is required'); return; }
    if (targetType === 'specific' && selectedStoreIds.length === 0) {
      toast.error('Select at least one store'); return;
    }

    setIsCreating(true);
    const { data: adminData } = await supabase.auth.getUser();

    const { error } = await supabase.from('modal_notifications').insert({
      title:            title.trim(),
      body:             body.trim(),
      target_type:      targetType,
      target_store_ids: targetType === 'specific' ? selectedStoreIds : null,
      is_active:        true,
      created_by:       adminData.user?.id ?? null,
    });

    if (error) {
      toast.error('Failed to create notification');
    } else {
      toast.success('Notification pushed successfully!');
      setTitle('');
      setBody('');
      setTargetType('all');
      setSelectedStoreIds([]);
      setShowForm(false);
      await loadNotifications();
    }
    setIsCreating(false);
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('modal_notifications')
      .update({ is_active: !currentState, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update notification');
    } else {
      toast.success(currentState ? 'Notification deactivated' : 'Notification activated');
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_active: !currentState } : n)
      );
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('modal_notifications')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete notification');
    } else {
      toast.success('Notification deleted');
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const toggleStoreSelection = (storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const filteredStores = stores.filter(s =>
    s.name.toLowerCase().includes(storeSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modal Notifications</h1>
          <p className="text-gray-500 mt-1">Push pop-up announcements to store owners</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Notification
        </Button>
      </div>

      {/* Create Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                {/* Form Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Bell className="w-5 h-5 text-orange-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Create Notification</h2>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notification Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Platform Maintenance Tonight"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>

                  {/* Body — Rich Text via contentEditable */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message Body * <span className="text-gray-400 font-normal">(supports HTML — use &lt;a href="..."&gt; for links, &lt;b&gt; for bold)</span>
                    </label>
                    <textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      placeholder={`e.g. We'll be down for maintenance from 2am–4am WAT.\n\nFollow us for updates: <a href="https://instagram.com/qafrica" target="_blank">@qafrica</a>`}
                      rows={6}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      HTML is rendered in the modal. Plain text also works fine.
                    </p>
                  </div>

                  {/* Preview */}
                  {(title || body) && (
                    <div className="border border-orange-200 rounded-xl p-4 bg-orange-50">
                      <p className="text-xs font-semibold text-orange-600 uppercase mb-2">Preview</p>
                      {title && <p className="font-bold text-gray-900 mb-2">{title}</p>}
                      {body && (
                        <div
                          className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: body }}
                        />
                      )}
                    </div>
                  )}

                  {/* Target */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Send To
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setTargetType('all')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          targetType === 'all'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Users className="w-5 h-5 text-orange-500 mb-1" />
                        <p className="font-semibold text-gray-900 text-sm">All Stores</p>
                        <p className="text-xs text-gray-500">Every active store owner</p>
                      </button>
                      <button
                        onClick={() => setTargetType('specific')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          targetType === 'specific'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Store className="w-5 h-5 text-orange-500 mb-1" />
                        <p className="font-semibold text-gray-900 text-sm">Specific Stores</p>
                        <p className="text-xs text-gray-500">Choose individual stores</p>
                      </button>
                    </div>
                  </div>

                  {/* Store picker */}
                  {targetType === 'specific' && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="p-3 border-b bg-gray-50">
                        <input
                          type="text"
                          value={storeSearch}
                          onChange={e => setStoreSearch(e.target.value)}
                          placeholder="Search stores..."
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                        {selectedStoreIds.length > 0 && (
                          <p className="text-xs text-orange-600 mt-2 font-medium">
                            {selectedStoreIds.length} store{selectedStoreIds.length > 1 ? 's' : ''} selected
                          </p>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                        {filteredStores.map(store => (
                          <label
                            key={store.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedStoreIds.includes(store.id)}
                              onChange={() => toggleStoreSelection(store.id)}
                              className="w-4 h-4 accent-orange-500"
                            />
                            <span className="text-sm text-gray-800 font-medium">{store.name}</span>
                          </label>
                        ))}
                        {filteredStores.length === 0 && (
                          <p className="text-center text-gray-400 text-sm py-6">No stores found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {isCreating
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><Bell className="w-4 h-4 mr-2" />Push Notification</>
                    }
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No notifications created yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-xl border p-5 ${
                n.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-900">{n.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      n.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {n.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      {n.target_type === 'all'
                        ? 'All stores'
                        : `${n.target_store_ids?.length ?? 0} store${(n.target_store_ids?.length ?? 0) !== 1 ? 's' : ''}`
                      }
                    </span>
                  </div>
                  <div
                    className="text-sm text-gray-600 line-clamp-2 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: n.body }}
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Created {new Date(n.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(n.id, n.is_active)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                    title={n.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {n.is_active
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}