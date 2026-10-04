import logging
import uvicorn
from .settings import Settings
from .app import create_app

def main():
    logging.basicConfig(level=logging.INFO)
    settings=Settings.from_env()
    uvicorn.run(create_app(settings),host=settings.host,port=settings.port)

if __name__ == '__main__': main()
