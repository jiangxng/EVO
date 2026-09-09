export const demoConsoleHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EVO v0.9 Validation Console</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:1200px;margin:30px auto;padding:0 18px;background:#f7f7f8;color:#202124}
h1{margin-bottom:4px}.muted{color:#666}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin:20px 0}
.card{background:#fff;border:1px solid #ddd;border-radius:12px;padding:16px;box-shadow:0 1px 3px #00000010}
label{display:block;margin-top:8px;font-size:13px;color:#555}input,select{width:100%;box-sizing:border-box;padding:8px;margin-top:3px}
button{padding:9px 14px;margin:8px 6px 0 0;cursor:pointer}
pre{background:#111;color:#e8e8e8;padding:14px;border-radius:10px;overflow:auto;max-height:440px}
.ok{color:#067d3f;font-weight:600}.warn{color:#a15c00;font-weight:600}
</style>
</head>
<body>
<h1>EVO v0.9 Validation Console</h1>
<div class="muted">验证同一套 Command → BusinessData → Posting → Ledger → Work / Cost / Replay 核心链路。</div>

<div class="grid">
<div class="card">
<h3>销售订单审批</h3>
<label>Actor</label>
<select id="actor"><option value="HUMAN">Human / demo-user</option><option value="AI">AI / demo-agent</option></select>
<label>订单号</label><input id="orderNo" value="SO-1001">
<label>客户</label><input id="customer" value="Demo Customer">
<label>数量</label><input id="qty" value="20">
<label>金额</label><input id="amount" value="300.00">
<label>币种</label><input id="currency" value="USD">
<button onclick="approveOrder()">Approve</button>
</div>

<div class="card">
<h3>库存 / 成本</h3>
<label>产品</label><input id="product" value="P-100">
<label>仓库</label><input id="warehouse" value="HK">
<label>数量</label><input id="invQty" value="10">
<label>入库总成本</label><input id="invCost" value="100.00">
<button onclick="receiveInventory()">Receive</button>
<button onclick="shipInventory()">Ship 2</button>
<br>
<button onclick="recalc('FIFO')">FIFO Cost</button>
<button onclick="recalc('LIFO')">LIFO Cost</button>
<button onclick="recalc('MOVING_AVERAGE')">Moving Average</button>
</div>

<div class="card">
<h3>确定性 / Replay</h3>
<p>Full Replay 会清空派生 Ledger，再按 canonical key 重建。</p>
<button onclick="replay()">Full Replay</button>
<button onclick="catalog()">AI Command Catalog</button>
<button onclick="refresh()">Refresh Dashboard</button>
<div id="replayResult" class="muted"></div>
</div>
</div>

<h3>Dashboard</h3>
<pre id="output">loading...</pre>

<script>
async function api(path, body) {
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: {'content-type':'application/json'},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}
function actor() {
  const type = document.getElementById('actor').value;
  return type === 'AI'
    ? {type:'AI', id:'demo-agent'}
    : {type:'HUMAN', id:'demo-user'};
}
async function approveOrder(){
  await api('/api/v1/demo/sales-orders/approve',{
    actor:actor(),
    orderNo:orderNo.value,customer:customer.value,
    totalQuantity:Number(qty.value),totalAmount:amount.value,currency:currency.value
  }); await refresh();
}
async function receiveInventory(){
  await api('/api/v1/demo/inventory/receive',{
    actor:actor(),productId:product.value,warehouse:warehouse.value,
    quantity:Number(invQty.value),totalCost:invCost.value
  }); await refresh();
}
async function shipInventory(){
  await api('/api/v1/demo/inventory/ship',{
    actor:actor(),productId:product.value,warehouse:warehouse.value,quantity:2
  }); await refresh();
}
async function recalc(method){
  const data=await api('/api/v1/demo/cost/recalculate',{method});
  output.textContent=JSON.stringify(data,null,2);
}
async function replay(){
  const data=await api('/api/v1/demo/replay',{});
  replayResult.innerHTML = data.deterministic
    ? '<span class="ok">Replay deterministic ✓</span>'
    : '<span class="warn">Digest mismatch</span>';
  output.textContent=JSON.stringify(data,null,2);
}
async function catalog(){
  const data=await api('/api/v1/demo/ai/catalog');
  output.textContent=JSON.stringify(data,null,2);
}
async function refresh(){
  const data=await api('/api/v1/demo/dashboard');
  output.textContent=JSON.stringify(data,null,2);
}
refresh();
</script>
</body>
</html>`;
