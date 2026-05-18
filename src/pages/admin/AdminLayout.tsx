import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, Store, Package, ShoppingCart, 
  CreditCard, Crown, LogOut, Menu, X, Shield, Globe,
  ChevronLeft, User, Bell, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Users, label: 'Users', path: '/admin/users' },
  { icon: Store, label: 'Stores', path: '/admin/stores' },
  { icon: Package, label: 'Products', path: '/admin/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/admin/orders' },
  { icon: CreditCard, label: 'Withdrawals', path: '/admin/withdrawals' },
  { icon: Crown, label: 'Subscriptions', path: '/admin/subscriptions' },
  { icon: Globe, label: 'Domain Requests', path: '/admin/domain-requests' },
  { icon: Bell, label: 'Notifications', path: '/admin/notifications' },
  { icon: FileText, label: 'Legal Docs', path: '/admin/legal' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Fixed/Sticky with proper overflow handling */}
      <aside
        className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 bg-gray-900 text-white flex flex-col h-screen transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isSidebarOpen ? 'w-[280px]' : 'w-0 lg:w-20'}`}
      >
        {/* Logo Header - Fixed */}
        <div className={`p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0 ${!isSidebarOpen && 'lg:justify-center'}`}>
          <Link to="/admin" className={`flex items-center gap-3 ${!isSidebarOpen && 'lg:hidden'}`}>
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="overflow-hidden">
              <span className="text-lg font-bold">QAFRICA</span>
              <p className="text-xs text-gray-400">Admin Panel</p>
            </div>
          </Link>
          
          {/* Collapsed Logo Icon only */}
          <div className={`hidden ${isSidebarOpen ? 'hidden' : 'lg:flex'} items-center justify-center`}>
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
          
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation - Scrollable (icons only when collapsed) */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar min-h-0">
          {sidebarItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive(item.path)
                  ? 'bg-orange-500 text-white font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              } ${!isSidebarOpen && 'lg:justify-center lg:px-2'}`}
              title={!isSidebarOpen ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className={`${!isSidebarOpen && 'lg:hidden'} truncate`}>{item.label}</span>
              {/* Show notification dot for pending domains */}
              {item.path === '/admin/domain-requests' && isSidebarOpen && (
                <span className="ml-auto w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </Link>
          ))}
        </nav>

        {/* User Section - Fixed at bottom */}
        <div className={`p-4 border-t border-gray-800 flex-shrink-0 ${!isSidebarOpen && 'lg:px-2'}`}>
          <div className={`flex items-center gap-3 mb-3 ${!isSidebarOpen && 'lg:hidden'}`}>
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          
          {/* Collapsed User Icon */}
          <div className={`hidden ${!isSidebarOpen ? 'lg:flex' : 'hidden'} justify-center mb-3`}>
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-400" />
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 w-full px-4 py-2 text-red-400 hover:bg-gray-800 rounded-lg transition-colors ${!isSidebarOpen && 'lg:justify-center lg:px-2'}`}
            title="Logout"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={`${!isSidebarOpen && 'lg:hidden'}`}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header - Fixed */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-30">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <Menu className="w-6 h-6" />
              </button>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="hidden lg:flex p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <h1 className="text-lg font-semibold text-gray-900">
                {sidebarItems.find((item) => isActive(item.path))?.label || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  <Store className="w-4 h-4 mr-2" />
                  Seller Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}