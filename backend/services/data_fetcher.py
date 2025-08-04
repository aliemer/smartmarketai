import pandas as pd, numpy as np, ccxt, yfinance as yf

# Binance client
binance = ccxt.binance({'enableRateLimit': True})

# --- Binance interval normalizasyon tablosu ---
_BINANCE_TF = {
    "1m":"1m","5m":"5m","15m":"15m","30m":"30m",
    "1h":"1h","4h":"4h","12h":"12h",
    "1d":"1d","1D":"1d",
    "1w":"1w","1W":"1w",
    "1M":"1M",
}
def _bn_tf(tf:str) -> str:
    return _BINANCE_TF.get(tf.lower(), "4h")

# ---------- Coin OHLCV ----------
async def get_coin_candles(symbol:str, interval:str):
    tf = _bn_tf(interval)
    ohlcv = binance.fetch_ohlcv(symbol.upper(), timeframe=tf, limit=500)
    df = pd.DataFrame(ohlcv, columns=["ts","open","high","low","close","volume"])
    df.ts = pd.to_datetime(df.ts, unit="ms")
    return df.to_dict(orient="records")

# ---------- BIST OHLCV ----------
def _map_interval(intv:str) -> str:
    return {
        "1m":"1m","5m":"5m","15m":"15m","30m":"30m",
        "1h":"60m","4h":"240m","12h":"1d",
        "1D":"1d","1W":"1wk","1M":"1mo","1Y":"1y"
    }.get(intv,"60m")

async def get_bist_candles(symbol:str, interval:str):
    yf_symbol = symbol + ".IS"
    df = yf.download(yf_symbol, period="1y", interval=_map_interval(interval))
    df = df.reset_index().rename(columns={
        "Date":"ts","Open":"open","High":"high","Low":"low",
        "Close":"close","Volume":"volume"})
    return df.to_dict(orient="records")

# ---------- Basit formasyon örneği ----------
def detect_formations(records):
    closes = np.array([r["close"] for r in records])
    if len(closes) < 2: return []
    change = (closes[-1]-closes[-2]) / closes[-2]
    if change > 0.05:
        return [{"type":"bullish","strength":round(change*100,2)}]
    if change < -0.05:
        return [{"type":"bearish","strength":round(change*100,2)}]
    return []
