// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import SCHEMA from '../supabase/schema.sql?raw';

/*
 * Test het Supabase-schema op een echte Postgres (PGlite) met een nagebootste Supabase-omgeving:
 * de rollen anon/authenticated en auth.uid() via request.jwt.claim.sub.
 */

const LEERKRACHT = '00000000-0000-0000-0000-00000000000a';
const ANNA = '00000000-0000-0000-0000-0000000000a1';
const BERT = '00000000-0000-0000-0000-0000000000b1';
const VREEMDE = '00000000-0000-0000-0000-0000000000f1';
const COLLEGA = '00000000-0000-0000-0000-0000000000c1';

let db: PGlite;

/** Voert SQL uit als een aangemelde gebruiker (zoals PostgREST dat doet). */
async function als<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role;');
  }
}

async function fout(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'geen fout';
  } catch (e) {
    return (e as Error).message;
  }
}

let sessieId = '';
let code = '';

// PGlite opstarten duurt op een drukke CI-runner soms langer dan de standaard 10 s.
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    grant usage on schema public to authenticated, anon;
    create table auth.users (id uuid primary key);
    insert into auth.users (id) values
      ('${LEERKRACHT}'), ('${ANNA}'), ('${BERT}'), ('${VREEMDE}'), ('${COLLEGA}');
  `);
  await db.exec(SCHEMA);
  // Leerkrachten toevoegen zoals in supabase/README.md.
  await db.exec(`insert into public.leerkrachten (uid, naam) values ('${LEERKRACHT}', 'maxyousif'), ('${COLLEGA}', 'collega')`);
  // Een tweede keer uitvoeren mag geen fouten geven.
  await db.exec(SCHEMA);

  const [s] = await als<{ id: string; code: string }>(
    LEERKRACHT,
    `insert into live_sessies (titel, namen, aantal_vragen, timer) values ('Test', array['Anna Peeters','Bert Claes','Chloé'], 3, 30) returning id, code`,
  );
  sessieId = s.id;
  code = s.code;
}, 60_000);

describe('supabase-schema', () => {
  it('maakt een code van 6 tekens zonder verwarrende letters', () => {
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('toont vrije namen en laat leerlingen aansluiten', async () => {
    const [info] = await als<{ vrije_namen: string[]; titel: string }>(ANNA, 'select * from live_sessie_info($1)', [code.toLowerCase()]);
    expect(info.titel).toBe('Test');
    expect(info.vrije_namen).toEqual(['Anna Peeters', 'Bert Claes', 'Chloé']);

    const [d] = await als<{ naam: string }>(ANNA, 'select * from live_deelnemen($1, $2)', [code, ' Anna   Peeters ']);
    expect(d.naam).toBe('Anna Peeters');
    await als(BERT, 'select * from live_deelnemen($1, $2)', [code, 'Bert Claes']);

    const [info2] = await als<{ vrije_namen: string[] }>(BERT, 'select * from live_sessie_info($1)', [code]);
    expect(info2.vrije_namen).toEqual(['Bert Claes', 'Chloé']);
  });

  it('weigert bezette, onbekende en verzonnen namen', async () => {
    expect(await fout(als(VREEMDE, 'select * from live_deelnemen($1, $2)', [code, 'Anna Peeters']))).toContain('naam_bezet');
    expect(await fout(als(VREEMDE, 'select * from live_deelnemen($1, $2)', [code, 'Mickey Mouse']))).toContain('ongeldige_naam');
    expect(await fout(als(VREEMDE, 'select * from live_deelnemen($1, $2)', ['ZZZZZZ', 'Chloé']))).toContain('onbekende_code');
  });

  it('opnieuw aansluiten geeft dezelfde speler terug', async () => {
    const a = await als<{ speler_id: string }>(ANNA, 'select * from live_deelnemen($1, $2)', [code, 'Anna Peeters']);
    const b = await als<{ speler_id: string }>(ANNA, 'select * from live_deelnemen($1, $2)', [code, 'Anna Peeters']);
    expect(a[0].speler_id).toBe(b[0].speler_id);
  });

  it('laat geen antwoord toe als er geen vraag loopt', async () => {
    expect(await fout(als(ANNA, 'select live_antwoord($1, 0, $2)', [sessieId, '1']))).toContain('geen_vraag');
  });

  it('enkel de leerkracht kan een vraag starten', async () => {
    expect(await fout(als(ANNA, `select live_start_vraag($1, 0, '{"tekst":"x"}')`, [sessieId]))).toContain('geen_host');
    await als(LEERKRACHT, `select live_start_vraag($1, 0, '{"tekst":"Hoeveel is 2+2?","type":"meerkeuze","opties":["3","4"]}')`, [sessieId]);
    const [s] = await als<{ status: string; vraag_nr: number }>(ANNA, 'select status, vraag_nr from live_sessies where id = $1', [sessieId]);
    expect(s).toEqual({ status: 'vraag', vraag_nr: 0 });
  });

  it('één antwoord per vraag, met tijd van de server', async () => {
    await als(ANNA, 'select live_antwoord($1, 0, $2)', [sessieId, '1']);
    expect(await fout(als(ANNA, 'select live_antwoord($1, 0, $2)', [sessieId, '0']))).toContain('al_geantwoord');
    expect(await fout(als(ANNA, 'select live_antwoord($1, 1, $2)', [sessieId, '0']))).toContain('geen_vraag');
    expect(await fout(als(VREEMDE, 'select live_antwoord($1, 0, $2)', [sessieId, '0']))).toContain('geen_speler');
    await als(BERT, 'select live_antwoord($1, 0, $2)', [sessieId, '0']);
    const rijen = await als<{ tijd_ms: number }>(LEERKRACHT, 'select tijd_ms from live_antwoorden where sessie_id = $1', [sessieId]);
    expect(rijen).toHaveLength(2);
    expect(rijen.every((r) => r.tijd_ms >= 0)).toBe(true);
  });

  it('weigert antwoorden na de timer', async () => {
    await als(LEERKRACHT, `select live_start_vraag($1, 1, '{"tekst":"y"}')`, [sessieId]);
    await db.exec(`update live_sessies set vraag_start = now() - interval '40 seconds' where id = '${sessieId}'`);
    expect(await fout(als(ANNA, 'select live_antwoord($1, 1, $2)', [sessieId, 'x']))).toContain('te_laat');
  });

  it('leerlingen zien enkel hun eigen antwoorden en niet de andere spelers', async () => {
    const antwoorden = await als<{ antwoord: string }>(ANNA, 'select antwoord from live_antwoorden');
    expect(antwoorden).toEqual([{ antwoord: '1' }]);
    const spelers = await als<{ naam: string }>(ANNA, 'select naam from live_spelers');
    expect(spelers).toEqual([{ naam: 'Anna Peeters' }]);
    expect(await als(LEERKRACHT, 'select naam from live_spelers where sessie_id = $1', [sessieId])).toHaveLength(2);
  });

  it('buitenstaanders zien niets en leerlingen kunnen niets wijzigen', async () => {
    expect(await als(VREEMDE, 'select * from live_sessies')).toEqual([]);
    expect(await als(VREEMDE, 'select * from live_antwoorden')).toEqual([]);
    await als(ANNA, `update live_sessies set titel = 'gehackt' where id = $1`, [sessieId]);
    await als(ANNA, `update live_antwoorden set juist = true, punten = 999`);
    const [s] = await als<{ titel: string }>(LEERKRACHT, 'select titel from live_sessies where id = $1', [sessieId]);
    expect(s.titel).toBe('Test');
    const punten = await als<{ punten: number }>(LEERKRACHT, 'select punten from live_antwoorden where sessie_id = $1', [sessieId]);
    expect(punten.every((p) => p.punten === 0)).toBe(true);
    expect(await fout(als(ANNA, `insert into live_antwoorden (sessie_id, speler_id, vraag_nr, antwoord, tijd_ms) select $1, id, 5, 'x', 0 from live_spelers`, [sessieId]))).not.toBe('geen fout');
  });

  it('de leerkracht beoordeelt antwoorden', async () => {
    const rijen = await als<{ id: string; antwoord: string }>(LEERKRACHT, 'select id, antwoord from live_antwoorden where sessie_id = $1', [sessieId]);
    const items = rijen.map((r) => ({ id: r.id, juist: r.antwoord === '1', punten: r.antwoord === '1' ? 100 : 0 }));
    expect(await fout(als(ANNA, 'select live_beoordeel($1, $2)', [sessieId, JSON.stringify(items)]))).toContain('geen_host');
    await als(LEERKRACHT, 'select live_beoordeel($1, $2)', [sessieId, JSON.stringify(items)]);
    const [eigen] = await als<{ juist: boolean; punten: number }>(ANNA, 'select juist, punten from live_antwoorden');
    expect(eigen).toEqual({ juist: true, punten: 100 });
  });

  it('losgekoppelde leerling kan zich opnieuw aanmelden op een andere laptop', async () => {
    await als(LEERKRACHT, `update live_spelers set uid = null where naam = 'Anna Peeters'`);
    const [d] = await als<{ naam: string }>(VREEMDE, 'select * from live_deelnemen($1, $2)', [code, 'Anna Peeters']);
    expect(d.naam).toBe('Anna Peeters');
    // De antwoorden van Anna blijven bij haar.
    expect(await als(VREEMDE, 'select antwoord from live_antwoorden')).toEqual([{ antwoord: '1' }]);
  });

  it('wist oude sessies bij het aanmaken van een nieuwe', async () => {
    await db.exec(`update live_sessies set aangemaakt = now() - interval '3 days' where id = '${sessieId}'`);
    await als(LEERKRACHT, `insert into live_sessies (titel) values ('Nieuw')`);
    const over = await als<{ titel: string }>(LEERKRACHT, 'select titel from live_sessies');
    expect(over).toEqual([{ titel: 'Nieuw' }]);
    expect((await db.query('select count(*)::int as n from live_antwoorden')).rows).toEqual([{ n: 0 }]);
  });
});

describe('supabase-schema: escape room', () => {
  let id = '';
  let escCode = '';

  it('laat pas antwoorden toe als de escape room gestart is', async () => {
    const [s] = await als<{ id: string; code: string }>(
      LEERKRACHT,
      `insert into live_sessies (titel, modus, vrije_naam, aantal_vragen, wachttijd, vragen) values ('Escape', 'escape', true, 2, 30, '[]') returning id, code`,
    );
    id = s.id;
    escCode = s.code;
    await als(ANNA, 'select * from live_deelnemen($1, $2)', [escCode, 'Anna']);
    expect(await fout(als(ANNA, 'select live_antwoord($1, 0, $2)', [id, 'x']))).toContain('geen_vraag');
    expect(await fout(als(ANNA, 'select live_start_escape($1)', [id]))).toContain('geen_host');
    await als(LEERKRACHT, 'select live_start_escape($1)', [id]);
  });

  it('meerdere pogingen per slot, met wachttijd na een fout', async () => {
    await als(ANNA, 'select live_antwoord($1, 1, $2)', [id, 'fout']);
    // Nog niet beoordeeld: wachten.
    expect(await fout(als(ANNA, 'select live_antwoord($1, 1, $2)', [id, 'nog eens']))).toContain('wacht');
    // Andere sloten kunnen wel.
    await als(ANNA, 'select live_antwoord($1, 0, $2)', [id, 'juist']);
    expect(await fout(als(ANNA, 'select live_antwoord($1, 2, $2)', [id, 'x']))).toContain('geen_vraag');

    const rijen = await als<{ id: string; vraag_nr: number }>(LEERKRACHT, 'select id, vraag_nr from live_antwoorden where sessie_id = $1', [id]);
    const items = rijen.map((r) => ({ id: r.id, juist: r.vraag_nr === 0, punten: 0, beloning: r.vraag_nr === 0 ? '7' : null }));
    await als(LEERKRACHT, 'select live_beoordeel($1, $2)', [id, JSON.stringify(items)]);

    // Fout beoordeeld, maar de wachttijd (30 s) loopt nog.
    expect(await fout(als(ANNA, 'select live_antwoord($1, 1, $2)', [id, 'nog eens']))).toContain('wacht');
    await db.exec(`update live_antwoorden set aangemaakt = now() - interval '31 seconds' where sessie_id = '${id}'`);
    await als(ANNA, 'select live_antwoord($1, 1, $2)', [id, 'nog eens']);
    const pogingen = await als<{ poging: number }>(ANNA, 'select poging from live_antwoorden where vraag_nr = 1 order by poging');
    expect(pogingen.map((p) => p.poging)).toEqual([1, 2]);

    // Opgelost slot: niet opnieuw. De leerling ziet het verdiende cijfer.
    expect(await fout(als(ANNA, 'select live_antwoord($1, 0, $2)', [id, 'x']))).toContain('al_opgelost');
    const [b] = await als<{ beloning: string }>(ANNA, 'select beloning from live_antwoorden where vraag_nr = 0');
    expect(b.beloning).toBe('7');
  });

  it('de eindcode is slot -1', async () => {
    await als(ANNA, 'select live_antwoord($1, -1, $2)', [id, '1234']);
    expect((await als(LEERKRACHT, 'select vraag_nr from live_antwoorden where sessie_id = $1 and vraag_nr = -1', [id])).length).toBe(1);
  });

  it('weigert antwoorden na de totale tijd', async () => {
    await db.exec(`update live_sessies set timer = 60, vraag_start = now() - interval '70 seconds' where id = '${id}'`);
    await db.exec(`update live_antwoorden set aangemaakt = now() - interval '1 hour', juist = false where sessie_id = '${id}' and juist is null`);
    expect(await fout(als(ANNA, 'select live_antwoord($1, 1, $2)', [id, 'x']))).toContain('te_laat');
  });
});

describe('supabase-schema: bijnaam, verlaten en ping', () => {
  let id = '';
  let c = '';
  const DRIES = '00000000-0000-0000-0000-0000000000d1';

  it('bijnaam instellen, maar niet de naam van een klasgenoot', async () => {
    const [s] = await als<{ id: string; code: string }>(
      LEERKRACHT,
      `insert into live_sessies (titel, namen, aantal_vragen) values ('B', array['Anna Peeters','Bert Claes','Dries Mertens'], 1) returning id, code`,
    );
    id = s.id;
    c = s.code;
    await als(ANNA, 'select * from live_deelnemen($1, $2)', [c, 'Anna Peeters']);
    await als(BERT, 'select * from live_deelnemen($1, $2)', [c, 'Bert Claes']);
    const [r] = await als<{ live_bijnaam: string }>(ANNA, 'select live_bijnaam($1, $2)', [id, '  De   Rekenkoningin ']);
    expect(r.live_bijnaam).toBe('De Rekenkoningin');
    // Naam van een klasgenoot (ook als die nog niet aangemeld is) of bijnaam van een ander: geweigerd.
    expect(await fout(als(BERT, 'select live_bijnaam($1, $2)', [id, 'dries mertens']))).toContain('bijnaam_bezet');
    expect(await fout(als(BERT, 'select live_bijnaam($1, $2)', [id, 'de rekenkoningin']))).toContain('bijnaam_bezet');
    // Eigen echte naam als bijnaam mag; leeg = wissen.
    await als(BERT, 'select live_bijnaam($1, $2)', [id, 'Bert Claes']);
    await als(BERT, 'select live_bijnaam($1, $2)', [id, '   ']);
    const rijen = await als<{ naam: string; bijnaam: string | null }>(LEERKRACHT, 'select naam, bijnaam from live_spelers where sessie_id = $1 order by naam', [id]);
    expect(rijen).toEqual([
      { naam: 'Anna Peeters', bijnaam: 'De Rekenkoningin' },
      { naam: 'Bert Claes', bijnaam: null },
    ]);
    expect(await fout(als(DRIES, 'select live_bijnaam($1, $2)', [id, 'x']))).toContain('geen_speler');
  });

  it('verlaten geeft de naam vrij; terugkeren behoudt antwoorden en bijnaam', async () => {
    await als(LEERKRACHT, `select live_start_vraag($1, 0, '{"tekst":"x"}')`, [id]);
    await als(ANNA, 'select live_antwoord($1, 0, $2)', [id, '1']);
    await als(ANNA, 'select live_verlaten($1)', [id]);
    expect(await als(ANNA, 'select * from live_sessies where id = $1', [id])).toEqual([]);
    const [info] = await als<{ vrije_namen: string[] }>(DRIES, 'select * from live_sessie_info($1)', [c]);
    expect(info.vrije_namen).toContain('Anna Peeters');
    await als(ANNA, 'select * from live_deelnemen($1, $2)', [c, 'Anna Peeters']);
    expect(await als(ANNA, 'select antwoord from live_antwoorden where sessie_id = $1', [id])).toEqual([{ antwoord: '1' }]);
    const [p] = await als<{ bijnaam: string }>(ANNA, 'select bijnaam from live_spelers where sessie_id = $1', [id]);
    expect(p.bijnaam).toBe('De Rekenkoningin');
  });

  it('ping werkt zonder aanmelden', async () => {
    await db.exec(`reset role; set role anon;`);
    try {
      const r = await db.query('select live_ping() is not null as ok');
      expect(r.rows).toEqual([{ ok: true }]);
    } finally {
      await db.exec('reset role;');
    }
  });
});

describe('supabase-schema: leerkrachten en cloudopslag', () => {
  it('enkel een leerkracht kan een live spel starten', async () => {
    expect(await fout(als(ANNA, `insert into live_sessies (titel) values ('Stiekem')`))).toContain('row-level security');
    const [s] = await als<{ id: string }>(LEERKRACHT, `insert into live_sessies (titel) values ('Echt') returning id`);
    expect(s.id).toBeTruthy();
    expect(await als<{ live_is_leerkracht: boolean }>(ANNA, 'select live_is_leerkracht()')).toEqual([{ live_is_leerkracht: false }]);
  });

  it('een leerkracht ziet en wijzigt enkel de eigen items, met tijd van de server', async () => {
    await als(LEERKRACHT, `insert into leerkracht_items (soort, id, data) values ('klas', 'k1', '{"naam":"3A"}'), ('set', 's1', '{"titel":"Algebra"}')`);
    await als(COLLEGA, `insert into leerkracht_items (soort, id, data) values ('klas', 'k1', '{"naam":"5B"}')`);
    const eigen = await als<{ id: string; data: { naam?: string } }>(LEERKRACHT, `select id, data from leerkracht_items where soort = 'klas'`);
    expect(eigen).toEqual([{ id: 'k1', data: { naam: '3A' } }]);

    // Iemand anders kan niets lezen of wijzigen, ook geen leerling.
    await als(COLLEGA, `update leerkracht_items set data = '{"naam":"gehackt"}' where eigenaar = '${LEERKRACHT}'`);
    expect((await als<{ data: { naam: string } }>(LEERKRACHT, `select data from leerkracht_items where id = 'k1'`))[0].data.naam).toBe('3A');
    expect(await als(ANNA, 'select * from leerkracht_items')).toEqual([]);
    expect(await fout(als(ANNA, `insert into leerkracht_items (soort, id, data) values ('klas', 'x', '{}')`))).toContain('row-level security');
    expect(await fout(als(LEERKRACHT, `insert into leerkracht_items (eigenaar, soort, id, data) values ('${COLLEGA}', 'klas', 'x', '{}')`))).toContain('row-level security');

    // Bijwerken (upsert) zet een nieuwere servertijd; wissen onthoudt het item als verwijderd.
    const [voor] = await als<{ bijgewerkt: string }>(LEERKRACHT, `select bijgewerkt from leerkracht_items where id = 'k1'`);
    await als(
      LEERKRACHT,
      `insert into leerkracht_items (eigenaar, soort, id, data, verwijderd, bijgewerkt) values ($1, 'klas', 'k1', null, true, '2000-01-01')
       on conflict (eigenaar, soort, id) do update set data = excluded.data, verwijderd = excluded.verwijderd`,
      [LEERKRACHT],
    );
    const [na] = await als<{ bijgewerkt: string; verwijderd: boolean }>(LEERKRACHT, `select bijgewerkt, verwijderd from leerkracht_items where id = 'k1'`);
    expect(na.verwijderd).toBe(true);
    expect(new Date(na.bijgewerkt).getTime()).toBeGreaterThan(new Date(voor.bijgewerkt).getTime());
  });

  it('een leerkracht ziet enkel de eigen rij in leerkrachten', async () => {
    expect(await als(LEERKRACHT, 'select naam from leerkrachten')).toEqual([{ naam: 'maxyousif' }]);
    expect(await als(ANNA, 'select naam from leerkrachten')).toEqual([]);
  });
});
