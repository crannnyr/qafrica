// src/pages/import-admin/ImportAdminLogin.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Eye, EyeOff, Loader } from 'lucide-react';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/china-import`;

export default function ImportAdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Invalid credentials');
        return;
      }
      // Persist token and manager info
      sessionStorage.setItem('import_manager_token', data.token);
      sessionStorage.setItem('import_manager', JSON.stringify(data.manager));
      navigate('/importations/admin');
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-black text-gray-900 leading-none">QAFRICA</p>
            <p className="text-xs text-gray-400 leading-none">Import Manager</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h1 className="font-bold text-gray-900 text-xl mb-1">Sign in</h1>
          <p className="text-gray-400 text-sm mb-6">Import admin access only</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="import@qafrica.store"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs font-medium bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
