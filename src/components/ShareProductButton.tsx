import { Share2, Link2 } from 'lucide-react';
import { toast } from 'sonner';

type ShareProductButtonProps = {
  title: string;
  description?: string | null;
  className?: string;
  compact?: boolean;
};

/**
 * Shares the canonical current product URL using the native share sheet where
 * available, and falls back to copying the URL to the clipboard.
 */
export default function ShareProductButton({
  title,
  description,
  className = '',
  compact = false,
}: ShareProductButtonProps) {
  const share = async () => {
    const url = window.location.href;
    const payload = {
      title,
      text: (description || '').replace(/\\s+/g, ' ').trim().slice(0, 240),
      url,
    };

    try {
      if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(payload))) {
        await navigator.share(payload);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Product link copied');
        return;
      }

      // Fallback for older browsers without the Clipboard API.
      const input = document.createElement('textarea');
      input.value = url;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      if (!copied) throw new Error('Copy command failed');
      toast.success('Product link copied');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error('Unable to share or copy this link. Please copy the page address.');
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share product"
      className={className || 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50'}
    >
      <Share2 className="h-4 w-4" aria-hidden="true" />
      {!compact && <span>Share</span>}
      <Link2 className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
    </button>
  );
}
