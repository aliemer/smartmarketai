from fastapi import APIRouter, Query
from services.market_data import search_symbols

router = APIRouter()

@router.get("/")
async def symbols(q:str|None = Query(None, min_length=1, max_length=10)):
    return search_symbols(q)
