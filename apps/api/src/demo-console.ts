export const demoConsoleHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EVO v1.0.0-alpha.2 Reference Flow</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:1280px;margin:28px auto;padding:0 18px;background:#f7f7f8;color:#202124}
h1{margin-bottom:4px}.muted{color:#666}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin:20px 0}.card{background:#fff;border:1px solid #ddd;border-radius:12px;padding:16px;box-shadow:0 1px 3px #00000010}label{display:block;margin-top:8px;font-size:13px;color:#555}input,select{width:100%;box-sizing:border-box;padding:8px;margin-top:3px}button{padding:9px 14px;margin:8px 6px 0 0;cursor:pointer}pre{background:#111;color:#e8e8e8;padding:14px;border-radius:10px;overflow:auto;max-height:520px}.ok{color:#067d3f;font-weight:600}.warn{color:#a15c00;font-weight:600}
</style>
</head>
<body>
<h1>EVO v1.0.0-alpha.2 Reference Flow</h1>
<div class="muted">业务语义链：Sales Order → Production Completion → Shipment → Cost → Replay。库存变化必须有明确业务原因。</div>
<div class="grid">
<div class="card"><h3>1. 销售订单审批</h3>
<label>Actor</label><select id="actor"><option value="HUMAN">Human / demo-user</option><option value="AI">AI / demo-agent</option></select>
<label>订单号</label><input id="orderNo" value="SO-1001"><label>客户</label><input id="customer" value="Demo Customer"><label>物料/商品</label><input id="product" value="P-100"><label>数量</label><input id="qty" value="10"><label>单价</label><input id="unitPrice" value="100.00"><label>总金额</label><input id="amount" value="1000.00"><label>币种</label><input id="currency" value="USD"><button onclick="approveOrder()">Approve</button></div>
<div class="card"><h3>2. 生产完工</h3><p class="muted">这是明确的“生产完工入库”，不是通用 Receive。</p><label>仓库</label><input id="warehouse" value="HK"><label>完工数量</label><input id="prodQty" value="10"><label>完工总成本</label><input id="prodCost" value="100.00"><button onclick="completeProduction()">Complete Production</button></div>
<div class="card"><h3>3. 销售发货 / 成本</h3><label>发货单号</label><input id="shipmentNo" value="SHIP-1001"><label>发货数量</label><input id="shipQty" value="2"><button onclick="ship()">Ship</button><br><button onclick="recalc('FIFO')">FIFO Cost</button><button onclick="recalc('LIFO')">LIFO Cost</button><button onclick="recalc('MOVING_AVERAGE')">Moving Average</button></div>
<div class="card"><h3>4. Replay / AI</h3><p>Full Replay 按 canonical key 重建派生 Ledger。</p><button onclick="replay()">Full Replay</button><button onclick="catalog()">AI Command Catalog</button><button onclick="refresh()">Refresh Dashboard</button><div id="replayResult" class="muted"></div></div>
</div>
<h3>Dashboard</h3><pre id="output">loading...</pre>
<script>
async function api(path, body){const r=await fetch(path,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(JSON.stringify(data));return data}
function actorObj(){return actor.value==='AI'?{type:'AI',id:'demo-agent'}:{type:'HUMAN',id:'demo-user'}}
async function approveOrder(){await api('/api/v1/demo/sales-orders/approve',{actor:actorObj(),orderNo:orderNo.value,customer:customer.value,productId:product.value,quantity:Number(qty.value),unitPrice:unitPrice.value,totalAmount:amount.value,currency:currency.value});await refresh()}
async function completeProduction(){await api('/api/v1/demo/production/complete',{actor:actorObj(),orderNo:orderNo.value,customer:customer.value,productId:product.value,warehouse:warehouse.value,quantity:Number(prodQty.value),totalCost:prodCost.value});await refresh()}
async function ship(){await api('/api/v1/demo/shipments/create',{actor:actorObj(),shipmentNo:shipmentNo.value,orderNo:orderNo.value,customer:customer.value,productId:product.value,warehouse:warehouse.value,quantity:Number(shipQty.value)});await refresh()}
async function recalc(method){const data=await api('/api/v1/demo/cost/recalculate',{method});output.textContent=JSON.stringify(data,null,2)}
async function replay(){const data=await api('/api/v1/demo/replay',{});replayResult.innerHTML=data.deterministic?'<span class="ok">Replay deterministic ✓</span>':'<span class="warn">Digest mismatch</span>';output.textContent=JSON.stringify(data,null,2)}
async function catalog(){output.textContent=JSON.stringify(await api('/api/v1/demo/ai/catalog'),null,2)}
async function refresh(){output.textContent=JSON.stringify(await api('/api/v1/demo/dashboard'),null,2)}
refresh();
</script></body></html>`;
