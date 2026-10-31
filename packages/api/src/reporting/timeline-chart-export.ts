export type TimelineChartPoint = {
  day: string;
  detections: number;
  identifications: number;
  absenceAlerts: number;
};

export type TimelineChartFormat = "svg" | "png";

const WIDTH = 960;
const HEIGHT = 480;
const PADDING = { top: 58, right: 34, bottom: 82, left: 64 };

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character] ?? character);
}

function chartFileName(format: TimelineChartFormat, generatedAt: Date) {
  return `petvision-atividade-${generatedAt.toISOString().slice(0, 10)}.${format}`;
}

export function buildTimelineChartSvg(points: TimelineChartPoint[]) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const maximum = Math.max(1, ...points.flatMap((point) => [point.detections, point.identifications, point.absenceAlerts]));
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const groupWidth = points.length ? plotWidth / points.length : plotWidth;
  const barWidth = Math.max(4, Math.min(18, (groupWidth - 10) / 3));
  const baseline = PADDING.top + plotHeight;
  const labels = points.length > 10 ? points.filter((_, index) => index % Math.ceil(points.length / 10) === 0) : points;

  const grid = yTicks.map((tick) => {
    const y = baseline - plotHeight * tick;
    const label = Math.round(maximum * tick);
    return `<line x1="${PADDING.left}" x2="${WIDTH - PADDING.right}" y1="${y}" y2="${y}" stroke="#d5dddc" stroke-width="1"/><text x="${PADDING.left - 12}" y="${y + 4}" fill="#63716f" font-size="11" text-anchor="end">${label}</text>`;
  }).join("");

  const bars = points.map((point, index) => {
    const center = PADDING.left + groupWidth * index + groupWidth / 2;
    const values = [
      { value: point.detections, color: "#14b8a6", offset: -barWidth },
      { value: point.identifications, color: "#22c55e", offset: 0 },
      { value: point.absenceAlerts, color: "#f59e0b", offset: barWidth },
    ];
    const rects = values.map(({ value, color, offset }) => {
      const height = (value / maximum) * plotHeight;
      return `<rect x="${center + offset - barWidth / 2}" y="${baseline - height}" width="${barWidth}" height="${height}" rx="3" fill="${color}"><title>${escapeXml(`${point.day}: ${value}`)}</title></rect>`;
    }).join("");
    const label = labels.includes(point)
      ? `<text x="${center}" y="${baseline + 22}" fill="#63716f" font-size="10" text-anchor="middle">${escapeXml(`${point.day.slice(8, 10)}/${point.day.slice(5, 7)}`)}</text>`
      : "";
    return `${rects}${label}`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="chart-title chart-description">
  <title id="chart-title">Atividade diária do monitoramento PetVision</title>
  <desc id="chart-description">Barras de detecções, identificações confirmadas e alertas de ausência por dia.</desc>
  <rect width="100%" height="100%" fill="#f8fbfa" rx="20"/>
  <text x="${PADDING.left}" y="30" fill="#11201d" font-family="Arial, sans-serif" font-size="20" font-weight="700">Atividade diária do monitoramento</text>
  <text x="${PADDING.left}" y="48" fill="#63716f" font-family="Arial, sans-serif" font-size="12">Detecções, identificações confirmadas e alertas de ausência</text>
  <g font-family="Arial, sans-serif">${grid}${bars}</g>
  <g font-family="Arial, sans-serif" font-size="11">
    <rect x="${PADDING.left}" y="${HEIGHT - 30}" width="10" height="10" rx="2" fill="#14b8a6"/><text x="${PADDING.left + 16}" y="${HEIGHT - 21}" fill="#475653">Detecções</text>
    <rect x="${PADDING.left + 116}" y="${HEIGHT - 30}" width="10" height="10" rx="2" fill="#22c55e"/><text x="${PADDING.left + 132}" y="${HEIGHT - 21}" fill="#475653">Identificações</text>
    <rect x="${PADDING.left + 254}" y="${HEIGHT - 30}" width="10" height="10" rx="2" fill="#f59e0b"/><text x="${PADDING.left + 270}" y="${HEIGHT - 21}" fill="#475653">Alertas</text>
  </g>
</svg>`;
}

export async function buildTimelineChartExport(
  format: TimelineChartFormat,
  points: TimelineChartPoint[],
  generatedAt = new Date(),
) {
  const svg = buildTimelineChartSvg(points);
  if (format === "svg") {
    return {
      content: svg,
      fileName: chartFileName(format, generatedAt),
      mimeType: "image/svg+xml;charset=utf-8",
    };
  }

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const rendered = new Image();
      rendered.onload = () => resolve(rendered);
      rendered.onerror = () => reject(new Error("Não foi possível renderizar o gráfico para PNG"));
      rendered.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível neste navegador");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const content = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível gerar o PNG")), "image/png");
    });
    return { content, fileName: chartFileName(format, generatedAt), mimeType: "image/png" };
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
