// The Settings screen: the choices you can change. (Sign out is handled in views/auth.js.)

import * as settings from '../settings.js';

const radios = () => document.querySelectorAll('input[name="contact-sort"]');

// Shows the saved choice. The choices stay switched off until the data has loaded.
function show() {
  const value = settings.get('contactSort');
  radios().forEach((radio) => {
    radio.checked = radio.value === value;
    radio.disabled = false;
  });
}

export function initSettings() {
  document.addEventListener('folkhold:data', show);
  radios().forEach((radio) => {
    radio.addEventListener('change', async () => {
      const message = document.getElementById('settings-message');
      message.hidden = true;
      try {
        await settings.set('contactSort', radio.value);
      } catch (error) {
        message.textContent = error.message;
        message.hidden = false;
        show(); // go back to the choice that is really saved
      }
    });
  });
}
