import ccxt, pandas as pd, pandas_ta as ta
from functools import lru_cache, partial

binance = ccxt.binance({'enableRateLimit': True})

@lru_cache
def _all_funcs():
    return {n:fn for n,fn in ta.indicators.functions.items()}

def _ohlcv(symbol:str, interval:str, limit:int=500) -> pd.Series:
    o = binance.fetch_ohlcv(symbol, timeframe=interval, limit=limit)
    df = pd.DataFrame(o, columns="ts o h l c v".split())
    df.ts = pd.to_datetime(df.ts, unit="ms")
    df.set_index("ts", inplace=True)
    return df["c"]

def calc_indicator(symbol:str, interval:str, name:str, params:dict):
    funcs = _all_funcs()
    if name not in funcs:
        raise ValueError(f"{name} tanınmadı.")
    close = _ohlcv(symbol, interval)
    series = funcs[name](close, **params)
    series.name = name
    out = [{"time":t.isoformat(), "value":None if pd.isna(v) else float(v)}
           for t,v in series.items()]
    return out
