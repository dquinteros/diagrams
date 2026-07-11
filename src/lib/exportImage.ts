// Diagram image export: SVG (vector), PNG (raster) and PDF.
// All three start from the live <svg>, normalized to full diagram bounds so the
// export captures the whole diagram regardless of current pan/zoom.

import { jsPDF } from "jspdf";

const MARGIN = 40;

/** Clone the live diagram SVG, sized to the full diagram bounds (no pan/zoom). */
function buildExportSvg(width: number, height: number): SVGSVGElement | null {
  // Target the diagram canvas specifically — toolbar icons are also inline
  // <svg> elements and appear earlier in the document.
  const svgEl = document.querySelector("svg[data-diagram-svg]");
  if (!svgEl) return null;

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const w = Math.ceil(width + MARGIN * 2);
  const h = Math.ceil(height + MARGIN * 2);

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("viewBox", `0 0 ${w} ${h}`);

  // Reset the pan/zoom on the content group so the full diagram is shown.
  const contentGroup = clone.querySelector("g");
  if (contentGroup) {
    contentGroup.setAttribute("transform", `translate(${MARGIN}, ${MARGIN}) scale(1)`);
  }
  return clone;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // The anchor must be in the document and the URL must stay alive until the
  // browser has read the blob — a programmatic click on a detached anchor is
  // ignored on WebKit (macOS Tauri), and revoking synchronously races the read.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to render SVG to image"));
    img.src = url;
  });
}

async function svgToCanvas(
  svg: SVGSVGElement,
  width: number,
  height: number,
  scale: number,
  background: string
): Promise<HTMLCanvasElement> {
  const xml = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function exportSvg(width: number, height: number): void {
  const svg = buildExportSvg(width, height);
  if (!svg) throw new Error("No diagram to export");
  // Use the XML serializer (not .outerHTML, an HTML serializer) so the standalone
  // file keeps proper XML/namespace syntax and opens in Inkscape/browsers.
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(blob, "diagram.svg");
}

export async function exportPng(
  width: number,
  height: number,
  background: string,
  scale = 2
): Promise<void> {
  const svg = buildExportSvg(width, height);
  if (!svg) throw new Error("No diagram to export");
  const w = width + MARGIN * 2;
  const h = height + MARGIN * 2;
  const canvas = await svgToCanvas(svg, w, h, scale, background);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))),
      "image/png"
    )
  );
  triggerDownload(blob, "diagram.png");
}

export async function exportPdf(
  width: number,
  height: number,
  background: string,
  scale = 2
): Promise<void> {
  const svg = buildExportSvg(width, height);
  if (!svg) throw new Error("No diagram to export");
  const w = width + MARGIN * 2;
  const h = height + MARGIN * 2;
  const canvas = await svgToCanvas(svg, w, h, scale, background);
  const dataUrl = canvas.toDataURL("image/png");

  const orientation = w >= h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: [w, h] });
  pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
  pdf.save("diagram.pdf");
}
