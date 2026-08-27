// Deterministic fallback avatar for any customer/user without a real
// uploaded photo — same person always gets the same colour, so it looks
// like an intentional assigned avatar rather than a broken image, without
// needing any external image assets.
const FALLBACK_COLORS = [
  '#F97316', '#0EA5E9', '#8B5CF6', '#EC4899',
  '#10B981', '#F59E0B', '#6366F1', '#EF4444',
];

export function fallbackAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function initialsFrom(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
