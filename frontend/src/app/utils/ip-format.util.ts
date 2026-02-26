/**
 * Normalizes user input into grouped IPv4 style blocks (up to 12 digits).
 */
export function formatIpv4Input(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, '').slice(0, 12);
  const groups: string[] = [];

  for (let i = 0; i < digitsOnly.length; i += 3) {
    groups.push(digitsOnly.slice(i, i + 3));
  }

  return groups.join('.');
}
