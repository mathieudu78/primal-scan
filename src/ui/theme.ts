/** PRIMAL SCAN — nature premium, mode sombre uniquement. */
export const colors = {
  bg: '#0B1510',          // vert forêt très profond
  surface: '#12211A',
  surfaceAlt: '#182A21',
  border: '#24392E',
  forest: '#1F4D3A',      // vert forêt
  green: '#5FA777',       // vert naturel
  greenSoft: '#8CCB9E',
  beige: '#D8C8A6',
  cream: '#F2ECDD',       // blanc cassé
  text: '#F2ECDD',
  textSoft: '#BDB6A5',    // gris chaud
  muted: '#8A8576',
  danger: '#D9705A',
  warn: '#E0B15A',
  overlay: 'rgba(8,14,11,0.72)',
};
export const radius = { sm: 14, md: 20, lg: 28, xl: 36, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const font = { regular: 'System', weight: { regular: '400', medium: '500', semibold: '600', bold: '700' } as const };

export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return colors.muted;
  return score >= 80 ? colors.green : score >= 60 ? colors.greenSoft : score >= 40 ? colors.beige : score >= 20 ? colors.warn : colors.danger;
}
