// Binance 合约 WS 连通性探针
// 用途：部署到候选容器平台（Galaxy / dcdeploy 等），访问 /probe 看该出口 IP 能否连上 fstream
const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const FSTREAM_URL = 'wss://fstream.binance.com/stream?streams=btcusdt@markPrice@1s';

function probeOnce(timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; try { ws.terminate(); } catch (e) {} resolve(r); } };
    const ws = new WebSocket(FSTREAM_URL, { handshakeTimeout: timeoutMs });

    ws.on('unexpected-response', (req, res) => {
      let body = '';
      res.on('data', (c) => { if (body.length < 200) body += c; });
      res.on('end', () => done({
        ok: false, step: 'handshake', status: res.statusCode,
        server: res.headers.server || '', ms: Date.now() - t0, body: body.slice(0, 120)
      }));
      res.on('error', () => done({ ok: false, step: 'handshake', status: res.statusCode, ms: Date.now() - t0 }));
    });

    ws.on('open', () => {
      // 握手成功，等第一条行情推送（markPrice@1s 秒级必到）
      const timer = setTimeout(() => done({ ok: true, step: 'open-only', ms: Date.now() - t0, firstMsg: null }), 8000);
      ws.on('message', (data) => {
        clearTimeout(timer);
        const s = String(data);
        done({ ok: true, step: 'message', ms: Date.now() - t0, firstMsg: s.slice(0, 160) });
      });
    });

    ws.on('error', (e) => done({ ok: false, step: 'error', err: String(e.message || e).slice(0, 120), ms: Date.now() - t0 }));
    ws.on('close', (code) => { if (!settled) done({ ok: false, step: 'closed', code, ms: Date.now() - t0 }); });
  });
}

async function probeFull() {
  // 3 轮探测：命中任何一次 ok 即判定可通
  const tries = [];
  for (let i = 0; i < 3 && !tries.some(t => t.ok); i++) tries.push(await probeOnce(10000));
  return {
    verdict: tries.some(t => t.ok) ? 'REACHABLE' : 'BLOCKED',
    tries, ts: new Date().toISOString()
  };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (u.pathname === '/probe') {
    return res.end(JSON.stringify(await probeFull()));
  }
  // 根路径 + /health：健康检查用，轻量不探测
  res.end(JSON.stringify({ service: 'binance-ws-probe', endpoints: ['/probe'], ts: new Date().toISOString() }));
});
server.listen(PORT, () => console.log('probe listening on', PORT));
