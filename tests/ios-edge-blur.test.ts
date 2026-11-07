import { describe, expect, it } from 'vitest';
import css from '../src/style.css?raw';
import html from '../index.html?raw';

// iOS 26+ blurs a band under the status bar in home-screen apps; the page
// must start below it and an opaque strip must cover it (src/style.css).

describe('iOS top edge blur', () => {
  it('has the opaque cover strip in the page', () => {
    expect(html).toContain('id="edge-cover"');
  });
  it('pads the band only in the installed app on iOS 26+', () => {
    expect(css).toMatch(/@media \(display-mode: standalone\)\s*\{\s*@supports \(anchor-name: --a\) and \(-webkit-touch-callout: none\)\s*\{\s*:root \{ --edge-pad: 36px; \}/);
  });
  it('places page content with --safe-top, not the raw status bar inset', () => {
    const raw = css.match(/env\(safe-area-inset-top[^)]*\)/g) ?? [];
    expect(raw).toHaveLength(1); // only inside the --safe-top definition
  });
});
