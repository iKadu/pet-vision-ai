"""Bounded, offline dog detection. All event times refer to the source video."""
import math
import platform
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import cv2
from fastapi import APIRouter, HTTPException, Request

MAX_BYTES = 200 * 1024 * 1024
MAX_SECONDS = 600
SAMPLE_FPS = 5


def presence_intervals(samples, duration, step):
    intervals = []
    for sample in samples:
        if not sample["detections"]:
            continue
        start = sample["time_seconds"]
        end = min(duration, start + step)
        if intervals and start <= intervals[-1]["end_seconds"] + 0.001:
            intervals[-1]["end_seconds"] = end
        else:
            intervals.append({"start_seconds": start, "end_seconds": end})
    return intervals


def analyze_video(path, detector, progress, confidence=0.25, image_size=768):
    capture = cv2.VideoCapture(str(path))
    started = time.perf_counter()
    try:
        fps = capture.get(cv2.CAP_PROP_FPS)
        total = capture.get(cv2.CAP_PROP_FRAME_COUNT)
        if not capture.isOpened() or not math.isfinite(fps) or fps <= 0 or not math.isfinite(total) or total <= 0:
            raise ValueError("Vídeo inválido ou codec não suportado.")
        duration = total / fps
        width, height = int(capture.get(3)), int(capture.get(4))
        if duration > MAX_SECONDS or width * height > 3840 * 2160:
            raise ValueError("Use um vídeo de até 10 minutos e resolução de até 4K.")
        stride = max(1, round(fps / SAMPLE_FPS))
        samples, index = [], 0
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if index / fps > MAX_SECONDS:
                raise ValueError("O vídeo excede o limite de duração.")
            if index % stride == 0:
                results = detector.predict(frame, classes=[16], conf=confidence, imgsz=image_size, verbose=False)
                detections = []
                for box in results[0].boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    detections.append({"confidence": round(float(box.conf[0]), 4), "bbox": {
                        "x": x1 / width, "y": y1 / height,
                        "width": (x2 - x1) / width, "height": (y2 - y1) / height,
                    }})
                samples.append({"time_seconds": index / fps, "detections": detections})
                progress(min(99, int((index + 1) / total * 100)))
            index += 1
        if not samples or index < total - max(2, fps * 0.1):
            raise ValueError("Não foi possível decodificar o vídeo completo. Converta-o para MP4/H.264.")
        duration = index / fps
        elapsed = time.perf_counter() - started
        intervals = presence_intervals(samples, duration, stride / fps)
        return {
            "duration_seconds": duration, "source_fps": fps, "width": width, "height": height,
            "sample_interval_seconds": stride / fps, "samples": samples, "intervals": intervals,
            "analyzed_frames": len(samples), "frames_with_dogs": sum(bool(s["detections"]) for s in samples),
            "max_dogs": max(len(s["detections"]) for s in samples),
            "presence_seconds": sum(i["end_seconds"] - i["start_seconds"] for i in intervals),
            "processing_seconds": elapsed, "processing_fps": len(samples) / elapsed,
            "configuration": {"model": "yolo11n.pt", "confidence": confidence, "image_size": image_size,
                "class_id": 16, "opencv": cv2.__version__, "python": platform.python_version(),
                "platform": platform.platform(), "device": str(detector.device)},
        }
    finally:
        capture.release()


def create_video_router():
    router = APIRouter(prefix="/videos")
    jobs = {}
    lock = threading.Lock()
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="video-analysis")

    def process(job_id, directory, path):
        try:
            from ultralytics import YOLO
            with lock:
                jobs[job_id]["status"] = "processing"
            def progress(value):
                with lock:
                    jobs[job_id]["progress"] = value
            result = analyze_video(path, YOLO("yolo11n.pt"), progress)
            with lock:
                jobs[job_id].update(status="completed", progress=100, result=result)
        except Exception as error:
            with lock:
                jobs[job_id].update(status="failed", error=str(error) if isinstance(error, ValueError) else "Falha ao analisar o vídeo.")
        finally:
            directory.cleanup()
            with lock:
                jobs[job_id]["finished_at"] = time.time()

    @router.post("")
    async def upload(request: Request):
        owner = request.headers.get("x-video-owner")
        if not owner:
            raise HTTPException(401, "Autenticação necessária.")
        if request.headers.get("content-type", "").split(";")[0] not in {"video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"}:
            raise HTTPException(415, "Use MP4, WebM, MOV ou AVI.")
        job_id = uuid4().hex
        with lock:
            for key in list(jobs):
                if time.time() - jobs[key].get("finished_at", time.time()) > 3600:
                    del jobs[key]
            if any(job["status"] in {"uploading", "queued", "processing"} for job in jobs.values()):
                raise HTTPException(409, "Já existe uma análise em andamento. Aguarde sua conclusão.")
            jobs[job_id] = {"id": job_id, "owner": owner, "status": "uploading", "progress": 0}
        directory = TemporaryDirectory(prefix="petvision-video-")
        path = Path(directory.name) / "source.video"
        try:
            size = 0
            with path.open("wb") as output:
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise HTTPException(413, "O vídeo deve ter no máximo 200 MB.")
                    output.write(chunk)
            if not size:
                raise HTTPException(400, "O vídeo está vazio.")
            with lock:
                jobs[job_id]["status"] = "queued"
            executor.submit(process, job_id, directory, path)
            return {"id": job_id}
        except BaseException:
            directory.cleanup()
            with lock:
                jobs.pop(job_id, None)
            raise

    @router.get("/{job_id}")
    def status(job_id: str, request: Request):
        with lock:
            job = jobs.get(job_id)
            if not job or job["owner"] != request.headers.get("x-video-owner"):
                raise HTTPException(404, "Análise não encontrada.")
            return {key: value for key, value in job.items() if key != "owner"}

    return router
