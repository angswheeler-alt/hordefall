import { DEV_BUILD, DEV_LINK, TEST_MODE } from './config';

/** Dev builds always get the prototype tools; a ?dev link only once the signed-in player is a save admin. */
export function devToolsAllowed(devBuild: boolean, devLink: boolean, admin: boolean): boolean {
  return devBuild || (devLink && admin);
}

let admin = false;

/** Set by Account after it asks the server (is_save_admin) whether the signed-in player is an admin. */
export function setAdmin(value: boolean) {
  admin = value;
}

export function isAdmin(): boolean {
  return admin;
}

/** Admin test mode (src/testMode.ts) plays an offline copy of the save, so the tools are always on there. */
export function devToolsOn(): boolean {
  return TEST_MODE || devToolsAllowed(DEV_BUILD, DEV_LINK, admin);
}
