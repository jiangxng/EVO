export const coreConsoleHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EVO Core Console</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f6f7f9;color:#1f2328}
main{max-width:1180px;margin:0 auto;padding:28px 18px 48px}
header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:24px}
h1{margin:0 0 6px;font-size:30px}.muted{color:#667085}.badge{display:inline-block;padding:5px 9px;border:1px solid #d0d5dd;border-radius:999px;background:white;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin:18px 0}
.card{background:white;border:1px solid #e4e7ec;border-radius:12px;padding:16px}
.card h3{margin:0 0 8px}.ok{color:#067647}.draft{color:#b54708}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
table{width:100%;border-collapse:collapse;background:white;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden}
th,td{text-align:left;padding:11px 12px;border-bottom:1px solid #eef0f2;font-size:14px}th{background:#fafafa}
section{margin-top:26px}code{background:#f2f4f7;padding:2px 5px;border-radius:5px}
</style>
</head>
<body>
<main>
<header>
<div><h1>EVO Core Console</h1><div class="muted">最小企业运行底座：BusinessData → Posting Rule → Ledger Entry → Balance → Replay</div></div>
<div><span class="badge">Core Boundary Audit v0.1</span></div>
</header>

<div class="grid">
<div class="card"><h3>Runtime</h3><div id="health" class="muted">checking...</div></div>
<div class="card"><h3>Kernel</h3><div class="ok">Independent composition extracted</div><div class="muted">Optional business modules are outside target Core boundary.</div></div>
<div class="card"><h3>Package Model</h3><div class="draft">Contract evolving</div><div class="muted">Definition packages + protocol-isolated runtime extensions.</div></div>
<div class="card"><h3>Integration Goal</h3><div class="mono">EVO ↔ Eidos · EC knowledge · 3EC dev workspace</div><div class="muted">Public contracts first; 3EC is temporary development coordination.</div></div>
</div>

<section>
<h2>Core Public Capability Families</h2>
<table>
<thead><tr><th>Capability</th><th>Purpose</th><th>Status</th></tr></thead>
<tbody id="caps"></tbody>
</table>
</section>

<section>
<h2>Public Contract Surface</h2>
<table>
<thead><tr><th>Contract</th><th>Role</th><th>Status</th></tr></thead>
<tbody>
<tr><td><code>/health/live</code></td><td>Liveness</td><td class="ok">Available</td></tr>
<tr><td><code>/health/ready</code></td><td>Readiness</td><td class="ok">Available</td></tr>
<tr><td><code>/api/v1/core/capabilities</code></td><td>Machine-readable Core capability catalog</td><td class="ok">Available</td></tr>
<tr><td><code>Enterprise Package OpenAPI v0.1</code></td><td>Definition package validation / plan / deployment contract</td><td class="draft">Existing contract, being aligned</td></tr>
<tr><td><code>Ledger / Balance / Replay API</code></td><td>Stable Core operational protocol</td><td class="draft">Protocol freeze next</td></tr>
<tr><td><code>Snapshot / Change Feed</code></td><td>External projection / reporting / Eidos / 3EC data exit</td><td class="draft">Planned</td></tr>
</tbody>
</table>
</section>

<section>
<h2>What 3EC Can Test First</h2>
<div class="card">
<ol>
<li>Core health and protocol version discovery.</li>
<li>Capability discovery without assuming Sales / Finance / Manufacturing exists.</li>
<li>Package contract validation and dependency planning.</li>
<li>Later: install package → capability appears → execute Core API → verify ledger/balance.</li>
</ol>
</div>
</section>
</main>
<script>
async function load(){
  try{
    const h=await fetch('/health/ready'); const hj=await h.json();
    document.getElementById('health').innerHTML=h.ok?'<span class="ok">READY</span> · '+(hj.version??''):'<span class="draft">NOT READY</span>';
  }catch{document.getElementById('health').textContent='unavailable'}
  try{
    const r=await fetch('/api/v1/core/capabilities'); const d=await r.json();
    document.getElementById('caps').innerHTML=d.capabilities.map(c=>'<tr><td class="mono">'+c.id+'</td><td>'+c.description+'</td><td class="'+(c.status==='AVAILABLE'?'ok':'draft')+'">'+c.status+'</td></tr>').join('');
  }catch{document.getElementById('caps').innerHTML='<tr><td colspan="3">capability catalog unavailable</td></tr>'}
}
load();
</script>
</body></html>`;
