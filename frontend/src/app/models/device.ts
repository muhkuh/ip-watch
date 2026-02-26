/**
 * Represents one tracked device in IP Watch.
 */
export interface Device {
  id: string;
  name: string;
  type: 'PS5' | 'PC' | 'TV';
  ip: string;
  probeProtocol: 'http' | 'https' | null;
  probePort: number | null;
  statusSource: 'PING' | 'HTTP' | 'PING+HTTP' | 'UNKNOWN';
  isReachable: boolean;
  lastCheckedAt: string;
  pingReachable?: boolean | null;
  httpReachable?: boolean | null;
}

/**
 * Contains user input fields required to create a device entry.
 */
export interface CreateDeviceInput {
  name: string;
  type: 'PS5' | 'PC' | 'TV';
  ip: string;
  probeProtocol: 'http' | 'https' | null;
  probePort: number | null;
}
