import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabase';
import { useAuthStore, useStoreStore } from '@/stores';

export default function ModalNotificationDisplay() {
  const { user } = useAuthStore();
  const { currentStore } = useStoreStore();
  const [notification, setNotification] = useState<{
    id: string; title: string; body: string;
  } | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (user?.id && currentStore?.id) {
      checkForNotifications();
    }
  }, [user?.id, currentStore?.id]);

  const checkForNotifications = async () => {
    if (!user?.id || !currentStore?.id) return;

    // Fetch all active notifications targeted at this store (all or specific)
    const { data: notifications } = await supabase
      .from('modal_notifications')
      .select('id, title, body, target_type, target_store_ids')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!notifications?.length) return;

    // Filter to ones relevant to this store
    const relevant = notifications.filter(n =>
      n.target_type === 'all' ||
      (n.target_store_ids && n.target_store_ids.includes(currentStore.id))
    );

    if (!relevant.length) return;

    // Check which ones this user has already dismissed
    const relevantIds = relevant.map(n => n.id);
    const { data: dismissals } = await supabase
      .from('modal_notification_dismissals')
      .select('notification_id')
      .eq('user_id', user.id)
      .in('notification_id', relevantIds);

    const dismissedIds = new Set(dismissals?.map(d => d.notification_id) ?? []);

    // Show the first un-dismissed notification
    const unseen = relevant.find(n => !dismissedIds.has(n.id));
    if (unseen) {
      setNotification({ id: unseen.id, title: unseen.title, body: unseen.body });
    }
  };

  const handleDismiss = async () => {
    if (!notification || !user?.id || isDismissing) return;
    setIsDismissing(true);

    try {
      // Record dismissal so it never shows again for this user
      await supabase.from('modal_notification_dismissals').insert({
        notification_id: notification.id,
        user_id: user.id,
      });
    } catch {
      // Even if DB write fails, close the modal for this session
    } finally {
      setNotification(null);
      setIsDismissing(false);
    }
  };

  return (
    <AnimatePresence>
      {notification && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-gray-100">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-0.5">
                  Platform Notice
                </p>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">
                  {notification.title}
                </h3>
              </div>
              <button
                onClick={handleDismiss}
                className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              <div
                className="text-gray-700 leading-relaxed prose prose-sm max-w-none
                  prose-a:text-orange-500 prose-a:no-underline hover:prose-a:underline"
                dangerouslySetInnerHTML={{ __html: notification.body }}
              />
            </div>

            {/* Footer */}
            <div className="px-5 pb-5">
              <Button
                onClick={handleDismiss}
                disabled={isDismissing}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                Got it
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}