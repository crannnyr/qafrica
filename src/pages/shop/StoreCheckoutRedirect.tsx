// Old per-store checkout URL (/:slug/checkout) -> unified checkout with that store's items.
import { Navigate, useParams } from 'react-router-dom';

export default function StoreCheckoutRedirect() {
  const { slug } = useParams();
  return <Navigate to={slug ? `/checkout?store=${encodeURIComponent(slug)}` : '/cart'} replace />;
}
