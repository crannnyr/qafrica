// src/components/developer/PaystackConnectButton.tsx
import { useState } from 'react';
import { ExternalLink, Check, Loader2, AlertTriangle } from 'lucide-react';
import { developerPaystackService } from '@/services/developer';
import { useDeveloperAuthStore }    from '@/stores/developerAuthStore';
import { toast } from 'sonner';

interface PaystackConnectButtonProps {
  // Where to resume after OAuth callback — stored in sessionStorage
  returnContext?: 'onboarding' | 'settings';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PaystackConnectButton({
  returnContext = 'settings',
  size = 'md',
  className = '',
}: PaystackConnectButtonProps) {
  const { developer } = useDeveloperAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const isConnected = developer?.paystack_connected ?? false;

  const heightCls = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-11 px-5 text-sm',
    lg: 'h-12 px-6 text-base',
  }[size];

  async function handleConnect() {
    setIsLoading(true);
    try {
      const { connect_url } = await developerPaystackService.getConnectUrl();
      sessionStorage.setItem('dev_paystack_from', returnContext);
      window.location.href = connect_url;
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to start Paystack Connect. Please try again.');
      setIsLoading(false);
    }
  }

  if (isConnected) {
    return (
      <div className={`inline-flex items-center gap-2 ${heightCls} font-semibold
        bg-green-50 border border-green-200 text-green-700 rounded-xl ${className}`}
      >
        <Check className="w-4 h-4" />
        Paystack connected
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 ${heightCls} font-semibold
        bg-[#01C6C6] hover:bg-[#00b3b3] text-white rounded-xl transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <ExternalLink className="w-4 h-4" />
          Connect Paystack account
        </>
      )}
    </button>
  );
}

export default PaystackConnectButton;