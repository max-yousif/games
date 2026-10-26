import { describe, expect, it } from 'vitest';
import { naUpload, teUploaden, vast, verwerkDownload, type Lokaal, type ServerItem } from '../src/lib/cloudSync';
import type { Klas, Vragenset } from '../src/lib/types';

const klas = (id: string, naam: string): Klas => ({ id, naam, leerlingen: [] });
const set = (id: string, titel: string, gewijzigd: string): Vragenset => ({ id, titel, beschrijving: '', vak: 'wiskunde', leerjaar: '', vragen: [], aangemaakt: '', gewijzigd });
const leeg: Lokaal = { sets: [], klassen: [], sessies: [] };
const item = (soort: ServerItem['soort'], id: string, data: unknown, verwijderd = false): ServerItem => ({ soort, id, data, verwijderd, bijgewerkt: '2026-10-26T10:00:00Z' });

describe('cloud: synchroniseren', () => {
  it('vast() negeert de volgorde van sleutels (zoals jsonb)', () => {
    expect(vast({ b: 1, a: { d: 2, c: 3 } })).toBe(vast({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('uploadt nieuwe en gewijzigde items en wist wat lokaal weg is', () => {
    const l: Lokaal = { ...leeg, klassen: [klas('k1', '3A'), klas('k2', '4B')] };
    let gesync = naUpload({}, teUploaden(l, {}));
    expect(teUploaden(l, gesync)).toEqual({ bewaren: [], wissen: [] });

    const l2: Lokaal = { ...leeg, klassen: [{ ...klas('k1', '3A'), naam: '3A wiskunde' }] };
    const u = teUploaden(l2, gesync);
    expect(u.bewaren.map((b) => b.id)).toEqual(['k1']);
    expect(u.wissen).toEqual([{ soort: 'klas', id: 'k2' }]);
    gesync = naUpload(gesync, u);
    expect(Object.keys(gesync)).toEqual(['klas:k1']);
  });

  it('neemt wijzigingen van een ander toestel over, maar behoudt lokale wijzigingen', () => {
    const l: Lokaal = { ...leeg, klassen: [klas('k1', '3A'), klas('k2', '4B')] };
    const gesync = naUpload({}, teUploaden(l, {}));
    // Lokaal k2 gewijzigd; op het andere toestel k1 en k2 gewijzigd, k3 nieuw.
    const lokaal: Lokaal = { ...l, klassen: [klas('k1', '3A'), klas('k2', '4B lokaal')] };
    const r = verwerkDownload(lokaal, [item('klas', 'k1', klas('k1', '3A ander')), item('klas', 'k2', klas('k2', '4B ander')), item('klas', 'k3', klas('k3', '5C'))], gesync);
    expect(r.lokaal.klassen.map((k) => k.naam)).toEqual(['3A ander', '4B lokaal', '5C']);
    // k2 blijft lokaal gewijzigd en wordt dus bij de volgende upload bewaard.
    expect(teUploaden(r.lokaal, r.gesync).bewaren.map((b) => b.id)).toEqual(['k2']);
  });

  it('wist een item dat op een ander toestel gewist werd', () => {
    const l: Lokaal = { ...leeg, klassen: [klas('k1', '3A')] };
    const gesync = naUpload({}, teUploaden(l, {}));
    const r = verwerkDownload(l, [item('klas', 'k1', null, true)], gesync);
    expect(r.lokaal.klassen).toEqual([]);
    expect(r.gesync).toEqual({});
  });

  it('eerste keer op een toestel: alles samenvoegen, bij sets wint de recentste', () => {
    const lokaal: Lokaal = { ...leeg, sets: [set('s1', 'Lokaal nieuwer', '2026-10-26'), set('s2', 'Lokaal ouder', '2026-10-01')], klassen: [klas('k9', 'Enkel hier')] };
    const r = verwerkDownload(lokaal, [item('set', 's1', set('s1', 'Server ouder', '2026-10-20')), item('set', 's2', set('s2', 'Server nieuwer', '2026-10-25'))], {});
    expect(r.lokaal.sets.map((s) => s.titel)).toEqual(['Lokaal nieuwer', 'Server nieuwer']);
    // Wat enkel op dit toestel staat (of lokaal recenter is), gaat naar de cloud.
    expect(teUploaden(r.lokaal, r.gesync).bewaren.map((b) => b.id).sort()).toEqual(['k9', 's1']);
  });

  it('de eigen upload die terugkomt, verandert niets', () => {
    const l: Lokaal = { ...leeg, klassen: [klas('k1', '3A')] };
    const gesync = naUpload({}, teUploaden(l, {}));
    const r = verwerkDownload(l, [item('klas', 'k1', JSON.parse(vast(l.klassen[0])))], gesync);
    expect(r.gewijzigd).toBe(false);
  });
});

describe('cloud: lokaal gewist', () => {
  it('haalt een lokaal gewist item niet terug van de server', () => {
    const l: Lokaal = { ...leeg, sets: [set('s1', 'Machten', '2026-10-26T09:00:00Z')] };
    const gesync = naUpload({}, teUploaden(l, {}));
    // De set is lokaal gewist; de server heeft nog de oude versie.
    const r = verwerkDownload(leeg, [item('set', 's1', l.sets[0])], gesync);
    expect(r.lokaal.sets).toEqual([]);
    expect(teUploaden(r.lokaal, r.gesync).wissen).toEqual([{ soort: 'set', id: 's1' }]);
  });

  it('haalt het wel terug als het intussen elders gewijzigd werd', () => {
    const l: Lokaal = { ...leeg, sets: [set('s1', 'Machten', '2026-10-26T09:00:00Z')] };
    const gesync = naUpload({}, teUploaden(l, {}));
    const r = verwerkDownload(leeg, [item('set', 's1', set('s1', 'Machten (aangepast)', '2026-10-26T09:30:00Z'))], gesync);
    expect(r.lokaal.sets.map((s) => s.titel)).toEqual(['Machten (aangepast)']);
  });
});
