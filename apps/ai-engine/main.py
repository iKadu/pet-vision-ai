import time
import os
import requests
import cv2
from pathlib import Path
from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from ultralytics import YOLO
from core.detections import normalize_detections
from core.embedding_routes import create_embedding_router
from core.embedding_service import ImageEmbeddingService
from core.identification import TrackIdentificationManager
from core.embeddings import (
    DEFAULT_EMBEDDING_DIMENSIONS,
    DEFAULT_MODEL_NAME,
    DEFAULT_PRETRAINED_WEIGHTS,
    PetEmbeddingExtractor,
)
from core.stream import VideoStreamReader, parse_target_fps
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

def create_embedding_extractor() -> PetEmbeddingExtractor:
    return PetEmbeddingExtractor(
        model_name=os.getenv("EMBEDDING_MODEL_NAME", DEFAULT_MODEL_NAME),
        pretrained_weights=os.getenv("EMBEDDING_PRETRAINED_WEIGHTS", DEFAULT_PRETRAINED_WEIGHTS),
        expected_dimensions=int(
            os.getenv("EMBEDDING_DIMENSIONS", str(DEFAULT_EMBEDDING_DIMENSIONS))
        ),
    )


embedding_service = ImageEmbeddingService(create_embedding_extractor)
app.include_router(create_embedding_router(embedding_service))

# A origem pode ser um índice de webcam (ex.: "0"), "screen" ou uma URL RTSP/HTTP.
camera_source = os.getenv("CAMERA_SOURCE", "0")
STREAM_TARGET_FPS = parse_target_fps(os.getenv("STREAM_TARGET_FPS"))
stream_reader = VideoStreamReader(
    source=camera_source,
    target_fps=STREAM_TARGET_FPS,
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
identification_manager = TrackIdentificationManager(
    min_interval_seconds=float(os.getenv("IDENTIFICATION_INTERVAL_SECONDS", "3")),
    max_idle_seconds=float(os.getenv("TRACK_MAX_IDLE_SECONDS", "30")),
)
IDENTIFICATION_MIN_CROP_SIZE = int(os.getenv("IDENTIFICATION_MIN_CROP_SIZE", "96"))
TRACKING_WEBHOOK_INTERVAL_SECONDS = float(os.getenv("TRACKING_WEBHOOK_INTERVAL_SECONDS", "1"))
last_processing_latency_ms = 0.0
last_cycle_latency_ms = 0.0
measured_fps = 0.0
last_frame_timestamp = None

class StreamSourceRequest(BaseModel):
    source: str


class StreamStartRequest(BaseModel):
    stream_token: str


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
active_stream_token: str | None = None
latest_detections: list[dict] = []
latest_frame_width = 0
latest_frame_height = 0
recent_events: list[dict] = []
next_event_id = 1
current_presence_event_id: int | None = None
last_identified_pet_names: list[str] = []


def record_monitoring_event(event_type: str, message: str, **details) -> dict:
    """Mantém as transições de presença disponíveis para qualquer tela do painel."""
    global next_event_id
    event = {
        "id": next_event_id,
        "kind": event_type,
        "timestamp": time.time(),
        "message": message,
        **details,
    }
    recent_events.insert(0, event)
    next_event_id += 1
    # O histórico em memória é suficiente para a sessão e evita crescimento sem limite.
    del recent_events[100:]
    return event


def identified_pet_names(detections: list[dict]) -> list[str]:
    """Obtém nomes únicos já reconhecidos no frame atual."""
    return list(
        dict.fromkeys(
            identification.get("pet_name")
            for detection in detections
            if isinstance((identification := detection.get("identification")), dict)
            and identification.get("status") == "identified"
            and isinstance(identification.get("pet_name"), str)
            and identification["pet_name"].strip()
        )
    )


def detected_message(pet_names: list[str]) -> str:
    if not pet_names:
        return "Pet detectado no campo da câmera"
    return f"{', '.join(pet_names)} detectado{'s' if len(pet_names) > 1 else ''} no campo da câmera"


def left_message(pet_names: list[str]) -> str:
    if not pet_names:
        return "Pet não está mais visível pela câmera"
    return f"{', '.join(pet_names)} não {'está' if len(pet_names) == 1 else 'estão'} mais visíve{'l' if len(pet_names) == 1 else 'is'} pela câmera"

def send_webhook_event(event_type: str, details: dict) -> dict | None:
    """Envia o estado do monitoramento para o Next.js."""
    payload = {
        "timestamp": time.time(),
        "event_type": event_type,  # 'pet_detected' ou 'pet_left'
        "source": masked_camera_source(stream_reader.source),
        "details": details,
        "stream_token": active_stream_token,
    }
    try:
        headers = {"x-webhook-secret": WEBHOOK_SECRET} if WEBHOOK_SECRET else {}
        response = requests.post(NEXTJS_WEBHOOK_URL, json=payload, headers=headers, timeout=0.8)
        print(f"[IA Engine -> Webhook] Evento '{event_type}' enviado | Status: {response.status_code}")
        if not response.ok:
            return None
        try:
            return response.json()
        except ValueError:
            return None
    except requests.exceptions.RequestException as e:
        print(f"[IA Engine -> Webhook] Falha ao enviar evento: {e}")
        return None


def crop_detection(frame, detection: dict):
    """Recorta a bounding box normalizada, mantendo somente o animal para o encoder."""
    bbox = detection.get("bbox")
    if not isinstance(bbox, dict):
        return None

    frame_height, frame_width = frame.shape[:2]
    left = max(0, int(float(bbox["x"]) * frame_width))
    top = max(0, int(float(bbox["y"]) * frame_height))
    right = min(frame_width, int((float(bbox["x"]) + float(bbox["width"])) * frame_width))
    bottom = min(frame_height, int((float(bbox["y"]) + float(bbox["height"])) * frame_height))
    crop = frame[top:bottom, left:right]

    if crop.size == 0 or min(crop.shape[:2]) < IDENTIFICATION_MIN_CROP_SIZE:
        return None
    return crop


def create_identification_requests(frame, detections: list[dict], timestamp: float) -> list[dict]:
    """Gera no máximo um embedding por track no intervalo configurado."""
    requests_to_match: list[dict] = []

    for detection in detections:
        track_id = detection.get("track_id")
        if not isinstance(track_id, int) or not identification_manager.is_due(track_id, timestamp):
            continue

        crop = crop_detection(frame, detection)
        identification_manager.mark_requested(track_id, timestamp)
        if crop is None:
            continue

        try:
            embedding = embedding_service.extract_from_bgr(crop)
        except (TypeError, ValueError) as error:
            print(f"[IA Engine] Não foi possível gerar embedding do track {track_id}: {error}")
            continue

        requests_to_match.append(
            {
                "track_id": track_id,
                "values": embedding.values,
                "model_name": embedding.model_name,
                "pretrained_weights": embedding.pretrained_weights,
                "species": detection.get("class_name"),
            }
        )

    return requests_to_match

def process_stream():
    global last_seen_timestamp, is_pet_currently_present, last_tracking_webhook_timestamp, last_processing_latency_ms, last_cycle_latency_ms, measured_fps, last_frame_timestamp, latest_detections, latest_frame_width, latest_frame_height, current_presence_event_id, last_identified_pet_names
    
    try:
        stream_reader.start()
        for frame in stream_reader.read_sampled_frames():
            cycle_started = time.perf_counter()
            current_time = time.time()
            if last_frame_timestamp is not None:
                frame_delta = current_time - last_frame_timestamp
                if frame_delta > 0:
                    measured_fps = round(1 / frame_delta, 2)
            last_frame_timestamp = current_time
            
            # Filtra a inferência apenas para cães e gatos (classes 15 e 16)
            # ``persist=True`` conserva o estado do ByteTrack entre frames, para que
            # o mesmo pet mantenha seu track_id após oclusões e movimentações curtas.
            inference_started = time.perf_counter()
            results = model.track(
                source=frame,
                classes=list(TARGET_CLASSES.keys()),
                tracker=str(BYTETRACK_CONFIG),
                persist=True,
                verbose=False,
            )
            last_processing_latency_ms = round((time.perf_counter() - inference_started) * 1000, 1)
            boxes = results[0].boxes
            frame_height, frame_width = frame.shape[:2]
            latest_frame_width = frame_width
            latest_frame_height = frame_height
            detections = normalize_detections(boxes, frame_width, frame_height, TARGET_CLASSES)
            detections = trajectory_manager.update(detections, current_time)
            identification_requests = create_identification_requests(frame, detections, current_time)
            if identification_requests:
                identification_response = send_webhook_event(
                    "pet_identification",
                    {"identifications": identification_requests},
                )
                matches = (
                    identification_response.get("matches")
                    if isinstance(identification_response, dict)
                    else None
                )
                if isinstance(matches, list):
                    new_identifications = identification_manager.apply_matches(matches, current_time)
                    if new_identifications:
                        send_webhook_event(
                            "pet_identified",
                            {
                                "identifications": new_identifications,
                                "source": masked_camera_source(stream_reader.source),
                            },
                        )
            detections = identification_manager.enrich_detections(detections, current_time)
            latest_detections = [
                {
                    key: detection[key]
                    for key in ("track_id", "bbox", "identification")
                    if key in detection
                }
                for detection in detections
            ]
            pet_names = identified_pet_names(detections)
            if pet_names:
                last_identified_pet_names = pet_names
            
            pet_detected_in_frame = len(boxes) > 0

            if pet_detected_in_frame:
                last_seen_timestamp = current_time
                
                # Transição de estado: Estava ausente e AGORA apareceu
                if not is_pet_currently_present:
                    is_pet_currently_present = True
                    event = record_monitoring_event(
                        "pet_detected",
                        detected_message(pet_names),
                        total_pets=len(detections),
                        pet_names=pet_names,
                    )
                    current_presence_event_id = event["id"]
                elif pet_names and current_presence_event_id is not None:
                    # A identificação pode concluir alguns frames após a primeira detecção.
                    for event in recent_events:
                        if event["id"] == current_presence_event_id:
                            event["pet_names"] = pet_names
                            event["message"] = detected_message(pet_names)
                            break
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
                        record_monitoring_event(
                            "pet_left",
                            left_message(last_identified_pet_names),
                            absent_duration_seconds=round(time_since_last_seen, 1),
                            pet_names=last_identified_pet_names,
                        )
                        current_presence_event_id = None
                        last_identified_pet_names = []
                        send_webhook_event("pet_left", {
                            "message": "Pet não é mais identificado na imagem",
                            "absent_duration_seconds": round(time_since_last_seen, 1)
                        })
                        print(f"[IA Engine] ALERTA: Pet saiu do campo de visão da câmera!")

            last_cycle_latency_ms = round((time.perf_counter() - cycle_started) * 1000, 1)

    except Exception as e:
        print(f"[IA Engine] Erro no processamento: {e}")
    finally:
        stream_reader.stop()

@app.get("/status")
def get_status():
    return {
        "status": "online",
        "pet_present": is_pet_currently_present,
        "last_seen": last_seen_timestamp,
        "sampling_rate": f"{stream_reader.target_fps} FPS",
        "target_fps": stream_reader.target_fps,
        "camera_source": masked_camera_source(stream_reader.source),
        "stream_running": stream_reader.is_running,
        "fps": measured_fps,
        "latency_ms": last_processing_latency_ms,
        "cycle_latency_ms": last_cycle_latency_ms,
        "detections": latest_detections,
        "frame_width": latest_frame_width,
        "frame_height": latest_frame_height,
        "recent_events": recent_events,
    }

@app.post("/stream/start")
def start_stream(request: StreamStartRequest, background_tasks: BackgroundTasks):
    global active_stream_token, last_cycle_latency_ms, last_frame_timestamp, last_processing_latency_ms, measured_fps
    if stream_reader.is_running:
        return {"message": "Stream já em execução."}
    active_stream_token = request.stream_token
    last_processing_latency_ms = 0.0
    last_cycle_latency_ms = 0.0
    measured_fps = 0.0
    last_frame_timestamp = None
    background_tasks.add_task(process_stream)
    return {"message": "Monitoramento de presença iniciado."}

@app.post("/stream/source")
def set_stream_source(request: StreamSourceRequest):
    if stream_reader.is_running:
        stream_reader.stop()
    stream_reader.source = stream_reader._normalize_source(request.source)
    return {"message": "Fonte do stream atualizada.", "source": masked_camera_source(stream_reader.source)}

@app.post("/stream/stop")
def stop_stream():
    global active_stream_token, last_cycle_latency_ms, last_frame_timestamp, last_processing_latency_ms, latest_detections, latest_frame_width, latest_frame_height, measured_fps
    stream_reader.stop()
    active_stream_token = None
    latest_detections = []
    latest_frame_width = 0
    latest_frame_height = 0
    last_processing_latency_ms = 0.0
    last_cycle_latency_ms = 0.0
    measured_fps = 0.0
    last_frame_timestamp = None
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
