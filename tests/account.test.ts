import { describe, expect, it } from 'vitest';
import { naarEmail } from '../src/lib/account';

describe('naarEmail', () => {
  it('maakt van een gebruikersnaam een e-mailadres', () => {
    expect(naarEmail(' MaxYousif ')).toBe('maxyousif@klasspelen.local');
  });
  it('laat een echt e-mailadres staan', () => {
    expect(naarEmail('Juf@School.be')).toBe('juf@school.be');
  });
});
