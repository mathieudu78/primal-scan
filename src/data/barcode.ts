/** Valide EAN-13 / EAN-8 / UPC-A (12) / UPC-E ne sont pas résolus ici. */
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code)) return false;
  const digits = code.split('').map(Number), check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

/** Normalise vers un EAN-13 (UPC-A -> 0 + code) pour interroger Open Food Facts. */
export function normalizeGtin(code: string): string {
  const c = code.replace(/\D/g, '');
  return c.length === 12 ? '0' + c : c;
}

/**
 * Extrait un code-barres produit depuis le contenu d'un QR code (URL ou texte).
 * Retourne undefined si aucun GTIN valide n'y figure — on ne devine jamais.
 */
export function barcodeFromQr(content: string): string | undefined {
  const candidates = content.match(/\d{8,14}/g) ?? [];
  return candidates.find(isValidGtin);
}
