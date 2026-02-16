// ─── Vendor avatar helpers ──────────────────────────────────────────────────
const VENDOR_PALETTE = [ '#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#2c3e50', '#6b2d5b', '#1b4332', '#b8860b', '#3d405b',
] /** Deterministic palette slot from vendor name (same name → same colour, always). */
function vendorPaletteIndex(name: string): number {
return name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % VENDOR_PALETTE.length
} /** * Up to 2 initials, skipping filler words. * "The Craft Brew Co." → "CC" | "Lagos Spirits" → "LS" */
function getInitials(name: string): string {;
const skip = new Set(['the', 'a', 'an']);
const words = name .replace(/[^a-zA-Z\s]/g, '') .split(/\s+/) .filter(w => w && !skip.has(w.toLowerCase()));
if (!words.length);
return name.charAt(0).toUpperCase();
return words.slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')
}
export { vendorPaletteIndex, getInitials, VENDOR_PALETTE
}
