import { describe, expect, it } from 'vitest';
import manifestText from '../public/manifest.webmanifest?raw';
import swText from '../public/sw.js?raw';
import { installHow } from '../src/install';

const env = { standalone: false, prompt: false, ua: 'Mozilla/5.0 (Linux; Android 14) Chrome/130', touchMac: false };

describe('Install on a phone', () => {
  it('picks the right way to install', () => {
    expect(installHow({ ...env, standalone: true, prompt: true })).toBe('installed');
    expect(installHow({ ...env, prompt: true })).toBe('prompt');
    expect(installHow({ ...env, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe('ios');
    expect(installHow({ ...env, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touchMac: true })).toBe('ios');
    expect(installHow(env)).toBe('menu');
  });

  it('the manifest has the icons stores and phones need, and they exist', () => {
    const m = JSON.parse(manifestText);
    const files = Object.keys(import.meta.glob('../public/icons/*.png')).map((f) => f.replace('../public/', ''));
    expect(m.display).toBe('standalone');
    const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']));
    for (const i of m.icons) expect(files).toContain(i.src);
    expect(files).toContain('icons/apple-touch-icon.png');
  });

  it('the service worker never caches other sites (cloud saves)', () => {
    expect(swText).toMatch(/url\.origin !== location\.origin\) return/);
  });
});
