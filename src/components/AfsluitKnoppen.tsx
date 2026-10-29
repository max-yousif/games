import { useState } from 'react';
import { ga } from '../lib/route';
import { Button } from './ui';

/**
 * Na een spel: de resultaten bewaren (dan staan ze bij Resultaten en tellen ze mee in de statistiek)
 * of gewoon afsluiten (niets bewaard). Bij een live spel worden de gegevens op de server altijd gewist.
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

  async function bewaren() {
    setBezig(true);
    await wis();
    onBewaar();
    ga({ pagina: 'start' });
  }

  async function afsluiten() {
    setBezig(true);
    await wis();
    onVerwijder();
  }

  return (
    <>
      <Button variant="primary" disabled={bezig} onClick={() => void bewaren()}>
        💾 Resultaten bewaren
      </Button>
      <Button disabled={bezig} onClick={() => void afsluiten()}>
        Afsluiten (niet bewaren)
      </Button>
    </>
  );
}
