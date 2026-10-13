import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, USERNAME_DOMAIN } from './config';
import { GameState, type SaveData } from './state';

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

const summary = (d: SaveData) => `stage ${(d.bestStage ?? d.stage ?? 1).toLocaleString()}, ${d.rekindles ?? 0} Rekindle${d.rekindles === 1 ? '' : 's'}`;

/**
 * Player accounts and cloud saves. Guests keep playing on local saves; a
 * signed-in player's save syncs to the `saves` table, and the most recently
 * played device wins when the game starts.
 */
export class Account {
  private db: SupabaseClient | null = null;
  private user: User | null = null;
  private lastUpload = 0;
  /** True while the player has to pick between this device's save and the cloud's. */
  private choosing = false;
  /** False until the first pull after sign-in settles; uploads wait for it so a stale device can't win a race. */
  private synced = false;
  /** lastSeen of the save this page loaded, before this session's play moved it. */
  private readonly loadedLastSeen: number;

  constructor(
    private state: GameState,
    /** Replace this device's save with `data` and restart the game. */
    private reloadWith: (data: SaveData) => void,
  ) {
    this.loadedLastSeen = state.lastSeen;
    $('acct-signin').addEventListener('click', () => this.openSignIn());
    $('acct-signout').addEventListener('click', () => void this.signOut());
    $('acct-sync').addEventListener('click', () => void this.upload());
    $('acct-cancel').addEventListener('click', () => this.closeDialog());
    $('acct-form').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit((e as SubmitEvent).submitter?.id === 'acct-create');
    });
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      this.render('Online accounts are not switched on yet. Progress saves on this device.');
      return;
    }
    this.db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.render('Connecting…');
    void this.start();
    // Uploads every 30s; if the first sync failed (offline at start), it is retried instead.
    setInterval(() => void (this.user && !this.synced && !this.choosing ? this.pull('conflict') : this.upload()), UPLOAD_SECONDS * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.upload();
    });
  }

  private async start() {
    const { data } = await this.db!.auth.getSession();
    this.user = data.session?.user ?? null;
    this.render();
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
  private async pull(mode: 'start' | 'signin' | 'conflict') {
    if (this.pulling) return;
    this.pulling = true;
    this.synced = false;
    try {
      await this.reconcile(mode);
    } finally {
      this.pulling = false;
    }
  }

  private pulling = false;

  private async reconcile(mode: 'start' | 'signin' | 'conflict') {
    const cloud = await this.fetchCloud();
    if (cloud === undefined) return; // retried on the next upload tick
    const local = this.state.toJSON();
    if (!cloud) {
      this.knownRev = null;
      this.synced = true;
      await this.upload(0);
      return;
    }
    const cloudRev = Number(cloud.rev ?? 0);
    if (mode === 'start' && this.knownRev === null && cloud.rev === undefined) {
      // A cloud save from before revisions: the most recently played save wins, as it used to.
      if ((cloud.lastSeen ?? 0) > this.loadedLastSeen) this.replace(cloud);
      else {
        this.synced = true;
        await this.upload(0);
      }
      return;
    }
    if (this.knownRev === cloudRev) {
      // Nobody else saved since this device last synced: this device is current.
      this.synced = true;
      await this.upload();
      return;
    }
    if (mode === 'start') {
      // Another device saved. If this device's save is older than that one, it hasn't played since: take the cloud's.
      if ((cloud.lastSeen ?? 0) >= this.loadedLastSeen) {
        this.replace(cloud);
        return;
      }
    } else if (mode === 'signin') {
      const freshDevice = (local.bestStage ?? 1) <= 1 && !local.rekindles;
      if (freshDevice) {
        this.replace(cloud);
        return;
      }
    }
    this.askWhichSave(cloud, local, cloudRev);
  }

  /** Both sides have progress the other lacks: the player picks, and the other is replaced. */
  private askWhichSave(cloud: SaveData, local: SaveData, cloudRev: number) {
    this.choosing = true;
    this.openDialog(
      'Which save do you want?',
      `<p>This account's cloud save (<b>${summary(cloud)}</b>) was played on another device. This device has <b>${summary(local)}</b>.</p>
       <p>The one you don't pick is replaced.</p>
       <div class="modal-actions"><button type="button" id="acct-keep-device">This device</button><button type="button" id="acct-keep-cloud" class="hot">Cloud save</button></div>`,
      false,
    );
    $('acct-keep-cloud').addEventListener('click', () => {
      this.replace(cloud);
    });
    $('acct-keep-device').addEventListener('click', async () => {
      this.choosing = false;
      this.closeDialog();
      this.synced = true;
      await this.upload(cloudRev);
    });
  }

  private replace(data: SaveData) {
    this.choosing = true; // stops uploads while the page reloads
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
    if (!this.db || !this.user || this.choosing || !this.synced || GameState.frozen) return;
    this.state.save();
    const rev = (over ?? 0) + 1;
    const data: SaveData = { ...this.state.toJSON(), rev };
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
      // Another device saved since this one last synced.
      await this.pull('conflict');
      return;
    }
    this.knownRev = rev;
    this.lastUpload = Date.now();
    this.render();
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
    await this.pull('signin');
  }

  private async signOut() {
    await this.upload();
    await this.db?.auth.signOut();
    this.user = null;
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
    $('acct-signout').hidden = !signedIn;
    $('acct-sync').hidden = !signedIn;
  }
}
