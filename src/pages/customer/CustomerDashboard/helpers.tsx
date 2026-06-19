import { CheckCircle, Truck, Clock, Package } from 'lucide-react';

export const STATUS_STYLES: Record<string, string> = {
  delivered:  'bg-green-50 text-green-700 border-green-200',
  completed:  'bg-green-50 text-green-700 border-green-200',
  shipped:    'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-purple-50 text-purple-700 border-purple-200',
  confirmed:  'bg-sky-50 text-sky-700 border-sky-200',
  pending:    'bg-orange-50 text-orange-700 border-orange-200',
  cancelled:  'bg-red-50 text-red-700 border-red-200',
};

export const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'delivered' || status === 'completed') return <CheckCircle className="w-3.5 h-3.5" />;
  if (status === 'shipped') return <Truck className="w-3.5 h-3.5" />;
  if (status === 'pending') return <Clock className="w-3.5 h-3.5" />;
  return <Package className="w-3.5 h-3.5" />;
};
