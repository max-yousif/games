/** Grootte van een coverafbeelding (16:9), klein genoeg voor de browseropslag en de cloud. */
const BREEDTE = 800;
const HOOGTE = 450;

export class CoverFout extends Error {}

/**
 * Leest een afbeelding en maakt er een cover van: bijgesneden tot 16:9, verkleind tot 800 × 450
 * en bewaard als JPEG (data-URL van enkele tientallen kB).
 */
export async function maakCover(bestand: File): Promise<string> {
  if (!bestand.type.startsWith('image/')) throw new CoverFout('Kies een afbeelding (jpg, png, webp …).');
  let beeld: ImageBitmap;
  try {
    beeld = await createImageBitmap(bestand);
  } catch {
    throw new CoverFout('Deze afbeelding kon niet gelezen worden.');
  }
  // Midden van de afbeelding in 16:9.
  const doel = BREEDTE / HOOGTE;
  const bron = beeld.width / beeld.height;
  const sw = bron > doel ? beeld.height * doel : beeld.width;
  const sh = bron > doel ? beeld.height : beeld.width / doel;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(BREEDTE, Math.round(sw));
  canvas.height = Math.round(canvas.width / doel);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new CoverFout('Deze browser kan de afbeelding niet verwerken.');
  ctx.drawImage(beeld, (beeld.width - sw) / 2, (beeld.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  beeld.close();
  return canvas.toDataURL('image/jpeg', 0.75);
}
