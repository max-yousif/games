import { describe, expect, it } from 'vitest';
import { BackupError, bestandsnaam, leesBestand, maakBackup, setBestand, voegSamen } from '../src/lib/backup';
import { VOORBEELDSETS } from '../src/content/voorbeelden';

describe('back-up', () => {
  it('leest een volledige back-up en een losse set terug', () => {
    const b = maakBackup(VOORBEELDSETS, [{ id: 'k', naam: '3A', leerlingen: [] }], []);
    const terug = leesBestand(JSON.stringify(b));
    expect(terug.soort).toBe('backup');
    const set = leesBestand(JSON.stringify(setBestand(VOORBEELDSETS[1])));
    expect(set).toMatchObject({ soort: 'set', set: { id: VOORBEELDSETS[1].id } });
  });

  it('weigert andere bestanden', () => {
    expect(() => leesBestand('{"x":1}')).toThrow(BackupError);
    expect(() => leesBestand('geen json')).toThrow(BackupError);
  });

  it('voegt samen op id', () => {
    expect(voegSamen([{ id: '1', v: 'oud' }, { id: '2', v: 'b' }], [{ id: '1', v: 'nieuw' }])).toEqual([
      { id: '2', v: 'b' },
      { id: '1', v: 'nieuw' },
    ]);
  });

  it('maakt veilige bestandsnamen', () => {
    expect(bestandsnaam('Ontbinden: één & twee!', 'json')).toBe('ontbinden-een-twee.json');
  });
});
