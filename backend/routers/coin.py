from fastapi import APIRouter, HTTPException
from services.data_fetcher import get_coin_candles, detect_formations

router = APIRouter()

@router.get("/{symbol:path}")
async def coin_info(symbol:str, interval:str="4h"):
    try:
        candles = await get_coin_candles(symbol, interval)
        forms   = detect_formations(candles)
        return {"candles":candles,"formations":forms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
