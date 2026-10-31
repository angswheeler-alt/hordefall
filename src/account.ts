import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, USERNAME_DOMAIN, TEST_MODE } from './config';
import { ALPHA_NOTICE } from './alphaNotice';
import { isAdmin, setAdmin } from './devAccess';
import { GameState, type SaveData } from './state';
import { decideSync, isBehind, progressOf, recommendedSave, type Progress, type SyncMode } from './sync';

/** How often a signed-in player's save goes up to the cloud. */
const UPLOAD_SECONDS = 30;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** 3-20 letters, numbers or underscores; case doesn't matter. */
const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;

const loginFor = (username: string) => `${username}@${USERNAME_DOMAIN}`;

const usernameOf = (user: User) => (user.user_metadata?.username as string | undefined) ?? user.email?.split('@')[0] ?? 'player';

/** Supabase's messages talk about emails; say it in username terms. */
const friendlyError = (message: string) => {
  if (/already registered|already exists/i.test(message)) return 'That username is taken. Try another one.';
  if (/invalid login credentials/i.test(message)) return 'Wrong username or password.';
  if (/email not confirmed/i.test(message)) return 'Accounts need "Confirm email" switched off in Supabase.';
  return message;
};

/** Where this device remembers which cloud revision its save was last synced with. */
const revKey = (userId: string) => `hordefall-cloud-rev:${userId}`;

/** One save, laid out for the "which save" choice. */
const saveCard = (title: string, d: SaveData, recommended = false) => {
  const p = progressOf(d);
  const heroes = Object.values((d.levels ?? {}) as Record<string, number>).filter((l) => Number(l) > 0).length;
  const played = d.lastSeen ? new Date(Number(d.lastSeen)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown';
  return `<div class="save-pick-card${recommended ? ' recommended' : ''}"><h3>${title}</h3>${recommended ? '<p class="save-pick-tag">More progress</p>' : ''}<ul>
    <li>Best stage <b>${p.best.toLocaleString()}</b></li>
    <li>Now on stage <b>${Number(d.stage ?? 1).toLocaleString()}</b></li>
    <li><b>${p.rekindles}</b> Rekindle${p.rekindles === 1 ? '' : 's'}</li>
    <li><b>${heroes}</b> hero${heroes === 1 ? '' : 'es'}</li>
    <li>Last played ${escape(played)}</li></ul></div>`;
};

/** Keep a copy of a save that is about to be replaced, on this device, so it can be recovered. */
const backup = (tag: string, data: unknown) => {
  try {
    localStorage.setItem(`hordefall-save-v1-backup-${tag}`, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or blocked: nothing more to do */
  }
};

/**
 * Player accounts and cloud saves. Guests keep playing on local saves; a
 * signed-in player's save syncs to the `saves` table. The rules for which
 * save wins live in decideSync (src/sync.ts).
 */
export class Account {
  private db: SupabaseClient | null = null;
  private user: User | null = null;
  private lastUpload = 0;
  /** True while the player has to pick between this device's save and the cloud's. */
  private choosing = false;
  /** The kind of pull behind the open "which save" choice, so it can be asked again with fresh numbers. */
  private asking: SyncMode | null = null;
  /** True while "Playing on another device" is up: another device saved while this one was open. */
  private elsewhere = false;
  /** True while an upload is on its way; a second one would race it and look like another device. */
  private uploading = false;
  /** False until the first pull after sign-in settles; uploads wait for it so a stale device can't win a race. */
  private synced = false;
  /** lastSeen of the save this page loaded, before this session's play moved it. */
  private readonly loadedLastSeen: number;
  /** Which kind of pull to retry while not synced ('start' until the first one settles). */
  private pendingMode: SyncMode = 'start';
  /** True once the player chose to leave cloud saving paused; only "Save now" retries then. */
  private paused = false;
  /** The cloud save's progress as last seen; an upload that would lower it asks first. */
  private cloudProgress: Progress | null = null;
  /** Told when the signed-in player may have changed (the guild panel listens). */
  readonly listeners: Array<() => void> = [];

  /** The database client, or null when online accounts are off. */
  get client(): SupabaseClient | null {
    return this.db;
  }

  /** The signed-in player's id, or null for a guest. */
  get userId(): string | null {
    return this.user?.id ?? null;
  }

  /** Open the sign-in dialog (from the guild panel). */
  signIn() {
    if (this.db && !this.user) this.openSignIn();
  }

  constructor(
    private state: GameState,
    /** Replace this device's save with `data` and restart the game. */
    private reloadWith: (data: SaveData) => void,
  ) {
    this.loadedLastSeen = state.lastSeen;
    $('acct-signin').addEventListener('click', () => this.openSignIn());
    $('acct-signout').addEventListener('click', () => void this.signOut());
    $('acct-sync').addEventListener('click', () => {
      if (this.synced) void this.upload();
      else {
        this.paused = false;
        void this.pull(this.pendingMode);
      }
    });
    $('acct-cancel').addEventListener('click', () => this.closeDialog());
    $('acct-form').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit((e as SubmitEvent).submitter?.id === 'acct-create');
    });
    if (TEST_MODE) {
      // Test mode plays a copy of the save: nothing goes online, so no client at all.
      this.render('Test mode: this copy of your save stays on this device. Nothing is saved online.');
      return;
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      this.render('Online accounts are not switched on yet. Progress saves on this device.');
      return;
    }
    this.db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.render('Connecting…');
    void this.start();
    // Uploads every 30s; while not synced (offline at start, say), the sync is retried instead.
    // A hidden copy is paused (it saved on the way out), so it leaves the cloud to the device being played.
    setInterval(() => {
      if (document.hidden) return;
      if (this.user && !this.synced) {
        if (!this.choosing && !this.paused) void this.pull(this.pendingMode);
      } else void this.upload();
    }, UPLOAD_SECONDS * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.upload();
      else this.resume();
    });
    // A phone can bring back a page from days ago exactly as it was left, dialog and all.
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) this.resume();
    });
  }

  private async start() {
    const { data } = await this.db!.auth.getSession();
    this.user = data.session?.user ?? null;
    this.render();
    void this.checkAdmin();
    if (this.user) await this.pull('start');
  }

  /** The cloud revision this device's save was last synced with (null: never synced). */
  private get knownRev(): number | null {
    try {
      const v = localStorage.getItem(revKey(this.user!.id));
      return v === null ? null : Number(v);
    } catch {
      return null;
    }
  }

  private set knownRev(rev: number | null) {
    try {
      if (rev === null) localStorage.removeItem(revKey(this.user!.id));
      else localStorage.setItem(revKey(this.user!.id), String(rev));
    } catch {
      // Storage blocked: every start counts as a first sync.
    }
  }

  /**
   * Bring the cloud save in line with this device. Every upload bumps a
   * revision number in the cloud save, and each device remembers the revision
   * it last synced. If the cloud moved on since then, another device played:
   * take its save when this device hasn't played since, otherwise ask.
   * `mode`: 'start' when the game opens, 'signin' right after signing in
   * (asks before replacing a played device's save), 'conflict' when an upload
   * found the cloud had moved on mid-session (both sides played, so it asks).
   */
  private async pull(mode: SyncMode) {
    if (this.pulling) return;
    this.pulling = true;
    this.synced = false;
    this.pendingMode = mode;
    try {
      await this.reconcile(mode);
    } finally {
      this.pulling = false;
    }
  }

  private pulling = false;

  private async reconcile(mode: SyncMode) {
    const cloud = await this.fetchCloud();
    const local = this.state.toJSON();
    const action = decideSync({ mode, cloud, local, knownRev: this.knownRev, loadedLastSeen: this.loadedLastSeen });
    switch (action) {
      case 'pause':
        // A failed request says nothing about whether a save exists: write nothing, retry later.
        this.render("Couldn't reach the cloud save, so cloud saving is paused. Your progress is safe on this device.");
        return;
      case 'missing':
        this.askMissing(cloud as SaveData | null, local);
        return;
      case 'create':
        await this.create(local);
        return;
      case 'upload':
        this.cloudProgress = progressOf(cloud as SaveData);
        this.synced = true;
        await this.upload();
        return;
      case 'take-cloud':
        this.replace(cloud as SaveData);
        return;
      case 'keep-device':
        await this.keepDevice(cloud as SaveData, 'This device was played more recently, so its save was kept. A copy of the cloud save is on this device.');
        return;
      case 'ask':
        this.askWhichSave(cloud as SaveData, local, mode);
        return;
    }
  }

  /** First cloud save for this account. Insert only, so a save that is there after all is never written over. */
  private async create(local: SaveData) {
    const data: SaveData = { ...local, rev: 1 };
    const { error } = await this.db!.from('saves').insert({ user_id: this.user!.id, data, best_stage: data.bestStage ?? 1, updated_at: new Date().toISOString() });
    if (error) {
      this.render(`Cloud saving is paused: ${error.message}. Your progress is safe on this device.`);
      return;
    }
    this.knownRev = 1;
    this.cloudProgress = progressOf(data);
    this.synced = true;
    this.lastUpload = Date.now();
    this.render();
  }

  /**
   * This device synced before, but the cloud save is gone or can't be read.
   * That isn't proof the player is new, so nothing is written until they say so.
   */
  private askMissing(cloud: SaveData | null, local: SaveData) {
    this.choosing = true;
    this.openDialog(
      'Cloud save not found',
      `<p>${cloud ? "This account's cloud save can't be read." : "This account's cloud save is missing."} Cloud saving is paused, and nothing has been changed.</p>
       <div class="save-pick">${saveCard('This device', local)}</div>
       <p>Save this device's progress to the cloud, or keep cloud saving paused and try again later with Save now in Settings.</p>
       <div class="modal-actions"><button type="button" id="acct-keep-paused">Keep paused</button><button type="button" id="acct-upload-device" class="hot">Save this device</button></div>`,
      false,
    );
    $('acct-keep-paused').addEventListener('click', () => {
      this.choosing = false;
      this.paused = true;
      this.closeDialog();
      this.render('Cloud saving is paused. Your progress is safe on this device.');
    });
    $('acct-upload-device').addEventListener('click', async () => {
      this.closeDialog();
      if (cloud) backup('cloud-unreadable', cloud);
      const data: SaveData = { ...this.state.toJSON(), rev: Number(cloud?.rev ?? 0) + 1 };
      const { error } = await this.db!.from('saves').upsert({ user_id: this.user!.id, data, best_stage: data.bestStage ?? 1, updated_at: new Date().toISOString() });
      this.choosing = false;
      if (error) {
        this.paused = true;
        this.render(`Cloud saving is paused: ${error.message}. Your progress is safe on this device.`);
        return;
      }
      this.knownRev = data.rev;
      this.cloudProgress = progressOf(data);
      this.synced = true;
      this.lastUpload = Date.now();
      this.render();
    });
  }

  /**
   * The game came back into view. If another device took over meanwhile, this
   * one takes over again (the player is looking at it). If the "which save"
   * choice was left open (the game kept running under it, and nothing reaches
   * the cloud meanwhile), ask again with both saves as they are now.
   */
  private resume() {
    if (this.elsewhere) {
      this.playHere();
      return;
    }
    if (this.asking === null || GameState.frozen) return;
    const mode = this.asking;
    this.asking = null;
    this.choosing = false;
    this.closeDialog();
    void this.pull(mode);
  }

  /**
   * Another device saved while this one was open: only one copy of the game
   * plays at a time, so this one stops saving to the cloud until the player
   * says to play here (or comes back to it).
   */
  private showElsewhere() {
    this.choosing = true;
    this.elsewhere = true;
    this.openDialog(
      'Playing on another device',
      `<p>Your game was saved from another device, so this copy stopped saving to the cloud. Nothing is lost.</p>
       <p>Tap Play here to carry on with your newest save on this device.</p>
       <div class="modal-actions"><button type="button" id="acct-play-here" class="hot">Play here</button></div>`,
      false,
    );
    $('acct-play-here').addEventListener('click', () => this.playHere());
  }

  /** Take over from the other device: load its newer save, or keep this one if it is further on. */
  private playHere() {
    if (!this.elsewhere || GameState.frozen) return;
    this.elsewhere = false;
    this.choosing = false;
    this.closeDialog();
    void this.pull('takeover');
  }

  /**
   * The player picks between this device's save and the cloud's, and the other
   * is replaced. The save with more progress is the recommended one; picking
   * the other takes a second tap.
   */
  private askWhichSave(cloud: SaveData, local: SaveData, mode: SyncMode) {
    this.choosing = true;
    this.asking = mode;
    const pick = recommendedSave(local, cloud);
    const name = pick === 'device' ? 'this device' : 'the cloud save';
    this.openDialog(
      'Which save do you want?',
      `<p>This device and this account's cloud save have different progress. We recommend <b>${name}</b>: it has more progress.</p>
       <div class="save-pick">${saveCard('This device', local, pick === 'device')}${saveCard('Cloud save', cloud, pick === 'cloud')}</div>
       <p>The one you don't pick is replaced (a copy is kept on this device).</p>
       <div class="modal-actions"><button type="button" id="acct-keep-device"${pick === 'device' ? ' class="hot"' : ''}>This device</button><button type="button" id="acct-keep-cloud"${pick === 'cloud' ? ' class="hot"' : ''}>Cloud save</button></div>`,
      false,
    );
    // The save with less progress needs a second tap, so it can't be picked by accident.
    const confirmed = (button: HTMLElement, recommended: boolean) => {
      if (recommended || button.dataset.sure) return true;
      button.dataset.sure = '1';
      button.textContent = 'Tap again: less progress';
      return false;
    };
    $('acct-keep-cloud').addEventListener('click', (e) => {
      if (!confirmed(e.currentTarget as HTMLElement, pick === 'cloud')) return;
      this.asking = null;
      this.replace(cloud);
    });
    $('acct-keep-device').addEventListener('click', async (e) => {
      if (!confirmed(e.currentTarget as HTMLElement, pick === 'device')) return;
      this.asking = null;
      this.closeDialog();
      await this.keepDevice(cloud);
    });
  }

  /** Save this device over the cloud, keeping a copy of the cloud save on this device. */
  private async keepDevice(cloud: SaveData, note?: string) {
    backup('cloud-replaced', cloud);
    this.choosing = false;
    this.synced = true;
    this.cloudProgress = null; // this device's save wins, even if it is behind
    await this.upload(Number(cloud.rev ?? 0));
    if (note) this.render(note);
  }

  private replace(data: SaveData) {
    this.choosing = true; // stops uploads while the page reloads
    if (!GameState.frozen) backup('device-replaced', this.state.toJSON());
    this.knownRev = Number(data.rev ?? 0);
    this.reloadWith(data);
  }

  /** The cloud save, null when there is none yet, undefined when the request failed. */
  private async fetchCloud(): Promise<SaveData | null | undefined> {
    const { data, error } = await this.db!.from('saves').select('data').eq('user_id', this.user!.id).maybeSingle();
    if (error) {
      this.render(`Couldn't reach the cloud save: ${error.message}`);
      return undefined;
    }
    return (data?.data as SaveData | undefined) ?? null;
  }

  /**
   * Save to the cloud, but only over the revision this device last synced
   * (`over` overrides it after the player chose this device's save). If another
   * device saved in between, nothing is written and the player is asked.
   */
  private async upload(over: number | null = this.knownRev) {
    if (!this.db || !this.user || this.choosing || !this.synced || GameState.frozen || this.uploading) return;
    this.uploading = true;
    try {
      await this.uploadNow(over);
    } finally {
      this.uploading = false;
    }
  }

  private async uploadNow(over: number | null) {
    if (!this.db || !this.user) return;
    this.state.save();
    const rev = (over ?? 0) + 1;
    const data: SaveData = { ...this.state.toJSON(), rev };
    if (this.cloudProgress && isBehind(progressOf(data), this.cloudProgress)) {
      // This device's save went backwards from what the cloud holds (lost or reset?): ask instead of writing it over.
      await this.pull('conflict');
      return;
    }
    const row = { user_id: this.user.id, data, best_stage: data.bestStage ?? 1, updated_at: new Date().toISOString() };
    let error: { message: string } | null;
    let written = true;
    if (over === 0 && this.knownRev === null) {
      // First save for this account (or a device that never synced).
      ({ error } = await this.db.from('saves').upsert(row));
    } else {
      const res = await this.db.from('saves').update(row).eq('user_id', this.user.id).eq('data->>rev', String(over ?? 0)).select('user_id');
      error = res.error;
      written = !!res.data?.length;
    }
    if (error) {
      this.render(`Cloud save failed: ${error.message}`);
      return;
    }
    if (!written) {
      // Another device saved since this one last synced: it is playing now.
      this.showElsewhere();
      return;
    }
    this.knownRev = rev;
    this.cloudProgress = progressOf(data);
    this.lastUpload = Date.now();
    this.render();
  }

  /**
   * Full account reset. A signed-in player leaves their guild and the cloud
   * save is overwritten with a fresh game (they stay signed in); then this
   * device's save is replaced too and the page reloads. Returns an error to
   * show, and changes nothing locally, when the server couldn't be reached,
   * since the old cloud save would otherwise come back on the next start.
   */
  async reset(): Promise<string | null> {
    if (this.db && this.user) {
      this.choosing = true; // no uploads of the old state while this runs
      const fail = (message: string) => {
        this.choosing = false;
        return `Couldn't reset the online account: ${message}`;
      };
      const left = await this.db.rpc('leave_guild');
      // Guild tables missing (guilds.sql not run) means there is no guild to leave.
      if (left.error && !/does not exist|schema cache|PGRST20[0-9]|42P01|42883/i.test(left.error.message)) return fail(left.error.message);
      const cloud = await this.fetchCloud();
      if (cloud === undefined) return fail('the cloud save is out of reach.');
      const rev = Number(cloud?.rev ?? 0) + 1;
      const data = GameState.freshSave(rev);
      const row = { user_id: this.user.id, data, best_stage: 1, updated_at: new Date().toISOString() };
      const { error } = cloud ? await this.db.from('saves').update(row).eq('user_id', this.user.id) : await this.db.from('saves').upsert(row);
      if (error) return fail(error.message);
      this.knownRev = rev;
      GameState.startOver(data);
      return null;
    }
    GameState.startOver();
    return null;
  }

  private async submit(create: boolean) {
    const username = $<HTMLInputElement>('acct-name').value.trim().toLowerCase();
    const password = $<HTMLInputElement>('acct-password').value;
    const note = $('acct-note');
    if (!USERNAME_RULE.test(username)) {
      note.textContent = 'Usernames are 3-20 letters, numbers or underscores.';
      return;
    }
    if (password.length < 6) {
      note.textContent = 'Passwords need at least 6 characters.';
      return;
    }
    note.textContent = create ? 'Creating your account…' : 'Signing in…';
    const auth = this.db!.auth;
    const email = loginFor(username);
    const { data, error } = create
      ? await auth.signUp({ email, password, options: { data: { username } } })
      : await auth.signInWithPassword({ email, password });
    if (error) {
      note.textContent = friendlyError(error.message);
      return;
    }
    if (!data.session) {
      note.textContent = 'Accounts need "Confirm email" switched off in Supabase.';
      return;
    }
    this.user = data.session.user;
    this.closeDialog();
    this.render();
    void this.checkAdmin();
    await this.pull('signin');
    // Shown once, right after the account is made; later sign-ins never see it.
    if (create && !this.choosing) this.showAlphaNotice();
  }

  private showAlphaNotice() {
    this.openDialog(
      ALPHA_NOTICE.title,
      `<p>${ALPHA_NOTICE.body}</p>
       <div class="modal-actions"><button type="button" id="acct-alpha-ok" class="hot">Got it</button></div>`,
      false,
    );
    $('acct-alpha-ok').addEventListener('click', () => this.closeDialog());
  }

  private async signOut() {
    await this.upload();
    await this.db?.auth.signOut();
    this.user = null;
    setAdmin(false);
    this.render();
  }

  private openSignIn() {
    this.openDialog(
      'Save your progress online',
      `<p>Pick a username and password to keep your progress safe and play on any device. There's no email, so keep your password somewhere safe.</p>
       <input id="acct-name" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Username" maxlength="20" required>
       <input id="acct-password" type="password" autocomplete="current-password" placeholder="Password (6+ characters)" minlength="6" required>
       <p id="acct-note" class="acct-note"></p>
       <div class="modal-actions"><button type="submit" id="acct-create">Create account</button><button type="submit" id="acct-login" class="hot">Sign in</button></div>`,
      true,
    );
    $<HTMLInputElement>('acct-name').focus();
  }

  private openDialog(title: string, html: string, cancel: boolean) {
    $('acct-title').textContent = title;
    $('acct-body').innerHTML = html;
    $('acct-cancel').hidden = !cancel;
    $('acct-dialog').hidden = false;
  }

  /** Whether the signed-in player is a save admin (public.save_admins), as the server last said. */
  get isAdmin(): boolean {
    return isAdmin();
  }

  /** Asks the server whether the signed-in player is a save admin; a ?dev link opens the prototype tools only for them. */
  private async checkAdmin() {
    if (!this.db || !this.user) return;
    const { data, error } = await this.db.rpc('is_save_admin');
    setAdmin(!error && data === true);
    this.render();
  }

  private closeDialog() {
    $('acct-dialog').hidden = true;
  }

  private render(message?: string) {
    const signedIn = !!this.user;
    let status = message ? escape(message) : undefined;
    if (!status) {
      if (!signedIn) status = 'Playing as a guest. Progress saves on this device only.';
      else if (this.lastUpload) status = `Signed in as ${escape(usernameOf(this.user!))}. Saved to the cloud at ${new Date(this.lastUpload).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
      else status = `Signed in as ${escape(usernameOf(this.user!))}.`;
    }
    $('acct-status').innerHTML = status;
    $('acct-signin').hidden = signedIn || !this.db;
    $('acct-reset').hidden = TEST_MODE;
    $('acct-signout').hidden = !signedIn;
    $('acct-sync').hidden = !signedIn;
    for (const listener of this.listeners) listener();
  }
}
