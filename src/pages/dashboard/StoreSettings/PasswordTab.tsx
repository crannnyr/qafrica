import { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores';
import { supabase } from '@/services';
import { toast } from 'sonner';

export default function PasswordTab() {
  const { user } = useAuthStore();

  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw,     setShowNewPw]     = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const pwRequirements = [
    { label: 'At least 8 characters',     met: passwordData.newPassword.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(passwordData.newPassword) },
    { label: 'Contains number',           met: /[0-9]/.test(passwordData.newPassword) },
    { label: 'Contains special character', met: /[!@#$%^&*]/.test(passwordData.newPassword) },
  ];
  const allPwMet = pwRequirements.every(r => r.met);

  const handleChangePassword = async () => {
    if (!user?.email) return;
    if (!passwordData.currentPassword) { toast.error('Enter your current password'); return; }
    if (!allPwMet) { toast.error('New password does not meet requirements'); return; }
    if (passwordData.newPassword !== passwordData.confirmPassword) { toast.error('Passwords do not match'); return; }

    setIsSaving(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: passwordData.currentPassword,
    });
    if (signInError) {
      toast.error('Current password is incorrect');
      setIsSaving(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: passwordData.newPassword });
    if (updateError) {
      toast.error(updateError.message || 'Failed to update password');
    } else {
      toast.success('Password updated successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

      await supabase.functions.invoke('send-email', {
        body: {
          to: user.email,
          subject: 'Your QAFRICA password was changed',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
                <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
              </div>
              <h2 style="color:#111827;margin:0 0 8px;">Password Changed</h2>
              <p style="color:#6B7280;margin:0 0 20px;">
                Hi ${user.full_name || 'there'}, your QAFRICA account password was just successfully updated.
              </p>
              <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;font-size:14px;color:#374151;">
                  <strong>If you did not make this change</strong>, your account may be compromised.
                  Please reset your password immediately or contact support.
                </p>
              </div>
              <a href="${window.location.origin}/forgot-password"
                 style="display:inline-block;background:#F97316;color:#fff;padding:12px 24px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
                Reset Password →
              </a>
              <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
                © ${new Date().getFullYear()} QAFRICA. If you made this change, you can safely ignore this email.
              </p>
            </div>
          `,
        },
      }).catch(() => {
        console.error('Failed to send password change email');
      });
    }
    setIsSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
          <Lock className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
          <p className="text-sm text-gray-500">You'll need your current password to make changes</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
          <div className="relative">
            <input
              type={showCurrentPw ? 'text' : 'password'}
              value={passwordData.currentPassword}
              onChange={e => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))}
              className="input-custom pr-12"
              placeholder="Enter current password"
            />
            <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
          <div className="relative">
            <input
              type={showNewPw ? 'text' : 'password'}
              value={passwordData.newPassword}
              onChange={e => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
              className="input-custom pr-12"
              placeholder="Create a strong password"
            />
            <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {passwordData.newPassword && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            {pwRequirements.map((req, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle className={`w-4 h-4 ${req.met ? 'text-green-500' : 'text-gray-300'}`} />
                <span className={`text-xs ${req.met ? 'text-green-600' : 'text-gray-500'}`}>{req.label}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirmPw ? 'text' : 'password'}
              value={passwordData.confirmPassword}
              onChange={e => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
              className="input-custom pr-12"
              placeholder="Confirm your new password"
            />
            <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleChangePassword}
          disabled={isSaving || !passwordData.currentPassword || !allPwMet || passwordData.newPassword !== passwordData.confirmPassword}
          className="bg-orange-500 hover:bg-orange-600 text-white px-8"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4 mr-2" />Update Password</>}
        </Button>
      </div>
    </div>
  );
}