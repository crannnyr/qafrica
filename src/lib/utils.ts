import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Short, rounded-down "sold" count for product listings — never shows an
// exact figure. 20 -> "20+", 200 -> "200+", 1000 -> "1k+", 12400 -> "12k+",
// 100000 -> "100k+", 1200000 -> "1.2m+".
export function formatSoldCount(count: number): string {
  if (count < 1000) {
    const rounded = Math.floor(count / 10) * 10 || count;
    return `${rounded}+`;
  }
  if (count < 1_000_000) {
    const thousands = count / 1000;
    const label = thousands >= 10 ? Math.floor(thousands) : Math.floor(thousands * 10) / 10;
    return `${label}k+`;
  }
  const millions = count / 1_000_000;
  const label = millions >= 10 ? Math.floor(millions) : Math.floor(millions * 10) / 10;
  return `${label}m+`;
}
