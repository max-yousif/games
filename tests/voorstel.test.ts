import { afterEach, describe, expect, it, vi } from 'vitest';

describe('testversie van een voorstel', () => {
  const p = Storage.prototype;
  const origineel = { getItem: p.getItem, setItem: p.setItem, removeItem: p.removeItem };
  afterEach(() => {
    Object.assign(p, origineel);
    vi.unstubAllEnvs();
    vi.resetModules();
    localStorage.clear();
  });

  it('werkt op een kopie van de opslag en laat de echte gegevens ongemoeid', async () => {
    localStorage.setItem('games.v1.klassen', '["echt"]');
    localStorage.setItem('ander', 'x');
    vi.stubEnv('VITE_VOORSTEL', '1');
    vi.resetModules();
    await import('../src/lib/voorstel');

    expect(localStorage.getItem('games.v1.klassen')).toBe('["echt"]');
    localStorage.setItem('games.v1.klassen', '["test"]');
    localStorage.removeItem('games.v1.sets');
    expect(localStorage.getItem('games.v1.klassen')).toBe('["test"]');
    expect(localStorage.getItem('ander')).toBe('x');

    Object.assign(p, origineel);
    expect(localStorage.getItem('games.v1.klassen')).toBe('["echt"]');
    expect(localStorage.getItem('voorstel.games.v1.klassen')).toBe('["test"]');
  });

  it('doet niets op de gewone site', async () => {
    vi.resetModules();
    const { VOORSTEL } = await import('../src/lib/voorstel');
    expect(VOORSTEL).toBe(false);
    localStorage.setItem('games.v1.thema', 'donker');
    expect(Object.keys(localStorage)).toContain('games.v1.thema');
  });
});
