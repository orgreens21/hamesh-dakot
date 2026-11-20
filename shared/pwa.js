// Offline support and "install as an app", loaded by every page.
//
// - Registers sw.js (at the site root, found relative to this file, so the site also
//   works when hosted under a sub-path).
// - Remembers Chrome/Android's install offer so the hub can show its own install button.
// - Knows whether the visitor is on an iPhone/iPad, where installing is a manual
//   "Share → Add to Home Screen" step that the hub explains instead.

const SITE_ROOT = new URL('../', import.meta.url);
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(installState()));

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  // After the page has loaded, so caching the site never competes with the first paint.
  const register = () => navigator.serviceWorker.register(new URL('sw.js', SITE_ROOT), { scope: SITE_ROOT.pathname }).catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

window.addEventListener('beforeinstallprompt', (event) => {
  // Keep the browser's mini-infobar from appearing at a random moment; the hub offers it instead.
  event.preventDefault();
  deferredPrompt = event;
  notify();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  notify();
});

export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function isIOS() {
  // iPadOS reports itself as a Mac, so also check for touch.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** 'installed' | 'prompt' (one-tap install available) | 'ios' (manual steps) | 'none' */
export function installState() {
  if (isStandalone()) return 'installed';
  if (deferredPrompt) return 'prompt';
  if (isIOS()) return 'ios';
  return 'none';
}

export function onInstallStateChange(fn) {
  listeners.add(fn);
  fn(installState());
  return () => listeners.delete(fn);
}

/** Shows the browser's install dialog. Resolves to true if the visitor accepted. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null;
  event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome === 'accepted';
}
