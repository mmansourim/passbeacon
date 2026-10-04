"""FastAPI routes and lifecycle. Importing this module does not fetch TLEs."""
import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from . import __version__
from .catalog import STATIONS
from .settings import Settings
from .tracking import Tracker

def create_app(settings=None, tracker=None):
    settings = settings or Settings.from_env()
    tracker = tracker or Tracker(settings)
    clients = set()

    async def broadcast():
        while True:
            if clients:
                message={'type':'positions','timestamp':datetime.now(timezone.utc).isoformat(),
                    'data':tracker.positions(), 'status':tracker.status()}
                for ws in tuple(clients):
                    try: await asyncio.wait_for(ws.send_json(message),timeout=3)
                    except Exception: clients.discard(ws)
            await asyncio.sleep(1)

    @asynccontextmanager
    async def lifespan(app):
        await tracker.refresh()
        tasks=[asyncio.create_task(tracker.refresh_loop()),asyncio.create_task(broadcast())]
        try: yield
        finally:
            for task in tasks: task.cancel()
            for task in tasks:
                with suppress(asyncio.CancelledError): await task

    app=FastAPI(title='PassBeacon',version=__version__,lifespan=lifespan)
    app.state.tracker=tracker

    def satellite(sat_id):
        data=tracker.snapshot['satellites'].get(sat_id)
        if data is None: raise HTTPException(404,'Satellite not loaded; check /api/status')
        return data

    @app.get('/api/health')
    def health(): return {'service':'PassBeacon','version':__version__,'loaded':len(tracker.snapshot['satellites'])}

    @app.get('/api/status')
    def status(): return tracker.status()

    @app.get('/api/stations')
    def stations(): return [{'id':key,**value} for key,value in STATIONS.items()]

    @app.get('/api/satellites')
    def satellites():
        return [{k:data[k] for k in ('id','name','color')} for data in tracker.snapshot['satellites'].values()]

    @app.get('/api/satellites/{sat_id}')
    def detail(sat_id: str):
        data=satellite(sat_id)
        try: position=tracker.position(data)
        except Exception as exc: raise HTTPException(503,'Current position could not be calculated') from exc
        return {**{k:v for k,v in data.items() if k not in ('sat','passes','pass_errors')},**position}

    @app.get('/api/passes/{sat_id}')
    def passes(sat_id: str, gs: str='oran'):
        if gs not in STATIONS: raise HTTPException(404,'Unknown ground station')
        data=satellite(sat_id)
        if gs in data['pass_errors']: raise HTTPException(503,f"Pass calculation failed: {data['pass_errors'][gs]}")
        return {'satellite_id':sat_id,'ground_station':gs,'generated_at':data['generated_at'],
            'passes':data['passes'].get(gs,[]),'warnings':data['warnings']}

    @app.websocket('/ws/satellites')
    async def stream(ws: WebSocket):
        await ws.accept(); clients.add(ws)
        try:
            while True: await ws.receive_text()
        except WebSocketDisconnect: pass
        finally: clients.discard(ws)

    if settings.frontend_dir.is_dir():
        app.mount('/',StaticFiles(directory=settings.frontend_dir,html=True),name='frontend')
    return app
