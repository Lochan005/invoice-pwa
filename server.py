"""
Vercel serverless entrypoint at repo root.
Keeps implementation in backend/server.py so the Python function is discovered reliably.
"""
from backend.server import app  # noqa: F401
