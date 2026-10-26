import { storage } from '$lib/services/storage';

// Shows what only we should see, such as draft collections. Turned on in the browser console with
// `setDevMode(true)` (and off with `setDevMode(false)`), and remembered on this device. It only
// hides things: anyone who knows a draft's slug can still ask Convex for it.

const KEY = 'devMode';

class DevMode {
  on = $state(storage.get(KEY) === 'on');

  set(on: boolean) {
    this.on = on;
    if (on) storage.set(KEY, 'on');
    else storage.remove(KEY);
  }
}

export const devMode = new DevMode();

/** Makes `setDevMode` callable from the console. */
export function exposeDevMode() {
  window.setDevMode = (on = true) => {
    devMode.set(on);
    return `Dev mode is ${on ? 'on: drafts are showing' : 'off'}.`;
  };
}
