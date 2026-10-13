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

  constructor(
    private state: GameState,
    /** Replace this device's save with `data` and restart the game. */
    private reloadWith: (data: SaveData) => void,
  ) {
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
    setInterval(() => void this.upload(), UPLOAD_SECONDS * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.upload();
    });
  }

  private async start() {
    const { data } = await this.db!.auth.getSession();
    this.user = data.session?.user ?? null;
    this.render();
    if (this.user) await this.pull(false);
  }

  /** Bring the cloud save in line with this device. `firstSignIn` asks before replacing either side. */
  private async pull(firstSignIn: boolean) {
    const cloud = await this.fetchCloud();
    if (cloud === undefined) return;
    const local = this.state.toJSON();
    if (!cloud) {
      await this.upload();
      return;
    }
    if (!firstSignIn) {
      // The device that played last wins: a fresher cloud save means another device played since.
      if ((cloud.lastSeen ?? 0) > (local.lastSeen ?? 0)) this.replace(cloud);
      else await this.upload();
      return;
    }
    const freshDevice = (local.bestStage ?? 1) <= 1 && !local.rekindles;
    if (freshDevice) {
      this.replace(cloud);
      return;
    }
    this.choosing = true;
    this.openDialog(
      'Which save do you want?',
      `<p>This account already has a cloud save (<b>${summary(cloud)}</b>). This device has <b>${summary(local)}</b>.</p>
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
      await this.upload();
    });
  }

  private replace(data: SaveData) {
    this.choosing = true; // stops uploads while the page reloads
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

  private async upload() {
    if (!this.db || !this.user || this.choosing) return;
    this.state.save();
    const data = this.state.toJSON();
    const { error } = await this.db.from('saves').upsert({
      user_id: this.user.id,
      data,
      best_stage: data.bestStage ?? 1,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      this.render(`Cloud save failed: ${error.message}`);
      return;
    }
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
    await this.pull(true);
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
    let status = message;
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
