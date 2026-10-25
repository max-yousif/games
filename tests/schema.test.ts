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
  `);
  await db.exec(SCHEMA);
  // Een tweede keer uitvoeren mag geen fouten geven.
  await db.exec(SCHEMA);

  const [s] = await als<{ id: string; code: string }>(
    LEERKRACHT,
    `insert into live_sessies (titel, namen, aantal_vragen, timer) values ('Test', array['Anna Peeters','Bert Claes','Chloé'], 3, 30) returning id, code`,
  );
  sessieId = s.id;
  code = s.code;
});

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
