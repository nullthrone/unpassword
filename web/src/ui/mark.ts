import markSmall from '../../../design/unpassword/mark-small.svg?raw';

/** The unpassword mark as inline SVG (fills with currentColor). Parsed from our own bundled asset. */
export function mark(size: number): SVGSVGElement {
  const doc = new DOMParser().parseFromString(markSmall, 'image/svg+xml');
  const svg = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.removeAttribute('role');
  svg.removeAttribute('aria-label');
  return svg;
}
