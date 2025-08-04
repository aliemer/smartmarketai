from fastapi import APIRouter, Query
from services.news_scraper import news_search

router = APIRouter()

@router.get("/search")
async def search_news(q:str = Query(..., min_length=2)):
    return await news_search(q)
