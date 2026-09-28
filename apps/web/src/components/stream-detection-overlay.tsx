import {
  identificationDisplay,
  type StreamDetection,
} from "@/lib/identification-display";

type StreamDetectionOverlayProps = {
  detections: StreamDetection[];
  frameWidth: number;
  frameHeight: number;
};

export function StreamDetectionOverlay({
  detections,
  frameWidth,
  frameHeight,
}: StreamDetectionOverlayProps) {
  const occupiedLabels: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${frameWidth} ${frameHeight}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {detections.map((detection, index) => {
        const display = identificationDisplay(detection);
        const boxX = detection.bbox.x * frameWidth;
        const boxY = detection.bbox.y * frameHeight;
        const boxWidth = detection.bbox.width * frameWidth;
        const boxHeight = detection.bbox.height * frameHeight;
        const labelWidth = Math.min(
          Math.max(
            168,
            Math.max(display.name.length, display.status.length) * 9 + 84,
          ),
          Math.max(168, frameWidth - 16),
        );
        const labelHeight = 58;
        const labelX = Math.min(
          Math.max(8, boxX),
          Math.max(8, frameWidth - labelWidth - 8),
        );
        const clampLabelY = (value: number) =>
          Math.min(
            Math.max(8, value),
            Math.max(8, frameHeight - labelHeight - 8),
          );
        const labelCandidates = [
          clampLabelY(boxY - labelHeight - 8),
          clampLabelY(boxY + 8),
          clampLabelY(boxY - labelHeight * 2 - 16),
          clampLabelY(boxY + labelHeight + 16),
        ];
        const labelY =
          labelCandidates.find(
            (candidateY) =>
              !occupiedLabels.some(
                (label) =>
                  labelX < label.x + label.width &&
                  labelX + labelWidth > label.x &&
                  candidateY < label.y + label.height &&
                  candidateY + labelHeight > label.y,
              ),
          ) ?? labelCandidates[0];
        occupiedLabels.push({
          x: labelX,
          y: labelY,
          width: labelWidth,
          height: labelHeight,
        });
        const detail = display.detail;
        const overlayTransition = {
          transition:
            "x 120ms cubic-bezier(0.16, 1, 0.3, 1), y 120ms cubic-bezier(0.16, 1, 0.3, 1), width 120ms cubic-bezier(0.16, 1, 0.3, 1), height 120ms cubic-bezier(0.16, 1, 0.3, 1)",
        };

        return (
          <g
            key={detection.track_id ?? index}
            className="stream-detection-overlay"
          >
            <rect
              x={boxX}
              y={boxY}
              width={boxWidth}
              height={boxHeight}
              rx="8"
              fill={display.accent}
              fillOpacity="0.07"
              stroke={display.accent}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              style={overlayTransition}
            />
            <rect
              x={labelX}
              y={labelY}
              width={labelWidth}
              height={labelHeight}
              rx="8"
              fill="#09090b"
              fillOpacity="0.9"
              stroke={display.accent}
              strokeOpacity="0.65"
              vectorEffect="non-scaling-stroke"
              style={overlayTransition}
            />
            <text
              x={labelX + 12}
              y={labelY + 20}
              fill={display.accent}
              fontSize="13"
              fontWeight="700"
            >
              {display.status.toUpperCase()}
            </text>
            <text
              x={labelX + 12}
              y={labelY + 38}
              fill="#f8fafc"
              fontSize="16"
              fontWeight="700"
            >
              {display.name}
            </text>
            <text
              x={labelX + 12}
              y={labelY + 52}
              fill="#a1a1aa"
              fontSize="11"
              fontWeight="500"
            >
              {detail}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
