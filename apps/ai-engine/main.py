import threading
from fastapi import FastAPI, BackgroundTasks
from ultralytics import YOLO
from core.stream import VideoStreamReader

app = FastAPI(title="Pet Vision AI Engine", version="1.0.0")

# Carrega o modelo YOLO pré-treinado (faz download automático do yolo11n.pt/yolov8n.pt no primeiro uso)
model = YOLO("yolo11n.pt") 

# Instância global do leitor (0 para webcam)
stream_reader = VideoStreamReader(source=0, target_fps=2.0)

def process_stream():
    """Loop que consome os frames a 1-2 FPS e executa a inferência básica."""
    try:
        stream_reader.start()
        for frame in stream_reader.read_sampled_frames():
            # Executa inferência rápida apenas para teste do pipeline (Fase 1)
            results = model.predict(source=frame, verbose=False)
            print(f"[IA Engine] Frame processado. Detecções: {len(results[0].boxes)}")
    except Exception as e:
        print(f"[IA Engine] Erro no stream: {e}")
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
        return {"message": "Stream já está em execução."}
    
    background_tasks.add_task(process_stream)
    return {"message": "Processamento de vídeo iniciado em segundo plano a 2 FPS."}

@app.post("/stream/stop")
def stop_stream():
    stream_reader.stop()
    return {"message": "Processamento de vídeo finalizado."}