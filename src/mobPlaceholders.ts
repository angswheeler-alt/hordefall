// Simple placeholder pictures for the special mob kinds (src/mobs.ts MOB_ART_PENDING) until their real art
// arrives. Each is a small SVG facing right like the real mob art (enemies are flipped on the lane). On the lane
// it is drawn white and tinted by the stage's element; the Journal draws it in the element's colour.
import type { MobId } from './mobs';

export const PLACEHOLDER_SIZE = 32;

const OUT = '#14141c';

function shapes(id: MobId, body: string): string {
  switch (id) {
    case 'shieldbearer':
      // A squat armoured soldier behind a tall tower shield.
      return (
        `<rect x='5' y='9' width='14' height='18' rx='4' fill='${body}' stroke='${OUT}' stroke-width='2'/>` +
        `<rect x='7' y='4' width='10' height='8' rx='3' fill='${body}' stroke='${OUT}' stroke-width='2'/>` +
        `<rect x='9' y='7' width='6' height='2' fill='${OUT}'/>` +
        `<rect x='5' y='27' width='4' height='4' fill='${OUT}'/><rect x='14' y='27' width='4' height='4' fill='${OUT}'/>` +
        `<path d='M18 6 h10 v16 l-5 7 l-5 -7 z' fill='#c9c9d2' stroke='${OUT}' stroke-width='2'/>` +
        `<circle cx='23' cy='14' r='2.5' fill='${OUT}'/>`
      );
    case 'bomber':
      // A round, running powder keg with a lit fuse.
      return (
        `<circle cx='15' cy='18' r='10' fill='${body}' stroke='${OUT}' stroke-width='2'/>` +
        `<rect x='9' y='15' width='12' height='3' fill='${OUT}' opacity='0.45'/>` +
        `<path d='M20 9 q4 -6 8 -4' fill='none' stroke='${OUT}' stroke-width='2'/>` +
        `<circle cx='28' cy='5' r='2.6' fill='#ffb23a' stroke='${OUT}' stroke-width='1'/>` +
        `<circle cx='19' cy='16' r='1.6' fill='${OUT}'/><circle cx='23' cy='16' r='1.6' fill='${OUT}'/>` +
        `<rect x='9' y='27' width='4' height='4' fill='${OUT}'/><rect x='17' y='27' width='4' height='4' fill='${OUT}'/>`
      );
    case 'summoner':
      // A hooded robe with a staff topped by a glowing orb.
      return (
        `<path d='M14 3 l9 26 h-18 z' fill='${body}' stroke='${OUT}' stroke-width='2' stroke-linejoin='round'/>` +
        `<ellipse cx='16' cy='11' rx='3.5' ry='2.5' fill='${OUT}'/>` +
        `<circle cx='17.5' cy='11' r='1' fill='#fff6a0'/>` +
        `<rect x='25' y='8' width='2' height='22' fill='${OUT}'/>` +
        `<circle cx='26' cy='6' r='4' fill='#e8d6ff' stroke='${OUT}' stroke-width='1.5'/>`
      );
    case 'burrower':
      // A digging critter half out of a dirt mound, big claws forward.
      return (
        `<ellipse cx='16' cy='28' rx='14' ry='4' fill='#6b5236' stroke='${OUT}' stroke-width='1.5'/>` +
        `<ellipse cx='15' cy='18' rx='10' ry='9' fill='${body}' stroke='${OUT}' stroke-width='2'/>` +
        `<path d='M23 20 l7 -2 l-2 3 l3 1 l-6 3 z' fill='#e8e8e8' stroke='${OUT}' stroke-width='1.5'/>` +
        `<circle cx='20' cy='15' r='1.6' fill='${OUT}'/>` +
        `<path d='M24 15 l4 1' stroke='${OUT}' stroke-width='2'/>`
      );
    default:
      return `<circle cx='16' cy='16' r='10' fill='${body}' stroke='${OUT}' stroke-width='2'/>`;
  }
}

/** The placeholder as SVG markup, with its body in `body` (a CSS colour). */
export function placeholderSvg(id: MobId, body = '#ffffff'): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${PLACEHOLDER_SIZE}' height='${PLACEHOLDER_SIZE}' viewBox='0 0 32 32'>${shapes(id, body)}</svg>`;
}

/** The placeholder as a data URL (Phaser loader, CSS backgrounds). */
export function placeholderUrl(id: MobId, body = '#ffffff'): string {
  return `data:image/svg+xml,${encodeURIComponent(placeholderSvg(id, body))}`;
}

/** The placeholder as a base64 data URL: Phaser's loader decodes data URLs with atob, so it needs this form. */
export function placeholderBase64Url(id: MobId, body = '#ffffff'): string {
  return `data:image/svg+xml;base64,${btoa(placeholderSvg(id, body))}`;
}
