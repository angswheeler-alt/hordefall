import { describe, it, expect } from 'vitest';
import { GameState } from '../src/state';
import { loadedMail, newSaveMail } from '../src/mail';

describe('Mailbox: Pasta gift for existing players', () => {
  it('a brand-new save gets no existing-player gift', () => {
    const s = new GameState();
    expect(s.openMail()).toEqual([]);
    expect(newSaveMail()['pasta-launch']).toBe('none');
  });

  it('a save from before the mailbox opens the gift; a new save stays closed after saving and loading', () => {
    expect(loadedMail(undefined)['pasta-launch']).toBe('open');
    expect(loadedMail({ 'pasta-launch': 'none' })['pasta-launch']).toBe('none');
    expect(loadedMail({ 'pasta-launch': 'claimed' })['pasta-launch']).toBe('claimed');
  });

  it('claiming gives Pasta at 1★, level 1, once', () => {
    const s = new GameState() as any;
    s.mail['pasta-launch'] = 'open';
    expect(s.openMail().map((g: { id: string }) => g.id)).toEqual(['pasta-launch']);
    const drop = s.claimMail('pasta-launch');
    expect(drop?.joined).toBe(true);
    expect(s.levels.pasta).toBe(1);
    expect(s.stars.pasta ?? 0).toBe(0);
    expect(s.claimMail('pasta-launch')).toBeNull();
    expect(s.openMail()).toEqual([]);
  });

  it('a player who already has Pasta gets his unlock crests instead', () => {
    const s = new GameState() as any;
    s.levels.pasta = 5;
    s.mail['pasta-launch'] = 'open';
    const before = s.medalsFor('pasta');
    const drop = s.claimMail('pasta-launch');
    expect(drop?.joined).toBeFalsy();
    expect(s.medalsFor('pasta')).toBe(before + drop!.crests);
    expect(drop!.crests).toBeGreaterThan(0);
  });
});

describe('Mailbox: Gogu gift for current players', () => {
  it('opens for saves from before his release, not for new saves', () => {
    expect(loadedMail(undefined)['gogu-launch']).toBe('open');
    expect(loadedMail({ 'pasta-launch': 'claimed' })['gogu-launch']).toBe('open');
    expect(newSaveMail()['gogu-launch']).toBe('none');
  });

  it('claiming gives Gogu at 1★, once', () => {
    const s = new GameState() as any;
    s.mail['gogu-launch'] = 'open';
    const drop = s.claimMail('gogu-launch');
    expect(drop?.joined).toBe(true);
    expect(s.levels.kairo).toBe(1);
    expect(s.stars.kairo ?? 0).toBe(0);
    expect(s.claimMail('gogu-launch')).toBeNull();
  });
});

describe('Mailbox: Ferro and Yeren gifts, like Gogu', () => {
  for (const [gift, id] of [['ferro-launch', 'ferro'], ['yeren-launch', 'yeren']] as const) {
    it(`${gift} opens for older saves, not new ones, and gives ${id} at 1★ once`, () => {
      expect(loadedMail(undefined)[gift]).toBe('open');
      expect(newSaveMail()[gift]).toBe('none');
      const s = new GameState() as any;
      s.mail[gift] = 'open';
      const drop = s.claimMail(gift);
      expect(drop?.joined).toBe(true);
      expect(s.levels[id]).toBe(1);
      expect(s.claimMail(gift)).toBeNull();
    });
  }
});
