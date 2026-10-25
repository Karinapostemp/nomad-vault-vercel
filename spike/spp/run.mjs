// Headless end-to-end: Maya registers, employer deposits and pays her privately, Maya withdraws part.
// Each role gets its own Chrome profile, because SPP keeps private notes in that browser's OPFS.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const secret = (name) => execFileSync('stellar', ['keys', 'show', name]).toString().trim();
const address = (name) => execFileSync('stellar', ['keys', 'address', name]).toString().trim();
const XLM = 10_000_000;

const server = await createServer({ configFile: new URL('./vite.config.mjs', import.meta.url).pathname });
await server.listen();
const out = { startedAt: new Date().toISOString(), steps: [] };
const step = (role, name, value) => { out.steps.push({ role, name, value }); console.log(`[${role}] ${name}:`, JSON.stringify(value)); };

async function session(role, keyName) {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, userDataDir: new URL(`./.profiles/${role}`, import.meta.url).pathname,
    protocolTimeout: 600_000,
  });
  const page = await browser.newPage();
  page.on('console', (m) => { const t = m.text(); if (!t.startsWith('[vite]')) console.log(`  ${role}> ${t.slice(0, 300)}`); });
  page.on('pageerror', (e) => console.log(`  ${role}! ${e.message}`));
  await page.goto('http://localhost:5174/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.spp, { timeout: 60_000 });
  if (process.env.SPP_DEBUG) await page.evaluate(() => { window.SPP_DEBUG = true; });
  const call = async (fn, ...args) => {
    const v = await page.evaluate((f, a) => window.spp[f](...a), fn, args);
    step(role, fn, v);
    return v;
  };
  await call('open', secret(keyName));
  return { call, close: () => browser.close() };
}

if (process.env.ONLY_OPEN) {
  try { const m = await session('maya', 'nv-maya'); if (process.env.REGISTER) await m.call('register'); await m.close(); out.ok = true; } catch (e) { out.ok = false; out.error = String(e?.message || e).slice(0, 400); console.error('FAILED', out.error); }
  await server.close(); process.exit(out.ok ? 0 : 1);
}
try {
  const maya = await session('maya', 'nv-maya');
  await maya.call('register');

  const employer = await session('employer', 'nv-employer');
  await employer.call('register');
  await employer.call('deposit', String(20 * XLM));
  await employer.call('balance');
  await employer.call('lookup', address('nv-maya'));
  await employer.call('transfer', address('nv-maya'), String(5 * XLM));
  await employer.call('balance');
  await employer.close();

  await maya.call('sync');
  await maya.call('balance');
  await maya.call('withdraw', String(2 * XLM));
  await maya.call('balance');
  await maya.close();
  out.ok = true;
} catch (e) {
  out.ok = false;
  out.error = String(e?.message || e);
  console.error('FAILED', out.error);
} finally {
  out.finishedAt = new Date().toISOString();
  writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(out, null, 2));
  await server.close();
  process.exit(out.ok ? 0 : 1);
}
