# backend/routers/indicators.py
from fastapi import APIRouter, Query, HTTPException
import json, inspect, ccxt, pandas as pd, pandas_ta as ta
from functools import lru_cache

router = APIRouter()

binance = ccxt.binance({'enableRateLimit': True})

# ---------- pandas-ta sürüm uyarlaması ----------
@lru_cache
def _all_funcs():
    if hasattr(ta, "indicators") and hasattr(ta.indicators, "functions"):
        return ta.indicators.functions          # >= 0.4
    funcs = {}
    for name, fn in inspect.getmembers(ta, inspect.isfunction):
        if name.startswith("_"):                # yardımcı fonksiyonlar değil
            continue
        funcs[name] = fn                        # 0.3.x
    return funcs
# -----------------------------------------------

def calc_indicator(symbol: str, interval: str, name: str, kwargs: dict):
    df = pd.DataFrame(binance.fetch_ohlcv(symbol, timeframe=interval),
                      columns=["time","open","high","low","close","volume"])
    df["time"] = pd.to_datetime(df["time"], unit="ms")
    fn_dict = _all_funcs()
    if name not in fn_dict:
        raise ValueError(f"{name} fonksiyonu pandas-ta içinde yok")
    series = fn_dict[name](df["close"], **kwargs)

    # Çok sütunlu (DataFrame) dönerse ilk sütunu seç
    if isinstance(series, pd.DataFrame):
        series = series.iloc[:, 0]

    return [{"time": t.isoformat(), "value": v if pd.notna(v) else None}
            for t, v in series.items()]

# ---------  API endpoint  -------------------------------------------------
@router.get("/{symbol:path}", summary="Get indicators for symbol")
async def indicators(
    symbol : str,
    interval: str = Query("4h"),
    name   : str = Query(..., description="sma, ema, rsi, bbands ..."),
    params : str = Query("",  description='JSON string {"length":20}')
):
    try:
        kwargs = json.loads(params) if params else {}
        data   = calc_indicator(symbol.upper(), interval, name.lower(), kwargs)
        return {"name": name.lower(), "params": kwargs, "data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
