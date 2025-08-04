import ccxt, functools, time

binance = ccxt.binance({'enableRateLimit': True})

# 5 dakika (300 sn) TTL’li sembol önbelleği
@functools.lru_cache
def _cached_symbols():
    return list(binance.load_markets().keys()), time.time()

def get_all_symbols():
    return _cached_symbols()[0]

def search_symbols(q:str|None):
    syms = get_all_symbols()
    if not q:
        return syms[:200]
    q = q.upper()
    return [s for s in syms if q in s][:50]
