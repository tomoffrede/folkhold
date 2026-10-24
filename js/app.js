// The page's entry point: it loads the chosen language first, then starts the app (main.js).

import { initLang } from './lang.js';

await initLang();
await import('./main.js');
