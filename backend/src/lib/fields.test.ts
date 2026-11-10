import { HttpError } from './http';
import { assertPersonName, optionalDateOfBirth, optionalPhone } from './fields';

describe('account field checks', () => {
  it('accepts a letter-only name and rejects digits', () => {
    expect(assertPersonName('Mudasir Ali')).toBe('Mudasir Ali');
    expect(() => assertPersonName('Ali 2')).toThrow(HttpError);
    expect(() => assertPersonName('A')).toThrow(HttpError);
  });

  it('keeps phone numbers to 10–12 digits', () => {
    expect(optionalPhone('03001234567')).toBe('03001234567');
    expect(optionalPhone('923001234567')).toBe('923001234567');
    expect(() => optionalPhone('0300abc4567')).toThrow(HttpError);
    expect(() => optionalPhone('1234567890123')).toThrow(HttpError);
    expect(() => optionalPhone('+923001234567')).toThrow(HttpError);
  });

  it('rejects a date of birth outside working age', () => {
    expect(optionalDateOfBirth('1994-04-12')).toBeInstanceOf(Date);
    expect(() => optionalDateOfBirth('2018-01-01')).toThrow(HttpError);
    expect(() => optionalDateOfBirth('not-a-date')).toThrow(HttpError);
  });
});
