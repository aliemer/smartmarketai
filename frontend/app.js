/* ==================  SmartMarketAI – frontend/app.js  ================== */

const API = "http://127.0.0.1:8000";
const TZ  = Intl.DateTimeFormat().resolvedOptions().timeZone || "auto";

let mode            = "coin";
let currentSymbol   = "BTC/USDT";
let currentInterval = "4h";
let ALL_SYMBOLS     = [];

let liveWS = null;
let mainChart, cSeries, vSeries;
let indicatorSeries = [];

const IND_KEY = (sym, tf) => `IND_${sym}_${tf}`;

/* ---------------- Başlangıç ---------------- */
window.addEventListener("DOMContentLoaded", () => {
  loadSymbolList();

  document.getElementById("btn-coin").onclick = () => {
    mode = "coin"; currentSymbol = "BTC/USDT"; showMarket();
  };
  document.getElementById("btn-bist").onclick = () => {
    mode = "bist"; currentSymbol = "GARAN";   showMarket();
  };
  document.getElementById("btn-news").onclick = showNews;

  document.getElementById("search").oninput  = e => loadSymbolList(e.target.value.trim());
  /* ind-add düğmesi renderPage çağrısında yeniden oluşturulduğundan
     bağlayıcıyı her seferinde restoreIndicators’dan sonra tekrar ekleyeceğiz. */
});

/* -------------- Sağ panel sembol listesi -------------- */
async function loadSymbolList(q = "") {
  const url  = q ? `${API}/symbols?q=${encodeURIComponent(q)}` : `${API}/symbols`;
  const res  = await fetch(url);
  const list = await res.json();
  if (!q) ALL_SYMBOLS = list;

  const ul = document.getElementById("symbol-list");
  ul.innerHTML = list.map(s => `<li>${s}</li>`).join("");
  [...ul.children].forEach(li =>
    li.onclick = () => { mode = "coin"; currentSymbol = li.textContent; showMarket(); });
}

/* ---------------- Pazar Göster ---------------- */
async function showMarket() {
  if (liveWS) { liveWS.close(); liveWS = null; }

  const ep  = mode === "coin" ? "coin" : "bist";
  const res = await fetch(`${API}/${ep}/${encodeURIComponent(currentSymbol)}?interval=${currentInterval}`);
  if (!res.ok) { alert(await res.text()); return; }

  const data = await res.json();
  renderPage(data);
  if (mode === "coin") openLiveSocket();
}

/* ---------------- Sayfa & Grafik ---------------- */
function renderPage(data) {
  const tfCoin = ["1m","5m","15m","30m","1h","4h","12h","1D","1W","1M"];
  const tfBist = [...tfCoin,"1Y"];
  const tfs    = mode === "coin" ? tfCoin : tfBist;
  if (!tfs.includes(currentInterval)) currentInterval = "4h";

  const opts = tfs.map(tf =>
      `<option value="${tf}" ${tf === currentInterval ? "selected" : ""}>${tf}</option>`).join("");

  /* === HTML === */
  document.getElementById("content").innerHTML = `
    <h2>${currentSymbol}${mode === "bist" ? ".IS" : ""} – ${currentInterval}
      <select id="tf-select">${opts}</select>

      <!-- Indicator picker -->
      <span id="ind-picker">
        <select id="ind-name">
          <option value="sma">SMA</option>
          <option value="ema">EMA</option>
          <option value="rsi">RSI</option>
          <option value="bollinger">Bollinger</option>
          <option value="macd">MACD</option>
        </select>
        <input id="ind-param" value='{"length":20}' />
        <button id="ind-add" type="button">➕</button>
      </span>
    </h2>

    <div class="chart-wrapper">
      <div id="chart-candle"></div>
      <div id="chart-volume"></div>
    </div>`;

  /* === Olay bağlayıcıları === */
  document.getElementById("tf-select").onchange = e => {
    currentInterval = e.target.value; showMarket();
  };
  document.getElementById("ind-add").onclick = onAddIndicator;

  /* === Grafik çiz ve saklı indikatörleri yükle === */
  drawCharts(data.candles, data.formations);
  restoreIndicators();
}

/* ---------------- Grafik ---------------- */
function drawCharts(candles, formations) {
  const cd = document.getElementById("chart-candle");
  const vd = document.getElementById("chart-volume");

  const cChart = LightweightCharts.createChart(cd,{
    localization:{timezone:TZ},
    layout:{background:{color:"#121212"},textColor:"#ddd"},
    grid:{vertLines:{color:"#222"},horzLines:{color:"#222"}},
    rightPriceScale:{borderColor:"#333"},
    timeScale:{borderColor:"#333",timeVisible:true,secondsVisible:false}
  });
  mainChart = cChart;

  cSeries = cChart.addCandlestickSeries({
    upColor:'#4caf50', downColor:'#ff5252',
    wickUpColor:'#4caf50', wickDownColor:'#ff5252',
    borderVisible:false,
    priceFormat:{type:'price',minMove:0.00001}
  });

  const vChart = LightweightCharts.createChart(vd,{
    localization:{timezone:TZ},
    layout:{background:{color:"#121212"},textColor:"#ddd"},
    grid:{vertLines:{color:"#222"},horzLines:{color:"#222"}},
    rightPriceScale:{visible:false},
    timeScale:{visible:false}
  });
  vSeries = vChart.addHistogramSeries({priceFormat:{type:'volume'}});

  /* Veri dönüştür */
  const cData = candles.map(c => ({
    time : Date.parse(c.ts+"Z")/1000,
    open : +c.open, high:+c.high, low:+c.low, close:+c.close
  }));
  const vData = candles.map(c => ({
    time : Date.parse(c.ts+"Z")/1000,
    value: +c.volume,
    color: +c.close >= +c.open ? '#4caf50' : '#ff5252'
  }));

  cSeries.setData(cData);
  vSeries.setData(vData);
  cChart.timeScale().subscribeVisibleTimeRangeChange(r =>
      vChart.timeScale().setVisibleRange(r));

  /* Son formasyon zemin boyama */
  if (formations?.length){
    const last = cData.at(-1);
    const col  = formations[0].type === "bullish"
                 ? 'rgba(0,150,255,.15)' : 'rgba(255,140,0,.15)';
    cChart.addAreaSeries({lineColor:'transparent',topColor:col,bottomColor:col})
          .setData([{time:last.time,value:last.high}]);
  }

  /* Önceki indikatör serilerini temizle */
  indicatorSeries.forEach(o => o.serie.applyOptions({visible:false}));
  indicatorSeries = [];
}

/* ---------------- Live WebSocket ---------------- */
function tfStream(tf){
  return {"1m":"1m","5m":"5m","15m":"15m","30m":"30m",
          "1h":"1h","4h":"4h","12h":"12h",
          "1D":"1d","1W":"1w","1M":"1M"}[tf] || "1m";
}
function openLiveSocket(){
  const stream = currentSymbol.toLowerCase().replace("/","") +
                 "@kline_" + tfStream(currentInterval);
  liveWS = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
  liveWS.onmessage = ev =>{
    const k = JSON.parse(ev.data).k;
    if(!k) return;
    const t  = k.t/1000,
          up = parseFloat(k.c) >= parseFloat(k.o);
    cSeries.update({time:t,open:+k.o,high:+k.h,low:+k.l,close:+k.c});
    vSeries.update({time:t,value:+k.v,color: up?'#4caf50':'#ff5252'});
  };
}

/* ---------------- Indicator Picker ---------------- */
function onAddIndicator(){
  if (!cSeries){                      // grafik henüz yoksa
    alert("Grafik hazır olduktan sonra ekleyebilirsin");
    return;
  }

  const nameEl   = document.getElementById("ind-name");
  const paramEl  = document.getElementById("ind-param");

  const name = nameEl.value.trim().toLowerCase();   // sma, ema…
  let   txt  = paramEl.value.trim();                // kullanıcının yazdıkları

  /* —— tek sayı veya boş bırakıldıysa otomatik JSON hazırla —— */
  if (/^\d+$/.test(txt)) txt = `{"length":${txt}}`; // “20”  → {"length":20}
  if (txt === "")        txt = "{}";                // boş  → {}

  let params = {};
  try {
    params = JSON.parse(txt);
  } catch (e){
    alert("Parametre JSON formatında olmalı (örn: {\"length\":20})");
    return;
  }

  addIndicator(name, params, true);
}
async function addIndicator(name,params={},save=true){
  const q   = new URLSearchParams({
      name,
      interval:currentInterval,
      params:JSON.stringify(params)
  });
  const res = await fetch(`${API}/indicators/${encodeURIComponent(currentSymbol)}?${q}`);
  if(!res.ok){alert(await res.text());return;}
  const js  = await res.json();

  const color = "#"+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,"0");
  const serie = mainChart.addLineSeries({color,lineWidth:1});
  const data  = js.data
                .filter(d=>d.value!=null)
                .map  (d=>({time:Date.parse(d.time)/1000,value:d.value}));
  serie.setData(data);

  indicatorSeries.push({name,params,serie});
  if(save) saveIndicators();
}
function saveIndicators(){
  localStorage.setItem(
    IND_KEY(currentSymbol,currentInterval),
    JSON.stringify(indicatorSeries.map(o=>({name:o.name,params:o.params})))
  );
}
function restoreIndicators(){
  const txt = localStorage.getItem(IND_KEY(currentSymbol,currentInterval));
  if(!txt) return;
  JSON.parse(txt).forEach(o => addIndicator(o.name,o.params,false));
}

/* ---------------- Haber ---------------- */
async function showNews(){
  const q = prompt("Hangi kelimeyi arayalım?");
  if(!q) return;
  const res  = await fetch(`${API}/news/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  document.getElementById("content").innerHTML =
    `<h2>"${q}" için Haberler</h2>`+
    `<ul>${data.map(n=>`<li><a href="${n.link}" target="_blank">${n.title}</a>`+
                     `<small>${n.published}</small></li>`).join("")}</ul>`;
}
