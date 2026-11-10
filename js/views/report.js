// "Report a problem": an email link (subject carries the app language) and a button that copies the address.

import { strings } from '../strings.js';
import { getLang } from '../lang.js';

const ADDRESS = 'folkhold@disroot.org';
const $ = (id) => document.getElementById(id);

export function initReport() {
  const subject = () => `${strings['report.subject']} (${getLang()})`;
  const link = () => `mailto:${ADDRESS}?subject=${encodeURIComponent(subject())}`;
  const update = () => {
    $('report-send').href = link();
    $('report-mail').href = link();
  };
  update();
  document.addEventListener('folkhold:data', update);
  $('report-copy').addEventListener('click', async () => {
    const button = $('report-copy');
    try {
      await navigator.clipboard.writeText(ADDRESS);
      button.textContent = strings['report.copied'];
      setTimeout(() => (button.textContent = strings['report.copy']), 1500);
    } catch {
      const range = document.createRange(); // no clipboard access: select the address so it can be copied by hand
      range.selectNodeContents($('report-address'));
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
}
