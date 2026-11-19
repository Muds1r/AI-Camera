import { parseClaimAmount, parseOvertimeHours } from './claims';
import { HttpError } from './http';

describe('parseClaimAmount', () => {
  it('accepts positive amounts', () => {
    expect(parseClaimAmount(100)).toBe(100);
    expect(parseClaimAmount('250.5')).toBe(250.5);
  });

  it('rejects zero, negative, and invalid values', () => {
    expect(() => parseClaimAmount(0)).toThrow(HttpError);
    expect(() => parseClaimAmount(-1)).toThrow(HttpError);
    expect(() => parseClaimAmount('')).toThrow(HttpError);
    expect(() => parseClaimAmount(Number.NaN)).toThrow(HttpError);
  });
});

describe('parseOvertimeHours', () => {
  it('accepts hours in range', () => {
    expect(parseOvertimeHours(2)).toBe(2);
    expect(parseOvertimeHours('0.5')).toBe(0.5);
  });

  it('rejects out of range', () => {
    expect(() => parseOvertimeHours(0)).toThrow(HttpError);
    expect(() => parseOvertimeHours(-1)).toThrow(HttpError);
    expect(() => parseOvertimeHours(13)).toThrow(HttpError);
  });
});
