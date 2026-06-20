// src/pages/dashboard/Layout/NavGroup.tsx

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NavItem, MarketplaceBrand } from './constants';

interface Props {
  item: NavItem;
  isActive: (path: string) => boolean;
  isSidebarOpen: boolean;
  onNavigate: () => void;
  onComingSoon: (brand: MarketplaceBrand) => void;
}

export default function NavGroup({
  item,
  isActive,
  isSidebarOpen,
  onNavigate,
  onComingSoon,
}: Props) {
  const groupActive =
    isActive(item.path) ||
    (item.children?.some((c) => isActive(c.path)) ?? false);

  const [isOpen, setIsOpen] = useState(() =>
    item.children?.some((c) => isActive(c.path)) ?? false,
  );

  useEffect(() => {
    if (!isSidebarOpen) setIsOpen(false);
  }, [isSidebarOpen]);

  // ── Leaf link (no children) ────────────────────────────────────────────────
  if (!item.children) {
    return (
      <Link
        to={item.path}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
          isActive(item.path)
            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-medium'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        } ${!isSidebarOpen ? 'lg:justify-center lg:px-2' : ''}`}
        title={!isSidebarOpen ? item.label : undefined}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${
          isActive(item.path) ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
        }`} />
        {isSidebarOpen && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  // ── Collapsed sidebar: show parent icon only ───────────────────────────────
  if (!isSidebarOpen) {
    return (
      <Link
        to={item.path}
        onClick={onNavigate}
        className={`flex items-center justify-center px-2 py-2.5 rounded-lg transition-all ${
          groupActive
            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
        title={item.label}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${
          groupActive ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
        }`} />
      </Link>
    );
  }

  // ── Expanded sidebar: collapsible group ────────────────────────────────────
  return (
    <div>
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
          groupActive
            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-medium'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${
          groupActive ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
        }`} />
        <span className="flex-1 text-left truncate">{item.label}</span>
        {isOpen
          ? <ChevronDown  className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        }
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{   height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="ml-4 mt-0.5 border-l border-gray-100 dark:border-gray-700 pl-3 space-y-0.5">
              {item.children.map((child) => {
                // ── Coming soon items ────────────────────────────────────────
                if (child.comingSoon) {
                  const brand = child.label.toLowerCase() as MarketplaceBrand;
                  return (
                    <button
                      key={child.path}
                      onClick={() => onComingSoon(brand)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all w-full text-left text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <child.icon className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                      <span className="truncate flex-1">{child.label}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400">
                        Soon
                      </span>
                    </button>
                  );
                }

                // ── Normal child link ────────────────────────────────────────
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive(child.path)
                        ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-medium'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <child.icon className={`w-4 h-4 flex-shrink-0 ${
                      isActive(child.path) ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
                    }`} />
                    <span className="truncate flex-1">{child.label}</span>
                    {child.badge ? (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex items-center justify-center">
                        {child.badge > 99 ? '99+' : child.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}