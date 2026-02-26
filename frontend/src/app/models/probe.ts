/**
 * Represents a normalized status payload entry from the Raspberry Pi probe API.
 */
export interface ProbeStatus {
  ip: string;
  isReachable: boolean;
  statusSource: 'PING' | 'HTTP' | 'PING+HTTP' | 'UNKNOWN';
  lastCheckedAt: string;
  pingReachable: boolean | null;
  httpReachable: boolean | null;
}
