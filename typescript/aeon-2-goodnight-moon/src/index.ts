import { loadConfig } from './config.js';

// Load the configuration into our strictly typed Model
const greeting = loadConfig('../moon.aeon');

// --- Application Logic ---
const now = new Date();
const currentHour = now.getHours(); // 0 to 23

// Note how the boundary logic inside `index.ts` is dramatically simplified
// because we are confident `greeting` is perfectly populated and exposes business methods.
console.log(`AEON configuration loaded correctly (v${greeting.version})`);
console.log(`Current local time: ${now.toLocaleTimeString()}`);
console.log(`Night hours configured: ${greeting.getNightHoursRange()}`);
console.log("---");

// Fetch the structurally safe message
console.log(greeting.getGreetingMessage(currentHour));
