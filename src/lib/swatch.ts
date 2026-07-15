// Generates rich, deterministic SVG "fabric swatch" data-URIs so every product
// image renders instantly with no network dependency.

interface SwatchInput {
  id: string;
  primary: string;
  secondary: string;
  accent: string;
  name: string;
  weave: 'satin' | 'brocade' | 'ikat' | 'jamdani' | 'tie-dye' | 'plain' | 'twill' | 'kalamkari' | 'kanjivaram';
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const weavePattern = (input: SwatchInput, size: number): string => {
  const { weave, primary, secondary, accent, id } = input;
  const dot = `<circle r="0.6" fill="${accent}" opacity="0.55"/>`;

  switch (weave) {
    case 'satin':
      return `
        <pattern id="p-${id}" patternUnits="userSpaceOnUse" width="14" height="14">
          <rect width="14" height="14" fill="${primary}"/>
          <path d="M0 14 L14 0" stroke="${secondary}" stroke-width="1.4" opacity="0.55"/>
          <path d="M-2 4 L4 -2" stroke="${secondary}" stroke-width="0.6" opacity="0.4"/>
          <path d="M10 16 L16 10" stroke="${secondary}" stroke-width="0.6" opacity="0.4"/>
        </pattern>`;
    case 'brocade':
      return `
        <pattern id="p-${id}" patternUnits="userSpaceOnUse" width="36" height="36">
          <rect width="36" height="36" fill="${primary}"/>
          <path d="M18 3 C 26 10 26 26 18 33 C 10 26 10 10 18 3 Z" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.7"/>
          <circle cx="18" cy="18" r="2.5" fill="${accent}" opacity="0.85"/>
          <circle cx="0" cy="0" r="1.4" fill="${accent}" opacity="0.6"/>
          <circle cx="36" cy="36" r="1.4" fill="${accent}" opacity="0.6"/>
        </pattern>`;
    case 'ikat':
      return `
        <pattern id="p-${id}" patternUnits="userSpaceOnUse" width="22" height="22">
          <rect width="22" height="22" fill="${primary}"/>
          <path d="M0 11 Q5 6 11 11 T22 11" stroke="${secondary}" stroke-width="2" fill="none" opacity="0.7"/>
          <path d="M0 4 Q5 0 11 4 T22 4" stroke="${accent}" stroke-width="1" fill="none" opacity="0.6"/>
          <path d="M0 18 Q5 14 11 18 T22 18" stroke="${accent}" stroke-width="1" fill="none" opacity="0.6"/>
        </pattern>`;
    case 'jamdani':
      return `
        <pattern id="p-${id}" patternUnits="userSpaceOnUse" width="20" height="20">
          <rect width="20" height="20" fill="${primary}"/>
          <g transform="translate(10 10)">${dot}</g>
          <g transform="translate(0 0)">${dot}</g>
          <g transform="translate(20 20)">${dot}</g>
          <path d="M5 10 Q10 4 15 10" stroke="${accent}" stroke-width="0.8" fill="none" opacity="0.5"/>
        </pattern>`;
    case 'tie-dye':
      return `
        <pattern id="p-${id}" patternUnits="userSpaceOnUse" width="28" height="28">
          <rect width="28" height="28" fill="${primary}"/>
          <circle cx="14" cy="14" r="6" fill="none" stroke="${secondary}" stroke-width="1" opacity="0.55"/>
          <circle cx="14" cy="14" r="3" fill="${accent}" opacity="0.8"/>
          <circle cx="0" cy="0" r="2" fill="${accent}" opacity="0.6"/>
          <circle cx="28" cy="28" r="2" fill="${accent}" opacity="0.6"/>
        </pattern>`;
    case 'twill':
      return `
        <pattern id="p-${id}" patternUnits="userSpaceOnUse" width="10" height="10">
          <rect width="10" height="10" fill="${primary}"/>
          <path d="M-2 12 L12 -2" stroke="${secondary}" stroke-width="1.6" opacity="0.6"/>
          <path d="M-2 6 L6 -2" stroke="${secondary}" stroke-width="0.5" opacity="0.4"/>
        </pattern>`;
    case 'kalamkari':
      return `
        <pattern id="p-${id}" patternUnits="userSpaceOnUse" width="40" height="40">
          <rect width="40" height="40" fill="${primary}"/>
          <path d="M20 6 C 30 14 30 26 20 34 C 10 26 10 14 20 6 Z" fill="${accent}" opacity="0.18"/>
          <path d="M20 10 Q 26 20 20 30 Q 14 20 20 10 Z" fill="none" stroke="${accent}" stroke-width="1" opacity="0.7"/>
          <circle cx="20" cy="20" r="1.5" fill="${secondary}" opacity="0.8"/>
        </pattern>`;
    case 'kanjivaram':
      return `
        <pattern id="p-${id}" patternUnits="userSpaceOnUse" width="32" height="32">
          <rect width="32" height="32" fill="${primary}"/>
          <rect x="0" y="0" width="32" height="6" fill="${accent}" opacity="0.55"/>
          <rect x="0" y="26" width="32" height="6" fill="${accent}" opacity="0.55"/>
          <path d="M4 16 L16 6 L28 16 L16 26 Z" fill="none" stroke="${secondary}" stroke-width="1" opacity="0.6"/>
        </pattern>`;
    case 'plain':
    default:
      return `
        <pattern id="p-${id}" patternUnits="userSpaceOnUse" width="6" height="6">
          <rect width="6" height="6" fill="${primary}"/>
          <path d="M0 3 H6" stroke="${secondary}" stroke-width="0.4" opacity="0.4"/>
          <path d="M3 0 V6" stroke="${secondary}" stroke-width="0.4" opacity="0.4"/>
        </pattern>`;
  }
};

export const fabricSwatch = (input: SwatchInput, width = 800, height = 1000): string => {
  const pattern = weavePattern(input, width);
  const name = escapeXml(input.name);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice">
  <defs>
    ${pattern}
    <linearGradient id="vignette-${input.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.25"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#p-${input.id})"/>
  <rect width="100%" height="100%" fill="url(#vignette-${input.id})"/>
  <g fill="#FFF" font-family="Georgia, 'Cormorant Garamond', serif">
    <text x="40" y="${height - 40}" font-size="44" font-style="italic">${name}</text>
  </g>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
