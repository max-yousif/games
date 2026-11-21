import { beforeEach, describe, expect, it } from 'vitest';
import { bewaarInstellingen, INSTELLINGEN, leesInstellingen, zuiver } from '../src/lib/instellingen';

describe('instellingen per spel en klas', () => {
  beforeEach(() => localStorage.clear());

  it('niets bewaard: leeg', () => {
    expect(leesInstellingen('live', 'k1')).toEqual({});
  });

  it('per spel en klas apart', () => {
    bewaarInstellingen('live', 'k1', { timer: 60, willekeurig: true });
    bewaarInstellingen('live', 'k2', { timer: 90 });
    bewaarInstellingen('escape', 'k1', { escapeMinuten: 45 });
    expect(leesInstellingen('live', 'k1')).toEqual({ timer: 60, willekeurig: true });
    expect(leesInstellingen('live', 'k2')).toEqual({ timer: 90 });
    expect(leesInstellingen('escape', 'k1')).toEqual({ escapeMinuten: 45 });
  });

  it('nieuwe klas: de laatst gebruikte van dat spel', () => {
    bewaarInstellingen('quizbord', 'k1', { aantal: 4 });
    bewaarInstellingen('quizbord', 'k2', { aantal: 3 });
    expect(leesInstellingen('quizbord', 'k9')).toEqual({ aantal: 3 });
    expect(leesInstellingen('quizbord', 'k1')).toEqual({ aantal: 4 });
    expect(leesInstellingen('bom', 'k1')).toEqual({});
  });

  it('zonder klas en geen limiet (null) worden onthouden', () => {
    bewaarInstellingen('escape', '', { escapeMinuten: null, timer: null });
    expect(leesInstellingen('escape', '')).toEqual({ escapeMinuten: null, timer: null });
  });

  it('onbekende of verkeerde waarden vallen weg', () => {
    expect(zuiver({ timer: 'x', aantal: -1, harten: 3, basissen: ['abs', 2], naam: 'Jan', dubbel: false })).toEqual({ harten: 3, dubbel: false });
    expect(zuiver(null)).toEqual({});
  });

  it('beschadigde opslag geeft geen fout', () => {
    localStorage.setItem(INSTELLINGEN, '{kapot');
    expect(leesInstellingen('live', 'k1')).toEqual({});
    bewaarInstellingen('live', 'k1', { timer: 30 });
    expect(leesInstellingen('live', 'k1')).toEqual({ timer: 30 });
  });
});
