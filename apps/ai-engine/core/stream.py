import cv2
import numpy as np
import time
from threading import Lock
from typing import Generator, Optional

class VideoStreamReader:
    def __init__(
        self,
        source: str | int = 0,
        target_fps: float = 2.0,
        reconnect_delay: float = 2.0,
        screen_monitor: int = 1,
        screen_region: str | None = None,
    ):
        """
        :param source: Índice da webcam, URL RTSP/HTTP ou "screen" para capturar a tela.
        :param target_fps: Taxa de amostragem desejada.
        :param reconnect_delay: Tempo entre tentativas de reconexão, em segundos.
        """
        self.source = self._normalize_source(source)
        self.target_fps = target_fps
        self.frame_interval = 1.0 / target_fps
        self.reconnect_delay = reconnect_delay
        self.screen_monitor = screen_monitor
        self.screen_region = self._parse_screen_region(screen_region)
        self.cap: Optional[cv2.VideoCapture] = None
        self.screen_capture = None
        self.is_running = False
        self.latest_frame: Optional[cv2.Mat] = None
        self.frame_lock = Lock()

    @staticmethod
    def _normalize_source(source: str | int) -> str | int:
        """Converte valores numéricos do ambiente em índices de webcam."""
        if isinstance(source, int):
            return source
        source = source.strip()
        if source.lower() == "screen":
            return "screen"
        if source.isdigit():
            return int(source)
        if source.startswith(("rtsp://", "http://")):
            return source
        raise ValueError("CAMERA_SOURCE deve ser um índice numérico, 'screen' ou uma URL rtsp:// ou http://")

    @staticmethod
    def _parse_screen_region(region: str | None) -> dict[str, int] | None:
        """Converte 'left,top,width,height' em uma região do monitor."""
        if not region:
            return None

        try:
            left, top, width, height = (int(value.strip()) for value in region.split(","))
        except ValueError as error:
            raise ValueError("SCREEN_REGION deve usar o formato left,top,width,height") from error

        if width <= 0 or height <= 0:
            raise ValueError("SCREEN_REGION precisa ter largura e altura maiores que zero")
        return {"left": left, "top": top, "width": width, "height": height}

    def _connect(self) -> bool:
        self._release_capture()
        if self.source == "screen":
            try:
                from mss import mss

                self.screen_capture = mss()
                if self.screen_region is None:
                    if self.screen_monitor < 1 or self.screen_monitor >= len(self.screen_capture.monitors):
                        raise ValueError(f"SCREEN_MONITOR deve estar entre 1 e {len(self.screen_capture.monitors) - 1}")
                print(f"[IA Engine] Captura de tela iniciada | Monitor: {self.screen_monitor} | Amostragem: {self.target_fps} FPS")
                return True
            except Exception as error:
                print(f"[IA Engine] Não foi possível iniciar a captura de tela: {error}")
                self._release_capture()
                return False

        backend = cv2.CAP_DSHOW if isinstance(self.source, int) and hasattr(cv2, "CAP_DSHOW") else cv2.CAP_ANY
        self.cap = cv2.VideoCapture(self.source, backend)
        if not self.cap.isOpened() and backend != cv2.CAP_ANY:
            self._release_capture()
            self.cap = cv2.VideoCapture(self.source, cv2.CAP_ANY)
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
                if self.source != "screen":
                    if not self._connect():
                        time.sleep(self.reconnect_delay)
                        continue

            if self.source == "screen":
                if self.screen_capture is None and not self._connect():
                    time.sleep(self.reconnect_delay)
                    continue
                try:
                    monitor = self.screen_region or self.screen_capture.monitors[self.screen_monitor]
                    frame = cv2.cvtColor(np.asarray(self.screen_capture.grab(monitor)), cv2.COLOR_BGRA2BGR)
                except Exception as error:
                    print(f"[IA Engine] Captura de tela indisponível: {error}")
                    self._release_capture()
                    time.sleep(self.reconnect_delay)
                    continue
            else:
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
        if self.screen_capture:
            self.screen_capture.close()
            self.screen_capture = None

    def get_latest_frame(self) -> Optional[cv2.Mat]:
        with self.frame_lock:
            return self.latest_frame.copy() if self.latest_frame is not None else None
