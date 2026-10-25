// Debug proxy: forwards JSON-RPC to futurenet and logs simulateTransaction results.
import http from 'node:http';
import { appendFileSync } from 'node:fs';
const UP = 'https://rpc-futurenet.stellar.org';
http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  const r = await fetch(UP, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  const text = await r.text();
  try {
    const q = JSON.parse(body);
    if (q.method === 'simulateTransaction') {
      const j = JSON.parse(text).result || {};
      appendFileSync(new URL('./sim-futurenet.log', import.meta.url), JSON.stringify({ minResourceFee: j.minResourceFee, error: (j.error || '').slice(0, 1500), cost: j.cost, transactionData: (j.transactionData || '').slice(0, 2000), stateChanges: (j.stateChanges || []).length, restore: !!j.restorePreamble }) + '\n');
    }
  } catch {}
  res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(text);
}).listen(8098, () => console.log('proxy on 8098'));
