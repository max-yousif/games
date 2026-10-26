import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** QR-code voor een link, als afbeelding (altijd zwart op wit, ook in donkere modus). */
export function QrCode({ tekst, className = '' }: { tekst: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let actief = true;
    QRCode.toDataURL(tekst, { width: 512, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => actief && setSrc(url))
      .catch(() => actief && setSrc(null));
    return () => {
      actief = false;
    };
  }, [tekst]);
  if (!src) return null;
  return <img src={src} alt="QR-code om mee te doen" className={`rounded-2xl bg-white ${className}`} />;
}
