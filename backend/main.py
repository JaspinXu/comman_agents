from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import create_router
from .runtime import Runtime, build_runtime


def create_app(runtime: Runtime | None = None) -> FastAPI:
    resolved_runtime = runtime or build_runtime()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        resolved_runtime.repository.initialize()
        yield

    application = FastAPI(title="comman_agents API", version="0.3.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=False,
        allow_methods=["GET", "PUT", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )
    application.include_router(create_router(resolved_runtime))
    application.state.runtime = resolved_runtime
    return application


app = create_app()
