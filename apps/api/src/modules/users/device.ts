import { UAParser } from 'ua-parser-js';

const OS_NAMES: Record<string, string> = {
  'Mac OS': 'macOS',
  macOS: 'macOS',
  'Chromium OS': 'ChromeOS',
  'Chrome OS': 'ChromeOS',
};

/**
 * "Chrome on macOS", "Safari on iPhone", "Firefox on Windows". On iOS the device model (iPhone,
 * iPad) reads better than the OS name, as in the design.
 */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device';
  const r = UAParser(userAgent);
  const browser = r.browser.name?.replace(/^Mobile\s+/, '').replace(/\s+WebView$/, '') || null;
  let platform = r.os.name ? (OS_NAMES[r.os.name] ?? r.os.name) : null;
  if (platform === 'iOS' && r.device.model && /^(iPhone|iPad|iPod)/.test(r.device.model)) platform = r.device.model;
  if (browser && platform) return `${browser} on ${platform}`;
  return browser ?? platform ?? 'Unknown device';
}
