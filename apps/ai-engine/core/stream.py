import cv2
import time
from threading import Lock
from typing import Generator, Optional

class VideoStreamReader:
    def __init__(self, source: str | int = 0, target_fps: float = 2.0, reconnect_delay: float = 2.0):
        """
        :param source: Índice da webcam ou URL RTSP/HTTP da câmera IP.
        :param target_fps: Taxa de amostragem desejada.
        :param reconnect_delay: Tempo entre tentativas de reconexão, em segundos.
        """
        self.source = self._normalize_source(source)
        self.target_fps = target_fps
        self.frame_interval = 1.0 / target_fps
        self.reconnect_delay = reconnect_delay
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_running = False
        self.latest_frame: Optional[cv2.Mat] = None
        self.frame_lock = Lock()

    @staticmethod
    def _normalize_source(source: str | int) -> str | int:
        """Converte valores numéricos do ambiente em índices de webcam."""
        if isinstance(source, int):
            return source
        source = source.strip()
        if source.isdigit():
            return int(source)
        if source.startswith(("rtsp://", "http://")):
            return source
        raise ValueError("CAMERA_SOURCE deve ser um índice numérico ou uma URL rtsp:// ou http://")

    def _connect(self) -> bool:
        self._release_capture()
        self.cap = cv2.VideoCapture(self.source)
        if not self.cap.isOpened():
            self._release_capture()
            return False
        print(f"[IA Engine] Conexão estabelecida com {self.source} | Amostragem: {self.target_fps} FPS")
        return True

    def start(self):
        self.is_running = True
        if not self._connect():
            print(f"[IA Engine] Não foi possível abrir {self.source}; reconectando em {self.reconnect_delay}s.")

    def read_sampled_frames(self) -> Generator[cv2.Mat, None, None]:
        """Gera frames e reconecta automaticamente quando a câmera falha."""
        last_yield_time = 0.0

        while self.is_running:
            if self.cap is None or not self.cap.isOpened():
                if not self._connect():
                    time.sleep(self.reconnect_delay)
                    continue

            ret, frame = self.cap.read()
            if not ret:
                print(f"[IA Engine] Frame indisponível; reconectando em {self.reconnect_delay}s.")
                self._release_capture()
                time.sleep(self.reconnect_delay)
                continue

            with self.frame_lock:
                self.latest_frame = frame.copy()

            current_time = time.time()
            if current_time - last_yield_time >= self.frame_interval:
                last_yield_time = current_time
                yield frame

            # Pequena pausa para liberar a CPU entre capturas
            time.sleep(0.01)

    def stop(self):
        self.is_running = False
        self._release_capture()
        with self.frame_lock:
            self.latest_frame = None
        print("[IA Engine] Fluxo de vídeo encerrado.")

    def _release_capture(self):
        if self.cap:
            self.cap.release()
            self.cap = None

    def get_latest_frame(self) -> Optional[cv2.Mat]:
        with self.frame_lock:
            return self.latest_frame.copy() if self.latest_frame is not None else None