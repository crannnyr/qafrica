// Real preset profile picture options a customer can pick from. These are
// genuine hosted images (not a pseudo-scheme), so selecting one just sets
// customers.avatar_url directly to the URL — every existing <img src=avatar_url>
// render across the app already works with no special-casing needed.
export const PRESET_AVATARS: string[] = [
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.8145734988973625.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.9001497358352043.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.8945594956494954.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.7246698179533435.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.2037867735344615.webp',
];

export function isPresetAvatar(avatarUrl?: string | null): boolean {
  return !!avatarUrl && PRESET_AVATARS.includes(avatarUrl);
}

/** Renders whatever the customer currently has — real uploaded photo or a
 * chosen preset, both are just plain URLs. Caller falls back to initials
 * when this renders nothing (no avatar_url set at all). */
export function AvatarImage({ avatarUrl, className }: { avatarUrl?: string | null; className?: string }) {
  if (!avatarUrl) return null;
  return <img src={avatarUrl} alt="" className={className} />;
}
