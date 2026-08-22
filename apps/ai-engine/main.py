import time
import requests
from fastapi import FastAPI, BackgroundTasks
from ultralytics import YOLO
from core.stream import VideoStreamReader

app = FastAPI(
    title="Pet Vision AI Engine",
    description="Motor de Visão Computacional para Monitoramento de Pets",
    version="1.0.0"
)

# Inicializa o modelo YOLO pré-treinado
model = YOLO("yolo11n.pt")

# Leitor de vídeo apontando para a webcam padrão (0) com amostragem a 2 FPS
stream_reader = VideoStreamReader(source=0, target_fps=2.0)

# URL da rota de Webhook no Next.js (ajuste a porta se o seu frontend rodar em 3001)
NEXTJS_WEBHOOK_URL = "http://localhost:3000/api/webhooks/detection"

def send_detection_webhook(detections_data: list):
    """Dispara os dados processados para a API do Next.js via POST."""
    payload = {
        "timestamp": time.time(),
        "source": "webcam_0",
        "total_detections": len(detections_data),
        "detections": detections_data
    }
    try:
        response = requests.post(NEXTJS_WEBHOOK_URL, json=payload, timeout=0.8)
        print(f"[IA Engine -> Next.js] Webhook entregue | Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"[IA Engine -> Next.js] Falha ao enviar Webhook (Next.js offline?): {e}")

def process_stream():
    """Loop em background que consome os frames amostrados e executa a inferência."""
    try:
        stream_reader.start()
        for frame in stream_reader.read_sampled_frames():
            results = model.predict(source=frame, verbose=False)
            boxes = results[0].boxes
            
            detections = []
            if len(boxes) > 0:
                for box in boxes:
                    cls_id = int(box.cls[0])
                    class_name = model.names[cls_id]
                    confidence = float(box.conf[0])
                    coords = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                    
                    detections.append({
                        "class": class_name,
                        "confidence": round(confidence, 2),
                        "box": [round(c, 1) for c in coords]
                    })
                
                # Dispara evento se houver detecções no frame
                send_detection_webhook(detections)
                
            print(f"[IA Engine] Frame processado | Objetos encontrados: {len(detections)}")
    except Exception as e:
        print(f"[IA Engine] Erro no stream de vídeo: {e}")
    finally:
        stream_reader.stop()

@app.get("/status")
def get_status():
    return {
        "status": "online",
        "service": "ai-engine",
        "sampling_rate": f"{stream_reader.target_fps} FPS",
        "stream_active": stream_reader.is_running
    }

@app.post("/stream/start")
def start_stream(background_tasks: BackgroundTasks):
    if stream_reader.is_running:
        return {"message": "O stream já está em execução."}
    
    background_tasks.add_task(process_stream)
    return {"message": "Processamento de vídeo iniciado em segundo plano a 2 FPS."}

@app.post("/stream/stop")
def stop_stream():
    if not stream_reader.is_running:
        return {"message": "O stream não está ativo."}
    
    stream_reader.stop()
    return {"message": "Comando de finalização enviado ao stream."}