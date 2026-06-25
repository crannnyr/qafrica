import { Users } from 'lucide-react';
import { useStaffData } from './useStaffData';
import StaffPlanGate from './StaffPlanGate';
import StaffInviteForm from './StaffInviteForm';
import StaffList from './StaffList';

interface Props {
  storeId: string;
  ownerId: string;
}

export default function StaffTab({ storeId, ownerId }: Props) {
  const {
    staffList, staffLimit, isLoading, mutatingId,
    activeCount, canInvite,
    invite, remove, resend, togglePermission,
  } = useStaffData(storeId, ownerId);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Manage Staff</h2>
            <p className="text-sm text-gray-500">Invite team members to help manage orders</p>
          </div>
        </div>
        {staffLimit > 0 && (
          <span className="text-xs font-medium bg-violet-50 text-violet-700 px-3 py-1.5 rounded-full border border-violet-100">
            {activeCount} / {staffLimit} used
          </span>
        )}
      </div>

      {staffLimit === 0 ? (
        <StaffPlanGate />
      ) : (
        <>
          <StaffInviteForm canInvite={canInvite} staffLimit={staffLimit} onInvite={invite} />
          <StaffList
            staffList={staffList}
            isLoading={isLoading}
            mutatingId={mutatingId}
            onRemove={remove}
            onResend={resend}
            onTogglePermission={togglePermission}
          />
        </>
      )}
    </div>
  );
}
