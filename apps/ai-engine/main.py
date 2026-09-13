import time
import os
import requests
import cv2
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from ultralytics import YOLO
from core.detections import normalize_detections
from core.stream import VideoStreamReader
from core.tracking import TrajectoryManager
from urllib.parse import urlsplit, urlunsplit

# A configuração local do projeto deve prevalecer sobre valores antigos
# eventualmente herdados do terminal/ambiente do sistema.
load_dotenv(override=True)

app = FastAPI(title="Pet Vision AI Engine", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Modelo YOLO
model = YOLO("yolo11n.pt")

# A origem pode ser um índice de webcam (ex.: "0"), "screen" ou uma URL RTSP/HTTP.
camera_source = os.getenv("CAMERA_SOURCE", "0")
stream_reader = VideoStreamReader(
    source=camera_source,
    target_fps=2.0,
    screen_monitor=int(os.getenv("SCREEN_MONITOR", "1")),
    screen_region=os.getenv("SCREEN_REGION"),
)

# URL da rota de Webhook no Next.js (ajuste a porta se o seu frontend rodar em 3001)
NEXTJS_WEBHOOK_URL = os.getenv("NEXTJS_WEBHOOK_URL", "http://localhost:3001/api/webhooks/ai")
WEBHOOK_SECRET = os.getenv("AI_WEBHOOK_SECRET")

# IDs da classe COCO: 15 = cat, 16 = dog
TARGET_CLASSES = {15: "cat", 16: "dog"}
BYTETRACK_CONFIG = Path(__file__).parent / "core" / "bytetrack.yaml"
trajectory_manager = TrajectoryManager(
    max_points=int(os.getenv("TRAJECTORY_MAX_POINTS", "120")),
    max_idle_seconds=float(os.getenv("TRACK_MAX_IDLE_SECONDS", "30")),
)
TRACKING_WEBHOOK_INTERVAL_SECONDS = float(os.getenv("TRACKING_WEBHOOK_INTERVAL_SECONDS", "1"))

def masked_camera_source(source: str | int) -> str:
    """Oculta a senha da URL antes de expor a origem no endpoint de status."""
    source_text = str(source)
    if not source_text.startswith(("rtsp://", "http://")):
        return source_text

    parsed = urlsplit(source_text)
    if parsed.password is None:
        return source_text
    username = parsed.username or ""
    host = parsed.hostname or ""
    if parsed.port:
        host = f"{host}:{parsed.port}"
    safe_netloc = f"{username}:***@{host}" if username else f"***@{host}"
    return urlunsplit((parsed.scheme, safe_netloc, parsed.path, parsed.query, parsed.fragment))

# Configurações do Estado de Presença
SECONDS_TO_CONSIDER_ABSENT = 5.0  # Tempo sem ver o pet para considerar que ele saiu
last_seen_timestamp = None
is_pet_currently_present = False
last_tracking_webhook_timestamp = 0.0

def send_webhook_event(event_type: str, details: dict):
    """Envia o estado do monitoramento para o Next.js."""
    payload = {
        "timestamp": time.time(),
        "event_type": event_type,  # 'pet_detected' ou 'pet_left'
        "source": masked_camera_source(stream_reader.source),
        "details": details
    }
    try:
        headers = {"x-webhook-secret": WEBHOOK_SECRET} if WEBHOOK_SECRET else {}
        response = requests.post(NEXTJS_WEBHOOK_URL, json=payload, headers=headers, timeout=0.8)
        print(f"[IA Engine -> Webhook] Evento '{event_type}' enviado | Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[IA Engine -> Webhook] Falha ao enviar evento: {e}")

def process_stream():
    global last_seen_timestamp, is_pet_currently_present, last_tracking_webhook_timestamp
    
    try:
        stream_reader.start()
        for frame in stream_reader.read_sampled_frames():
            current_time = time.time()
            
            # Filtra a inferência apenas para cães e gatos (classes 15 e 16)
            # ``persist=True`` conserva o estado do ByteTrack entre frames, para que
            # o mesmo pet mantenha seu track_id após oclusões e movimentações curtas.
            results = model.track(
                source=frame,
                classes=list(TARGET_CLASSES.keys()),
                tracker=str(BYTETRACK_CONFIG),
                persist=True,
                verbose=False,
            )
            boxes = results[0].boxes
            frame_height, frame_width = frame.shape[:2]
            detections = normalize_detections(boxes, frame_width, frame_height, TARGET_CLASSES)
            detections = trajectory_manager.update(detections, current_time)
            
            pet_detected_in_frame = len(boxes) > 0

            if pet_detected_in_frame:
                last_seen_timestamp = current_time
                
                # Transição de estado: Estava ausente e AGORA apareceu
                if not is_pet_currently_present:
                    is_pet_currently_present = True
                    send_webhook_event("pet_detected", {
                        "message": "Pet identificado no ambiente",
                        "total_pets": len(detections),
                        "coordinate_space": "normalized",
                        "detections": detections,
                    })

                if current_time - last_tracking_webhook_timestamp >= TRACKING_WEBHOOK_INTERVAL_SECONDS:
                    last_tracking_webhook_timestamp = current_time
                    send_webhook_event("pet_tracking_update", {
                        "message": "Trajetórias dos pets atualizadas",
                        "total_pets": len(detections),
                        "coordinate_space": "normalized",
                        "detections": detections,
                    })
                
                print(f"[IA Engine] Pet visível no frame | Contagem: {len(boxes)}")

            else:
                # Se o pet já estava sendo monitorado e sumiu
                if is_pet_currently_present and last_seen_timestamp:
                    time_since_last_seen = current_time - last_seen_timestamp
                    
                    # Transição de estado: Passou do tempo limite sem ver o animal
                    if time_since_last_seen >= SECONDS_TO_CONSIDER_ABSENT:
                        is_pet_currently_present = False
                        send_webhook_event("pet_left", {
                            "message": "Pet não é mais identificado na imagem",
                            "absent_duration_seconds": round(time_since_last_seen, 1)
                        })
                        print(f"[IA Engine] ALERTA: Pet saiu do campo de visão da câmera!")

    except Exception as e:
        print(f"[IA Engine] Erro no processamento: {e}")
    finally:
        stream_reader.stop()

@app.get("/status")
def get_status():
    return {
        "status": "online",
        "pet_present": is_pet_currently_present,
        "sampling_rate": f"{stream_reader.target_fps} FPS"
        ,"camera_source": masked_camera_source(stream_reader.source),
        "stream_running": stream_reader.is_running,
    }

@app.post("/stream/start")
def start_stream(background_tasks: BackgroundTasks):
    if stream_reader.is_running:
        return {"message": "Stream já em execução."}
    background_tasks.add_task(process_stream)
    return {"message": "Monitoramento de presença iniciado."}

@app.post("/stream/stop")
def stop_stream():
    stream_reader.stop()
    return {"message": "Monitoramento encerrado."}

def video_frames():
    while True:
        frame = stream_reader.get_latest_frame()
        if frame is not None:
            success, encoded_frame = cv2.imencode(".jpg", frame)
            if success:
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + encoded_frame.tobytes() + b"\r\n")
        time.sleep(0.1)

@app.get("/stream/video")
def stream_video():
    return StreamingResponse(
        video_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
