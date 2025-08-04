from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import coin, bist, news, symbols, indicators

app = FastAPI(title="SmartMarketAI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(coin.router,        prefix="/coin",       tags=["Coin"])
app.include_router(bist.router,        prefix="/bist",       tags=["BIST100"])
app.include_router(news.router,        prefix="/news",       tags=["News"])
app.include_router(symbols.router,     prefix="/symbols",    tags=["Symbols"])
app.include_router(indicators.router,  prefix="/indicators", tags=["Indicators"])

@app.get("/")
async def root():
    return {"msg":"Merhaba, SmartMarketAI çalışıyor 🐣"}
from fastapi import FastAPI
from routers.indicators import router as indicators_router   #  ← ekle

app = FastAPI()

app.include_router(indicators_router, prefix="/indicators", tags=["Indicators"])
