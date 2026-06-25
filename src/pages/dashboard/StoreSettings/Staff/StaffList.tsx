import { Loader2, Users } from 'lucide-react';
import type { StoreStaff } from '@/types';
import type { PermissionKey } from './permissions';
import StaffListItem from './StaffListItem';

interface Props {
  staffList: StoreStaff[];
  isLoading: boolean;
  mutatingId: string | null;
  onRemove: (id: string) => void;
  onResend: (id: string) => void;
  onTogglePermission: (id: string, permission: PermissionKey, value: boolean) => void;
}

export default function StaffList({ staffList, isLoading, mutatingId, onRemove, onResend, onTogglePermission }: Props) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (staffList.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
        <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No staff invited yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {staffList.map(staff => (
        <StaffListItem
          key={staff.id}
          staff={staff}
          isMutating={mutatingId === staff.id}
          onRemove={onRemove}
          onResend={onResend}
          onTogglePermission={onTogglePermission}
        />
      ))}
    </div>
  );
}
