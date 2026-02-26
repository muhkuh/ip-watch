import { formatIpv4Input } from './ip-format.util';

describe('formatIpv4Input', () => {
  it('groups digits into 3-char blocks', () => {
    expect(formatIpv4Input('19216801630')).toBe('192.168.016.30');
  });

  it('removes non-digit input', () => {
    expect(formatIpv4Input('192a.168b.0c.30')).toBe('192.168.030');
  });

  it('limits output to 12 digits total', () => {
    expect(formatIpv4Input('123456789012999')).toBe('123.456.789.012');
  });
});
