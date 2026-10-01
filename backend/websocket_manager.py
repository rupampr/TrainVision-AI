"""
Manages active WebSocket connections and broadcasts live train position
updates to all of them. Used by the /ws endpoint and the background
broadcast loop in main.py.
"""
import json
from typing import List

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, payload: dict):
        """Send to every connected client; silently drop ones that error out
        (they'll be cleaned up on their next disconnect event)."""
        dead = []
        message = json.dumps(payload)
        for ws in self.active:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()