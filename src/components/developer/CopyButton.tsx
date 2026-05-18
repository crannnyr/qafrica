// src/components/developer/CopyButton.tsx
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CopyButtonProps {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  silent?: boolean;       // if true, no toast on copy
  label?: string;         // optional visible label next to icon
  className?: string;
}

export function CopyButton({
  text,
  size = 'md',
  silent = false,
  label,
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (!silent) toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy. Please copy manually.');
    }
  }

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  const padSize = {
    sm: 'p-1 rounded-md',
    md: 'p-1.5 rounded-lg',
    lg: 'p-2 rounded-xl',
  }[size];

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      className={`inline-flex items-center gap-1.5 transition-colors
        ${copied
          ? 'text-green-500'
          : 'text-gray-400 hover:text-gray-700'
        }
        ${!label ? padSize : 'px-2.5 py-1.5 rounded-lg hover:bg-gray-100'}
        ${className}`}
    >
      {copied
        ? <Check className={iconSize} />
        : <Copy className={iconSize} />
      }
      {label && (
        <span className={`font-medium ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {copied ? 'Copied' : label}
        </span>
      )}
    </button>
  );
}

export default CopyButton;