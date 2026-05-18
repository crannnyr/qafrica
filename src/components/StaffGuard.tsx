import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';

export default function StaffGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (user?.role === 'staff') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}