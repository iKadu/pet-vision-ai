import cv2
import math
import numpy as np
import time
from threading import Event, Lock, Thread, current_thread
from typing import Generator, Optional


DEFAULT_TARGET_FPS = 2.0
DEFAULT_PREVIEW_FPS = 15.0
MIN_TARGET_FPS = 0.5
MAX_TARGET_FPS = 30.0


def parse_fps(value: str | float | int | None, default: float, variable_name: str) -> float:
    """Valida uma taxa de frames configurada por variável de ambiente."""
    if value is None:
        return default

    try:
        fps = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{variable_name} deve ser um número entre 0.5 e 30") from error

    if not math.isfinite(fps) or not MIN_TARGET_FPS <= fps <= MAX_TARGET_FPS:
        raise ValueError(f"{variable_name} deve ser um número entre 0.5 e 30")
    return fps


def parse_target_fps(value: str | float | int | None) -> float:
    """Valida a amostragem usada para inferência e tracking."""
    return parse_fps(value, DEFAULT_TARGET_FPS, "STREAM_TARGET_FPS")


def parse_preview_fps(value: str | float | int | None) -> float:
    """Valida a taxa máxima usada na captura e no preview MJPEG."""
    return parse_fps(value, DEFAULT_PREVIEW_FPS, "STREAM_PREVIEW_FPS")


class VideoStreamReader:
    def __init__(
        self,
        source: str | int = 0,
        target_fps: float = DEFAULT_TARGET_FPS,
        preview_fps: float = DEFAULT_PREVIEW_FPS,
        reconnect_delay: float = 2.0,
        screen_monitor: int = 1,
        screen_region: str | None = None,
    ):
        """
        :param source: Índice da webcam, URL RTSP/HTTP ou "screen" para capturar a tela.
        :param target_fps: Taxa de amostragem usada para inferência e tracking.
        :param preview_fps: Taxa máxima usada para captura e preview do vídeo.
        :param reconnect_delay: Tempo entre tentativas de reconexão, em segundos.
        """
        self.source = self._normalize_source(source)
        self.target_fps = parse_target_fps(target_fps)
        self.frame_interval = 1.0 / self.target_fps
        self.preview_fps = parse_preview_fps(preview_fps)
        self.preview_interval = 1.0 / self.preview_fps
        self.reconnect_delay = reconnect_delay
        self.screen_monitor = screen_monitor
        self.screen_region = self._parse_screen_region(screen_region)
        self.cap: Optional[cv2.VideoCapture] = None
        self.screen_capture = None
        self.is_running = False
        self.latest_frame: Optional[cv2.Mat] = None
        self.latest_frame_sequence = 0
        self.capture_fps = 0.0
        self._last_capture_timestamp: float | None = None
        self.frame_lock = Lock()
        self._capture_stop_event = Event()
        self._capture_thread: Thread | None = None

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
                print(
                    f"[IA Engine] Captura de tela iniciada | Monitor: {self.screen_monitor} "
                    f"| Preview: {self.preview_fps} FPS | IA: {self.target_fps} FPS"
                )
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
        print(
            f"[IA Engine] Conexão estabelecida com {self.source} "
            f"| Preview: {self.preview_fps} FPS | IA: {self.target_fps} FPS"
        )
        return True

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._capture_stop_event.clear()
        with self.frame_lock:
            self.latest_frame = None
            self.latest_frame_sequence = 0
            self.capture_fps = 0.0
            self._last_capture_timestamp = None
        self._capture_thread = Thread(
            target=self._capture_loop,
            name="petvision-video-capture",
            daemon=True,
        )
        self._capture_thread.start()

    def read_sampled_frames(self) -> Generator[cv2.Mat, None, None]:
        """Entrega somente o frame mais recente na taxa configurada para a IA."""
        last_yield_time = 0.0
        last_sequence = -1

        while self.is_running:
            frame, sequence = self.get_latest_frame_with_sequence()
            if frame is None or sequence == last_sequence:
                self._capture_stop_event.wait(0.005)
                continue

            elapsed = time.monotonic() - last_yield_time
            if elapsed < self.frame_interval:
                self._capture_stop_event.wait(self.frame_interval - elapsed)
                continue

            last_yield_time = time.monotonic()
            last_sequence = sequence
            yield frame

    def stop(self):
        self.is_running = False
        self._capture_stop_event.set()
        capture_thread = self._capture_thread
        if capture_thread and capture_thread.is_alive() and capture_thread is not current_thread():
            capture_thread.join(timeout=self.reconnect_delay + 1)
        self._capture_thread = None
        self._release_capture()
        with self.frame_lock:
            self.latest_frame = None
            self.latest_frame_sequence = 0
            self.capture_fps = 0.0
            self._last_capture_timestamp = None
        print("[IA Engine] Fluxo de vídeo encerrado.")

    def _capture_loop(self):
        """Captura continuamente, sem aguardar YOLO, embeddings ou webhooks."""
        while not self._capture_stop_event.is_set():
            started_at = time.monotonic()
            frame = self._read_frame()
            if frame is not None:
                self._publish_frame(frame)
            self._capture_stop_event.wait(
                max(0.0, self.preview_interval - (time.monotonic() - started_at))
            )
        self._release_capture()

    def _read_frame(self) -> Optional[cv2.Mat]:
        if self.source == "screen":
            if self.screen_capture is None and not self._connect():
                self._capture_stop_event.wait(self.reconnect_delay)
                return None
            try:
                monitor = self.screen_region or self.screen_capture.monitors[self.screen_monitor]
                return cv2.cvtColor(
                    np.asarray(self.screen_capture.grab(monitor)), cv2.COLOR_BGRA2BGR
                )
            except Exception as error:
                print(f"[IA Engine] Captura de tela indisponível: {error}")
                self._release_capture()
                self._capture_stop_event.wait(self.reconnect_delay)
                return None

        if self.cap is None or not self.cap.isOpened():
            if not self._connect():
                print(
                    f"[IA Engine] Não foi possível abrir {self.source}; "
                    f"reconectando em {self.reconnect_delay}s."
                )
                self._capture_stop_event.wait(self.reconnect_delay)
                return None

        ret, frame = self.cap.read()
        if ret:
            return frame

        print(f"[IA Engine] Frame indisponível; reconectando em {self.reconnect_delay}s.")
        self._release_capture()
        self._capture_stop_event.wait(self.reconnect_delay)
        return None

    def _publish_frame(self, frame: cv2.Mat):
        now = time.monotonic()
        with self.frame_lock:
            if self._last_capture_timestamp is not None:
                frame_delta = now - self._last_capture_timestamp
                if frame_delta > 0:
                    self.capture_fps = round(1 / frame_delta, 2)
            self._last_capture_timestamp = now
            self.latest_frame = frame.copy()
            self.latest_frame_sequence += 1

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

    def get_latest_frame_with_sequence(self) -> tuple[Optional[cv2.Mat], int]:
        with self.frame_lock:
            frame = self.latest_frame.copy() if self.latest_frame is not None else None
            return frame, self.latest_frame_sequence
