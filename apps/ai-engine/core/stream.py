import cv2
import time
from typing import Generator, Optional

class VideoStreamReader:
    def __init__(self, source: str | int = 0, target_fps: float = 2.0):
        """
        :param source: 0 para Webcam padrão ou string RTSP ("rtsp://user:pass@ip:port/stream")
        :param target_fps: Taxa de amostragem desejada (ex: 1.0 a 2.0 FPS)
        """
        self.source = source
        self.target_fps = target_fps
        self.frame_interval = 1.0 / target_fps
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_running = False

    def start(self):
        self.cap = cv2.VideoCapture(self.source)
        if not self.cap.isOpened():
            raise RuntimeError(f"Não foi possível abrir o fluxo de vídeo: {self.source}")
        self.is_running = True
        print(f"[IA Engine] Conexão estabelecida com {self.source} | Amostragem: {self.target_fps} FPS")

    def read_sampled_frames(self) -> Generator[cv2.Mat, None, None]:
        """Gera frames respeitando o intervalo de tempo do target_fps."""
        last_yield_time = 0.0

        while self.is_running and self.cap and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                print("[IA Engine] Fluxo de vídeo finalizado ou desconectado.")
                break

            current_time = time.time()
            if current_time - last_yield_time >= self.frame_interval:
                last_yield_time = current_time
                yield frame

            # Pequena pausa para liberar a CPU entre capturas
            time.sleep(0.01)

    def stop(self):
        self.is_running = False
        if self.cap:
            self.cap.release()
        print("[IA Engine] Fluxo de vídeo encerrado.")