/** Port of legacy config/diagnostics.php (native log tail dropped). */
export interface DiagnosticsConfig {
  /** Build-level master switch; recording also needs the user's opt-in. */
  enabled: boolean;
  recordingWindowMinutes: number;
  retentionDays: number;
  /** Ring buffer size. */
  maxEvents: number;
  /** Bytes of a failed upstream body kept as a snippet. */
  bodySnippetBytes: number;
  /** Cap for the material source viewer output. */
  materialSourceBytes: number;
}

export const defaultDiagnosticsConfig: DiagnosticsConfig = {
  enabled: true,
  recordingWindowMinutes: 30,
  retentionDays: 14,
  maxEvents: 500,
  bodySnippetBytes: 2048,
  materialSourceBytes: 204800,
};

/** Port of the connectivity URLs in legacy config/services.php + hungu.php. */
export interface ConnectivityUrls {
  hungu: string;
  schoolPortal: string;
  nouTools: string;
  iap: string;
  google: string;
  cloudflare: string;
  apple: string;
  /** Legacy `services.iap.timeout` (seconds); probes use min(5, this). */
  iapTimeoutSeconds: number;
}

export const defaultConnectivityUrls: ConnectivityUrls = {
  hungu: 'https://uu.nou.edu.tw',
  schoolPortal: 'https://nouapp.nou.edu.tw',
  nouTools: 'https://nou-tools.binota.org',
  iap: 'https://alt-uu.binota.org',
  google: 'https://www.google.com/generate_204',
  cloudflare: 'https://1.1.1.1/cdn-cgi/trace',
  apple: 'https://captive.apple.com/hotspot-detect.html',
  iapTimeoutSeconds: 10,
};
