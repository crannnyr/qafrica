export const naira = (n: number | null | undefined) => `₦${Math.round(Number(n) || 0).toLocaleString('en-NG')}`;
