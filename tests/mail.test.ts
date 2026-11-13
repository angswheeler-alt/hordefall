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
