// src/pages/dashboard/Layout/NotificationDropdown.tsx

import { Bell, TriangleAlert as AlertTriangle } from 'lucide-react';
import type { StockAlert } from '@/types';

interface Props {
  stockAlerts: StockAlert[];
  isOpen: boolean;
  onToggle: () => void;
  onMarkRead: (alertId: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationDropdown({
  stockAlerts,
  isOpen,
  onToggle,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={onToggle}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {stockAlerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {stockAlerts.length > 9 ? '9+' : stockAlerts.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={onToggle}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Notifications
              </h3>
              {stockAlerts.length > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {stockAlerts.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No new notifications
                  </p>
                </div>
              ) : (
                stockAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => onMarkRead(alert.id)}
                    className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        alert.alert_type === 'out_of_stock'
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : 'bg-yellow-100 dark:bg-yellow-900/30'
                      }`}>
                        <AlertTriangle className={`w-4 h-4 ${
                          alert.alert_type === 'out_of_stock'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {alert.alert_type === 'out_of_stock'
                            ? 'Out of Stock'
                            : 'Low Stock Alert'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {alert.product?.name}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}