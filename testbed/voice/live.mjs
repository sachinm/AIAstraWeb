/**
 * One call you can watch and break by hand: opens the control page and the call, and stays up until you close the browser.
 *
 *   npm run voice:testbed:live
 */
import { chromium } from 'playwright';
import { BASE_FLAGS } from './flags.mjs';
import { startTestbed } from './server.mjs';

const tb = await startTestbed();
const browser = await chromium.launch({ headless: false, args: [...BASE_FLAGS, '--use-fake-ui-for-media-stream'] });
const agent = await (await browser.newContext()).newPage();
await agent.goto(`${tb.url}/agent`);
const client = await (await browser.newContext()).newPage();
await client.goto(`${tb.url}/client?autostart`);
const control = await (await browser.newContext({ viewport: null })).newPage();
await control.goto(tb.url);
console.log(`Control page: ${tb.url}. Close the browser to stop.`);
browser.on('disconnected', async () => {
  await tb.stop();
  process.exit(0);
});
