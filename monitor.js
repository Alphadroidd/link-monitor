const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 10000;
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_YhHdr1VU_Lim3gaHots12ZffjkrS8MxZq';
const ALERT_EMAIL = 'Gabriels.fix@gmail.com';

const GROUPS = [
  { name: 'Compra Certa Fatura Incerta', emoji: '🛒', url: 'https://chat.whatsapp.com/JDmIbXGked57w5AXBad4Ea?s=cl&p=i&ilr=1' },
  { name: 'Clica Aqui Amiga',            emoji: '👆', url: 'https://chat.whatsapp.com/IXMhWLeYe3YBR6lJw9fwsV' },
  { name: 'Upgrades Premium',            emoji: '⚡', url: 'https://chat.whatsapp.com/Lt1tgJhEtJHJegC11jly2y?s=cl&p=i&ilr=1' },
  { name: 'Slice de Promoções',          emoji: '🎯', url: 'https://chat.whatsapp.com/FcQn3i5f9KT84Rj2R8ADyG?s=cl&p=i&ilr=1' },
];

const status = {};
GROUPS.forEach(g => { status[g.name] = { ok: null, lastCheck: null, alerted: false, history: [] }; });

function checkLink(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      const body = [];
      res.on('data', chunk => body.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(body).toString();
        const invalid = text.includes('invalid') || text.includes('redefinido') ||
                        text.includes('expired') || res.statusCode === 404;
        resolve({ ok: !invalid, statusCode: res.statusCode });
      });
    });
    req.on('error', () => resolve({ ok: false, statusCode: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, statusCode: 0 }); });
  });
}

function sendAlert(group) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      from: 'Monitor <onboarding@resend.dev>',
      to: [ALERT_EMAIL],
      subject: `🚨 Link inválido: ${group.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0c0f;color:#e8eaf0;padding:32px;border-radius:12px">
          <h2 style="color:#ff4d4d;margin-bottom:16px">🚨 Link caiu!</h2>
          <p style="margin-bottom:12px">O grupo <strong>${group.emoji} ${group.name}</strong> está com o link inválido.</p>
          <div style="background:#13161b;border:1px solid #1e2329;border-radius:8px;padding:16px;margin-bottom:20px;word-break:break-all;font-size:13px;color:#6b7280">${group.url}</div>
          <p style="margin-bottom:20px;color:#9ca3af">Atualize o link no site <strong>descontos.pages.dev</strong> e no monitor o quanto antes.</p>
          <a href="https://link-monitor-v5in.onrender.com" style="background:#ffc107;color:#0a0c0f;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Ver painel do monitor</a>
        </div>
      `
    });

    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        console.log(`Email enviado para ${ALERT_EMAIL}: ${res.statusCode}`);
        resolve(res.statusCode);
      });
    });
    req.on('error', (e) => { console.error('Erro email:', e); resolve(0); });
    req.write(body);
    req.end();
  });
}

async function runChecks() {
  const now = new Date();
  console.log(`[${now.toISOString()}] Iniciando checks...`);
  for (const group of GROUPS) {
    const result = await checkLink(group.url);
    const prev = status[group.name].ok;

    status[group.name].lastCheck = now.toISOString();
    status[group.name].ok = result.ok;
    status[group.name].history.unshift({ time: now.toISOString(), ok: result.ok });
    if (status[group.name].history.length > 24) status[group.name].history.pop();

    // Envia email só quando MUDA de ativo para inativo (evita spam)
    if (prev === true && result.ok === false && !status[group.name].alerted) {
      status[group.name].alerted = true;
      await sendAlert(group);
    }
    // Reset do alerta quando volta a funcionar
    if (result.ok === true) status[group.name].alerted = false;

    console.log(`  ${result.ok ? '✅' : '❌'} ${group.name}`);
  }
}

runChecks();
setInterval(runChecks, 60 * 60 * 1000);

app.get('/api/status', (req, res) => {
  res.json({ groups: GROUPS.map(g => ({ ...g, ...status[g.name] })), updatedAt: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="60">
<title>Monitor — Descontos</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--bg:#0a0c0f;--surface:#13161b;--border:#1e2329;--green:#00d084;--red:#ff4d4d;--yellow:#ffc107;--text:#e8eaf0;--muted:#6b7280}
  body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh}
  header{background:var(--surface);border-bottom:1px solid var(--border);padding:18px 28px;display:flex;align-items:center;justify-content:space-between}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 2s infinite;margin-right:12px}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  h1{font-size:17px;font-weight:700}h1 span{color:var(--yellow)}
  .upd{font-size:11px;color:var(--muted)}
  main{max-width:860px;margin:0 auto;padding:28px 18px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px}
  .sc{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
  .sc .lbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
  .sc .val{font-size:30px;font-weight:900}
  .sc.ok .val{color:var(--green)}.sc.err .val{color:var(--red)}.sc.n .val{color:var(--text)}
  .cards{display:grid;gap:12px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:20px 22px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px}
  .card.ok{border-left:3px solid var(--green)}.card.err{border-left:3px solid var(--red)}.card.loading{border-left:3px solid var(--yellow)}
  .em{font-size:26px}
  .nm{font-size:14px;font-weight:600;margin-bottom:4px}
  .url{font-size:10px;color:var(--muted);word-break:break-all}
  .badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:4px 11px;border-radius:20px;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px}
  .badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
  .badge.ok{background:rgba(0,208,132,.15);color:var(--green)}.badge.err{background:rgba(255,77,77,.15);color:var(--red)}.badge.loading{background:rgba(255,193,7,.15);color:var(--yellow)}
  .tm{font-size:10px;color:var(--muted);text-align:right}
  .hist{display:flex;gap:3px;margin-top:8px}
  .hd{width:9px;height:9px;border-radius:2px;background:var(--border)}
  .hd.ok{background:var(--green);opacity:.7}.hd.err{background:var(--red);opacity:.7}
  .footer{text-align:center;color:var(--muted);font-size:11px;margin-top:36px}
  .footer span{color:var(--yellow)}
  @media(max-width:600px){.card{grid-template-columns:auto 1fr}.cr{grid-column:2}}
</style>
</head>
<body>
<header>
  <div style="display:flex;align-items:center"><div class="dot"></div><h1>Monitor <span>Descontos</span></h1></div>
  <span class="upd" id="upd">Carregando...</span>
</header>
<main>
  <div class="summary">
    <div class="sc ok"><div class="lbl">Ativos</div><div class="val" id="cok">—</div></div>
    <div class="sc err"><div class="lbl">Inativos</div><div class="val" id="cerr">—</div></div>
    <div class="sc n"><div class="lbl">Total</div><div class="val" id="ctot">—</div></div>
  </div>
  <div class="cards" id="cards"><div style="color:var(--muted);text-align:center;padding:40px">Carregando...</div></div>
</main>
<div class="footer">Checa a cada <span>1 hora</span> · Email: ${ALERT_EMAIL}</div>
<script>
function fmt(iso){if(!iso)return'—';return new Date(iso).toLocaleString('pt-BR',{timeZone:'America/Belem',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}
async function load(){
  try{
    const d=await(await fetch('/api/status')).json();
    document.getElementById('upd').textContent='Atualizado '+fmt(d.updatedAt);
    const ok=d.groups.filter(g=>g.ok===true).length;
    const err=d.groups.filter(g=>g.ok===false).length;
    document.getElementById('cok').textContent=ok;
    document.getElementById('cerr').textContent=err;
    document.getElementById('ctot').textContent=d.groups.length;
    document.getElementById('cards').innerHTML=d.groups.map(g=>{
      const s=g.ok===null?'loading':g.ok?'ok':'err';
      const lbl=g.ok===null?'Verificando':g.ok?'Ativo':'Link inválido';
      const dots=(g.history||[]).slice(0,20).map(h=>\`<div class="hd \${h.ok?'ok':'err'}" title="\${fmt(h.time)}"></div>\`).join('');
      const emp=Array(Math.max(0,20-(g.history||[]).length)).fill('<div class="hd"></div>').join('');
      return\`<div class="card \${s}"><div class="em">\${g.emoji}</div><div><div class="nm">\${g.name}</div><div class="url">\${g.url}</div><div class="hist">\${dots}\${emp}</div></div><div class="cr"><div class="badge \${s}">\${lbl}</div><div class="tm">Último check:<br>\${fmt(g.lastCheck)}</div></div></div>\`;
    }).join('');
  }catch(e){console.error(e)}
}
load();
setInterval(load,60000);
</script>
</body></html>`);
});

app.listen(PORT, () => console.log(`Monitor rodando na porta ${PORT}`));
