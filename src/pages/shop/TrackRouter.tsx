// /track is shared: store orders (?order=QAF-...) vs China-import tracking (everything else).
import { lazy } from 'react';
import { useSearchParams } from 'react-router-dom';

const OrderTrackingPage = lazy(() => import('./OrderTrackingPage'));
const ImportTrackingPage = lazy(() => import('@/pages/recommendations/ImportTrackingPage'));

export default function TrackRouter() {
  const [params] = useSearchParams();
  return params.has('order') ? <OrderTrackingPage /> : <ImportTrackingPage />;
}
