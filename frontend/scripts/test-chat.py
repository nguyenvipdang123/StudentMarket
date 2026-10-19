import asyncio
import json
import os
import urllib.request
import websockets

origin=os.environ["TEST_ORIGIN"]
base="ws://127.0.0.1:"+os.environ["TEST_CHAT_PORT"]+"/ws/chat/"+os.environ["TEST_CONVERSATION"]
cookie=os.environ["TEST_COOKIE"]

def post(path):
    request=urllib.request.Request(origin+path,method="POST",headers={"Cookie":cookie,"Origin":origin})
    with urllib.request.urlopen(request) as response:
        return json.load(response)

async def rejected(url):
    try:
        async with websockets.connect(url,origin=origin):
            raise AssertionError("Unauthorized socket accepted")
    except websockets.exceptions.InvalidStatus as e:
        assert e.response.status_code==403

async def main():
    await rejected(base+"?user_id="+os.environ["TEST_USER_ID"])
    ticket=await asyncio.to_thread(post,"/api/conversations/"+os.environ["TEST_CONVERSATION"]+"/ticket")
    await rejected(base+"?ticket="+ticket["ticket"]+"invalid")
    async with websockets.connect(base+"?ticket="+ticket["ticket"],origin=origin) as ws:
        await ws.send(json.dumps({"event":"message","content":"Realtime integration test"}))
        while True:
            response=json.loads(await asyncio.wait_for(ws.recv(),timeout=5))
            if response.get("event")=="message":
                assert response["message"]["content"]=="Realtime integration test"
                assert response["message"]["sender_id"]==os.environ["TEST_USER_ID"]
                break
        await asyncio.to_thread(post,"/api/auth/logout")
        await ws.send(json.dumps({"event":"message","content":"Must be rejected after logout"}))
        try:
            await asyncio.wait_for(ws.recv(),timeout=5)
            raise AssertionError("Logged-out socket retained access")
        except websockets.exceptions.ConnectionClosed as e:
            assert e.rcvd.code==4401

asyncio.run(main())

