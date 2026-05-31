import { ConfigValidationError } from './aeon-config.js';
import { loadConfig } from './config.js';

try {
  const farewell = loadConfig('../sun.aeon');
  const now = new Date();
  const currentHour = now.getHours();

  console.log(`AEON configuration loaded correctly (v${farewell.version})`);
  console.log(`Current local time: ${now.toLocaleTimeString()}`);
  console.log(`Sunset window: ${farewell.getSunsetWindow()}`);
  console.log(`Sleep window: ${farewell.getSleepWindow()}`);
  console.log('---');
  console.log(farewell.getMessage(currentHour));
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error(`[${error.phase}] ${error.message}`);
    process.exit(1);
  }
  throw error;
}
