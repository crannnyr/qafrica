import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StaffPlanGate() {
  return (
    <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
      <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="font-semibold text-gray-700 mb-1">Available on Growth & Enterprise</p>
      <p className="text-sm text-gray-500 mb-4 max-w-xs mx-auto">
        Upgrade to Growth to add up to 10 staff, or Enterprise for up to 20.
      </p>
      <Link to="/dashboard/subscription">
        <Button className="bg-orange-500 hover:bg-orange-600 text-white">
          Upgrade Plan
        </Button>
      </Link>
    </div>
  );
}
