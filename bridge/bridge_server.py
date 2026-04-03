#!/usr/bin/env python3
"""
PBK Torque Meter Bridge Server V3
- Google Sheets 제거, Supabase 버전
- WebSocket ws://localhost:8765 로 브라우저와 통신
- 브라우저가 Supabase에 직접 저장

의존성 설치:
  pip install pyserial websockets

exe 빌드:
  pip install pyinstaller
  pyinstaller --onefile --console bridge_server.py
"""

import asyncio
import json
import re
import threading
import time

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("pyserial이 설치되지 않았습니다. 'pip install pyserial' 실행 후 재시도하세요.")
    exit(1)

try:
    import websockets
except ImportError:
    print("websockets가 설치되지 않았습니다. 'pip install websockets' 실행 후 재시도하세요.")
    exit(1)

# ── 설정 ──────────────────────────────────────────────────────────────────────
WS_HOST = "localhost"
WS_PORT = 8765
TORQUE_LSL = 12.32
TORQUE_USL = 16.67

# ── 전역 상태 ──────────────────────────────────────────────────────────────────
connected_clients: set = set()
serial_conn: serial.Serial | None = None
serial_lock = threading.Lock()


def get_ports() -> list[str]:
    """사용 가능한 COM 포트 목록 반환"""
    return [p.device for p in serial.tools.list_ports.comports()]


def parse_torque(line: str) -> float | None:
    """
    계측기 시리얼 출력에서 토크 수치 추출.
    지원 형식 예시:
      "14.32"              → 14.32
      "+014.32"            → 14.32   (Cedar DI-9M-8 PP 모드)
      "ST,+0014.32,lbf.in" → 14.32   (Cedar CSV 형식)
      "14.32 lbf.in"       → 14.32
      "T:14.32"            → 14.32
      "14"                 → 14.0    (소수점 없는 정수형)
    계측기 출력 형식이 다를 경우 이 함수를 수정하세요.
    """
    # 소수점 포함 숫자 (부호 선택) 우선 탐색
    match = re.search(r'[+-]?(\d+\.\d+)', line)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    # 소수점 없는 정수형 숫자 (부호 선택)
    match = re.search(r'[+-]?(\d{2,})', line)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None


async def broadcast(message: dict):
    """연결된 모든 브라우저 클라이언트에 메시지 전송"""
    if not connected_clients:
        return
    msg = json.dumps(message, ensure_ascii=False)
    dead = set()
    for client in connected_clients:
        try:
            await client.send(msg)
        except Exception:
            dead.add(client)
    connected_clients.difference_update(dead)  # -= 대신 사용 (UnboundLocalError 방지)


def serial_read_loop(loop: asyncio.AbstractEventLoop):
    """
    시리얼 포트 읽기 루프 (백그라운드 스레드).
    readline() 대신 in_waiting 축적 방식으로 CR/LF/CRLF 모두 지원.
    """
    global serial_conn
    buf = b""
    while True:
        with serial_lock:
            conn = serial_conn
        if conn and conn.is_open:
            try:
                waiting = conn.in_waiting
                if waiting > 0:
                    buf += conn.read(waiting)
                    time.sleep(0.03)          # 나머지 바이트가 도착할 여유 시간
                    extra = conn.in_waiting
                    if extra > 0:
                        buf += conn.read(extra)

                    # CR, LF, CRLF 모두 구분자로 처리
                    parts = re.split(b'[\r\n]+', buf)
                    buf = parts[-1]           # 마지막 미완성 조각은 보존

                    for part in parts[:-1]:
                        if not part:
                            continue
                        line = part.decode('utf-8', errors='ignore').strip()
                        # 디버그: hex + 문자열 동시 출력
                        print(f"  📥 수신 hex={part.hex()}  str={line!r}")
                        value = parse_torque(line)
                        if value is not None:
                            print(f"  📊 파싱 성공: {value} lbf.in")
                            asyncio.run_coroutine_threadsafe(
                                broadcast({"type": "measurement", "value": value}),
                                loop
                            )
                        else:
                            print(f"  ⚠ 파싱 실패 (원본): {line!r}")
                else:
                    time.sleep(0.05)
            except Exception as e:
                print(f"  ✗ 시리얼 읽기 오류: {e}")
                buf = b""
                time.sleep(0.1)
        else:
            buf = b""
            time.sleep(0.1)


async def handler(websocket):
    """WebSocket 클라이언트 핸들러"""
    global serial_conn
    connected_clients.add(websocket)
    remote = getattr(websocket, 'remote_address', '?')
    print(f"  ✓ 브라우저 연결: {remote}")

    # 연결 즉시 현재 시리얼 상태 전송
    with serial_lock:
        is_open = bool(serial_conn and serial_conn.is_open)
        port_name = serial_conn.port if is_open else None
    await websocket.send(json.dumps({
        "type": "status",
        "connected": is_open,
        "port": port_name,
    }))

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                continue

            action = data.get("action")

            # ── 포트 목록 요청 ──────────────────────────────────
            if action == "get_ports":
                ports = get_ports()
                await websocket.send(json.dumps({"type": "ports", "ports": ports}))

            # ── 시리얼 연결 ─────────────────────────────────────
            elif action == "connect":
                port = data.get("port", "")
                baud = int(data.get("baud", 9600))
                with serial_lock:
                    if serial_conn and serial_conn.is_open:
                        serial_conn.close()
                    try:
                        serial_conn = serial.Serial(
                            port, baud, timeout=1,
                            bytesize=serial.EIGHTBITS,
                            parity=serial.PARITY_NONE,
                            stopbits=serial.STOPBITS_ONE,
                            rtscts=False,
                            dsrdtr=False,
                        )
                        # RTS HIGH 설정 — Cedar 계측기는 RTS=HIGH 일 때 데이터 전송
                        serial_conn.setRTS(True)
                        serial_conn.setDTR(True)
                        print(f"  📡 시리얼 연결: {port} @ {baud}baud  RTS=HIGH DTR=HIGH")
                        await websocket.send(json.dumps({
                            "type": "status",
                            "connected": True,
                            "port": port,
                            "baud": baud,
                        }))
                    except Exception as e:
                        await websocket.send(json.dumps({
                            "type": "status",
                            "connected": False,
                            "error": str(e),
                        }))
                        print(f"  ✗ 연결 실패 ({port}): {e}")

            # ── 시리얼 연결 해제 ─────────────────────────────────
            elif action == "disconnect":
                with serial_lock:
                    if serial_conn and serial_conn.is_open:
                        serial_conn.close()
                    serial_conn = None
                await broadcast({"type": "status", "connected": False, "port": None})
                print("  📡 시리얼 연결 해제")

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        print(f"  ✗ 브라우저 연결 해제: {remote}")


async def main():
    print("=" * 60)
    print("  PBK Torque Meter Bridge Server V3")
    print("  Supabase 연동 버전 (Google Sheets 제거)")
    print("=" * 60)
    print(f"🔧 토크 Spec: {TORQUE_LSL} ~ {TORQUE_USL} lbf.in")
    print(f"🌐 WebSocket 서버: ws://{WS_HOST}:{WS_PORT}")
    print("=" * 60)

    loop = asyncio.get_event_loop()

    # 시리얼 읽기 스레드 시작 (백그라운드)
    t = threading.Thread(target=serial_read_loop, args=(loop,), daemon=True)
    t.start()

    async with websockets.serve(handler, WS_HOST, WS_PORT):
        print("  대시보드에서 연결을 기다리는 중...")
        await asyncio.Future()  # 종료 전까지 실행 유지


if __name__ == "__main__":
    asyncio.run(main())
