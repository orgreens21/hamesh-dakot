// The hub's "install as an app" card: one tap on Android/desktop Chrome, a short
// how-to sheet on iPhone, and nothing at all once the site already runs as an app.
import { onInstallStateChange, promptInstall } from './pwa.js';

const card = document.getElementById('install');
const button = document.getElementById('install-btn');
const sheet = document.getElementById('ios-sheet');

onInstallStateChange((state) => {
  card.hidden = !(state === 'prompt' || state === 'ios');
  card.dataset.state = state;
});

button.addEventListener('click', async () => {
  if (card.dataset.state === 'ios') {
    sheet.showModal();
    return;
  }
  await promptInstall();
});

sheet.addEventListener('click', (event) => {
  if (event.target === sheet) sheet.close();
});
