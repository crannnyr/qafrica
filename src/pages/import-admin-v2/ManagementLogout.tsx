import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader } from 'lucide-react';
import { logoutManagementSession } from './ManagementAuth';

export default function ManagementLogout() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const logout = async () => {
      await logoutManagementSession();
      if (!cancelled) setDone(true);
    };

    void logout();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-7 text-center">
        <div className="w-12 h-12 mx-auto bg-orange-50 rounded-xl flex items-center justify-center mb-4">
          {done ? <CheckCircle2 className="w-6 h-6 text-orange-500" /> : <Loader className="w-6 h-6 text-orange-500 animate-spin" />}
        </div>
        <h1 className="font-bold text-gray-900 text-lg">{done ? 'You have been logged out' : 'Signing you out…'}</h1>
        <p className="text-sm text-gray-500 mt-2">
          {done ? 'Your Management session has been ended.' : 'Ending your Management session securely.'}
        </p>
        {done && (
          <button
            onClick={() => navigate('/import-admin-v2/login', { replace: true })}
            className="mt-6 w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"
          >
            Sign in again
          </button>
        )}
      </div>
    </div>
  );
}
