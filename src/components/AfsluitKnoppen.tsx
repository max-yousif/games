import { useState } from 'react';
import { ga } from '../lib/route';
import { Button } from './ui';

/**
 * Na een spel: afsluiten (resultaten bewaren) of afsluiten zonder opslaan (resultaten wissen).
 * Bij een live spel worden de gegevens op de server in beide gevallen gewist.
 */
export function AfsluitKnoppen({ serverWissen, onBewaar, onVerwijder }: { serverWissen?: () => Promise<void>; onBewaar: () => void; onVerwijder: () => void }) {
  const [bezig, setBezig] = useState(false);

  async function wis() {
    try {
      await serverWissen?.();
    } catch {
      // Geen verbinding: de server wist de gegevens zelf na 2 dagen.
    }
  }

  async function afsluiten() {
    setBezig(true);
    await wis();
    onBewaar();
    ga({ pagina: 'start' });
  }

  async function zonderOpslaan() {
    if (!confirm('Afsluiten zonder opslaan? De resultaten van dit spel worden niet bewaard.')) return;
    setBezig(true);
    await wis();
    onVerwijder();
  }

  return (
    <>
      <Button variant="primary" disabled={bezig} onClick={() => void afsluiten()}>
        ✓ Afsluiten
      </Button>
      <Button variant="danger" disabled={bezig} onClick={() => void zonderOpslaan()}>
        Afsluiten zonder opslaan
      </Button>
    </>
  );
}
