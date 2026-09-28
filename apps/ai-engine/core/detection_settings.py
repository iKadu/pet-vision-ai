DEFAULT_DETECTION_IMAGE_SIZE = 768
MIN_DETECTION_IMAGE_SIZE = 320
MAX_DETECTION_IMAGE_SIZE = 1280
DEFAULT_DETECTION_CONFIDENCE_THRESHOLD = 0.18


def parse_detection_image_size(value: str | int | None) -> int:
    if value is None or value == "":
        return DEFAULT_DETECTION_IMAGE_SIZE

    try:
        image_size = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError("DETECTION_IMAGE_SIZE deve ser um número inteiro.") from error

    if not MIN_DETECTION_IMAGE_SIZE <= image_size <= MAX_DETECTION_IMAGE_SIZE:
        raise ValueError(
            f"DETECTION_IMAGE_SIZE deve estar entre {MIN_DETECTION_IMAGE_SIZE} e {MAX_DETECTION_IMAGE_SIZE}."
        )

    if image_size % 32 != 0:
        raise ValueError("DETECTION_IMAGE_SIZE deve ser múltiplo de 32.")

    return image_size


def parse_detection_confidence_threshold(value: str | float | None) -> float:
    if value is None or value == "":
        return DEFAULT_DETECTION_CONFIDENCE_THRESHOLD

    try:
        confidence = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError("DETECTION_CONFIDENCE_THRESHOLD deve ser numérico.") from error

    if not 0 < confidence < 1:
        raise ValueError("DETECTION_CONFIDENCE_THRESHOLD deve estar entre 0 e 1.")

    return confidence
