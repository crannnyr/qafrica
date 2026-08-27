// A small set of distinct, selectable preset profile pictures. Each is a
// self-contained inline SVG (no external image files, nothing that can
// break/404) identified by a "preset://N" pseudo-URL stored directly in
// customers.avatar_url. Rendering code checks for that prefix and swaps in
// the matching design instead of treating it as a real image src.
import type { ReactNode } from 'react';

export const PRESET_AVATAR_COUNT = 8;

const GRADIENTS = [
  ['#F97316', '#FB923C'], // orange
  ['#0EA5E9', '#38BDF8'], // sky
  ['#8B5CF6', '#A78BFA'], // violet
  ['#EC4899', '#F472B6'], // pink
  ['#10B981', '#34D399'], // emerald
  ['#F59E0B', '#FBBF24'], // amber
  ['#6366F1', '#818CF8'], // indigo
  ['#EF4444', '#F87171'], // red
];

// Each preset pairs a gradient with a distinct simple shape so they're easy
// to tell apart at a glance, not just different colours.
function PresetShape({ index }: { index: number }) {
  const [from, to] = GRADIENTS[index % GRADIENTS.length];
  const gradId = `preset-grad-${index}`;
  const shapes: ReactNode[] = [
    <circle key="0" cx="50" cy="50" r="22" fill="white" fillOpacity="0.9" />,
    <rect key="1" x="28" y="28" width="44" height="44" rx="10" fill="white" fillOpacity="0.9" />,
    <polygon key="2" points="50,26 74,68 26,68" fill="white" fillOpacity="0.9" />,
    <path key="3" d="M50 26 L61 42 L79 42 L65 54 L70 72 L50 61 L30 72 L35 54 L21 42 L39 42 Z" fill="white" fillOpacity="0.9" />,
    <g key="4">
      <circle cx="38" cy="42" r="10" fill="white" fillOpacity="0.9" />
      <circle cx="62" cy="42" r="10" fill="white" fillOpacity="0.9" />
      <circle cx="50" cy="62" r="10" fill="white" fillOpacity="0.9" />
    </g>,
    <path key="5" d="M30 50 A20 20 0 1 1 70 50 A20 20 0 1 1 30 50 Z M42 50 A8 8 0 1 0 58 50 A8 8 0 1 0 42 50" fill="white" fillOpacity="0.9" fillRule="evenodd" />,
    <rect key="6" x="30" y="35" width="40" height="30" rx="15" fill="white" fillOpacity="0.9" />,
    <g key="7">
      <rect x="35" y="30" width="12" height="40" rx="6" fill="white" fillOpacity="0.9" />
      <rect x="53" y="30" width="12" height="40" rx="6" fill="white" fillOpacity="0.9" />
    </g>,
  ];

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gradId})`} />
      {shapes[index % shapes.length]}
    </svg>
  );
}

export function isPresetAvatar(avatarUrl?: string | null): number | null {
  if (!avatarUrl || !avatarUrl.startsWith('preset://')) return null;
  const n = parseInt(avatarUrl.replace('preset://', ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function presetAvatarUrl(index: number): string {
  return `preset://${index % PRESET_AVATAR_COUNT}`;
}

/** Renders whatever the customer currently has — a real uploaded photo, a
 * preset design, or nothing (caller should fall back to initials). */
export function AvatarImage({ avatarUrl, className }: { avatarUrl?: string | null; className?: string }) {
  const presetIndex = isPresetAvatar(avatarUrl);
  if (presetIndex !== null) {
    return <div className={className}><PresetShape index={presetIndex} /></div>;
  }
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={className} />;
  }
  return null;
}

export { PresetShape };
