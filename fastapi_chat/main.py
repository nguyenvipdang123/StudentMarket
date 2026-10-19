"""Realtime transport only. Next.js owns authentication and business APIs."""
import asyncio
import json
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "frontend" / ".env.local")
SECRET = os.environ.get("CHAT_TICKET_SECRET", "")
ORIGIN = os.environ.get("APP_ORIGIN", "http://localhost:3000").rstrip("/")
pool = None
rooms = defaultdict(dict)

@asynccontextmanager
async def lifespan(app):
    global pool
    if len(SECRET) < 32:
        raise RuntimeError("CHAT_TICKET_SECRET must contain at least 32 characters")
    max_connections = int(os.environ.get("PG_POOL_MAX", "5"))
    if not 2 <= max_connections <= 20:
        raise RuntimeError("PG_POOL_MAX must be between 2 and 20")
    ssl = os.environ.get("PG_SSL_MODE")
    if ssl and ssl not in ("disable", "verify-full"):
        raise RuntimeError("PG_SSL_MODE must be disable or verify-full")
    options = {"connect_timeout": 5}
    if ssl:
        options["sslmode"] = ssl
    if os.environ.get("DATABASE_URL"):
        pool = ThreadedConnectionPool(1, max_connections, dsn=os.environ["DATABASE_URL"], **options)
    else:
        pool = ThreadedConnectionPool(1, max_connections, host=os.environ.get("PG_HOST", "localhost"),
            port=os.environ.get("PG_PORT", "5432"), dbname=os.environ.get("PG_DATABASE", "student_market"),
            user=os.environ.get("PG_USER", "postgres"), password=os.environ.get("PG_PASSWORD"), **options)
    try:
        yield
    finally:
        pool.closeall()

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)

def db_work(work):
    connection = pool.getconn()
    try:
        with connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                return work(cursor)
    finally:
        pool.putconn(connection)

def session_email(sid):
    def work(cursor):
        cursor.execute("""SELECT a.email FROM sessions s JOIN auth_identities a ON a.id=s.account_id
            WHERE s.token_hash=%s AND s.expires_at>%s AND a.status='verified'""",
            (sid, int(time.time()*1000)))
        row = cursor.fetchone()
        return row["email"] if row else None
    return db_work(work)

def authorize(claims):
    email = session_email(claims["sid"])
    if not email:
        return None
    def work(c):
        c.execute("""SELECT cv.buyer_id::text,cv.seller_id::text FROM conversations cv
            JOIN users u ON u.id=%s WHERE cv.id=%s AND LOWER(u.email)=LOWER(%s)
            AND (cv.buyer_id=u.id OR cv.seller_id=u.id)""", (claims["sub"], claims["conversation"], email))
        return c.fetchone()
    return db_work(work)

async def broadcast(room, payload, exclude=None):
    for socket in list(rooms.get(room, {})):
        if socket is exclude:
            continue
        try:
            await asyncio.wait_for(socket.send_json(payload), timeout=5)
        except (RuntimeError, WebSocketDisconnect, asyncio.TimeoutError):
            rooms[room].pop(socket, None)

@app.get("/health")
def health():
    db_work(lambda c: c.execute("SELECT 1"))
    return {"status": "ok"}

@app.websocket("/ws/chat/{conversation_id}")
async def chat(ws: WebSocket, conversation_id: str):
    try:
        UUID(conversation_id)
        if ws.headers.get("origin") != ORIGIN:
            raise ValueError("Invalid origin")
        claims = jwt.decode(ws.query_params.get("ticket", ""), SECRET, algorithms=["HS256"],
                            audience="chat", issuer="student-market",
                            options={"require": ["exp", "iat", "sub", "sid", "conversation"]})
        if claims["conversation"] != conversation_id or not await asyncio.to_thread(authorize, claims):
            raise ValueError("Invalid session")
    except (ValueError, jwt.PyJWTError, KeyError):
        await ws.close(code=4401)
        return
    user_id = claims["sub"]
    await ws.accept()
    online = set(rooms[conversation_id].values())
    rooms[conversation_id][ws] = user_id
    for other in online:
        if other != user_id:
            await ws.send_json({"event":"user_online", "user_id":other})
    await broadcast(conversation_id, {"event":"user_online","user_id":user_id}, ws)
    recent = []
    try:
        while True:
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=15)
            except asyncio.TimeoutError:
                if not await asyncio.to_thread(authorize, claims):
                    await ws.close(code=4401)
                    break
                continue
            membership = await asyncio.to_thread(authorize, claims)
            if not membership:
                await ws.close(code=4401)
                break
            if len(raw) > 20000:
                await ws.close(code=1009)
                break
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if not isinstance(data, dict):
                continue
            now = time.monotonic()
            recent = [t for t in recent if t > now - 10]
            if len(recent) >= 40:
                await ws.send_json({"event":"error","error":"Gửi quá nhanh. Vui lòng thử lại."})
                continue
            recent.append(now)
            event = data.get("event")
            if event == "message":
                content = data.get("content")
                if not isinstance(content, str) or not 1 <= len(content.strip()) <= 5000:
                    await ws.send_json({"event":"error","error":"Tin nhắn cần 1–5000 ký tự."})
                    continue
                def insert(c):
                    c.execute("""INSERT INTO messages(id,conversation_id,sender_id,content,sent_at,is_read)
                        VALUES(gen_random_uuid(),%s,%s,%s,NOW(),FALSE) RETURNING id::text,sent_at""",
                        (conversation_id,user_id,content.strip()))
                    row=c.fetchone()
                    c.execute("UPDATE conversations SET last_message_at=NOW() WHERE id=%s",(conversation_id,))
                    return row
                row = await asyncio.to_thread(db_work, insert)
                await broadcast(conversation_id, {"event":"message","message":{
                    "id":row["id"],"conversation_id":conversation_id,"sender_id":user_id,
                    "sender_role":"buyer" if membership["buyer_id"]==user_id else "seller",
                    "content":content.strip(),"created_at":row["sent_at"].isoformat(),"is_read":False}})
            elif event == "message_read":
                def mark(c):
                    c.execute("""UPDATE messages SET is_read=TRUE,read_at=NOW()
                        WHERE conversation_id=%s AND sender_id<>%s AND is_read=FALSE RETURNING read_at""",
                        (conversation_id,user_id))
                    return c.fetchone()
                row=await asyncio.to_thread(db_work, mark)
                if row:
                    await broadcast(conversation_id, {"event":"message_read","user_id":user_id,"read_at":row["read_at"].isoformat()},ws)
            elif event == "typing":
                await broadcast(conversation_id,{"event":"typing","user_id":user_id,"is_typing":bool(data.get("is_typing"))},ws)
    except WebSocketDisconnect:
        pass
    finally:
        rooms[conversation_id].pop(ws,None)
        if user_id not in rooms[conversation_id].values():
            await broadcast(conversation_id,{"event":"user_offline","user_id":user_id})
        if not rooms[conversation_id]:
            rooms.pop(conversation_id,None)

