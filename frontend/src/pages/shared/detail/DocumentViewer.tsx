import React, { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  ZoomOut,
  ZoomIn,
  Maximize2,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAccessToken } from "@/services/shared/authService";
import { Spinner } from "@/components/ui/spinner";

type DocumentType = "pdf" | "image" | "word" | "excel" | "other";

export const DocumentViewer: React.FC<{ src: string }> = ({ src }) => {
  const { t } = useTranslation();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fileType, setFileType] = useState<DocumentType>("other");
  const [fileName, setFileName] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLoading(true);
    setError(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(src, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const cdHeader = res.headers.get("content-disposition");
        let extractedName = "";
        if (cdHeader) {
          const match = /filename\*?=['"]?(?:UTF-8'')?([^;'"]+)['"]?/i.exec(cdHeader);
          if (match && match[1]) {
            extractedName = decodeURIComponent(match[1]);
          }
        }
        if (!extractedName) {
          const urlParts = src.split("?")[0].split("/");
          extractedName = urlParts[urlParts.length - 1] || "document";
        }
        setFileName(extractedName);

        const blob = await res.blob();
        if (cancelled) return;

        const mime = blob.type.toLowerCase();
        const lowerName = extractedName.toLowerCase();

        if (mime === "application/pdf" || lowerName.endsWith(".pdf")) {
          setFileType("pdf");
        } else if (
          mime.startsWith("image/") ||
          /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(lowerName)
        ) {
          setFileType("image");
        } else if (
          mime.includes("wordprocessingml") ||
          mime.includes("msword") ||
          /\.(docx?)$/i.test(lowerName)
        ) {
          setFileType("word");
        } else if (
          mime.includes("spreadsheetml") ||
          mime.includes("ms-excel") ||
          /\.(xlsx?|csv)$/i.test(lowerName)
        ) {
          setFileType("excel");
        } else {
          setFileType("other");
        }

        setBlobUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const clampZoom = (z: number) => Math.min(4, Math.max(0.25, z));

  const handleWheel = (e: React.WheelEvent) => {
    if (fileType !== "image") return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((z) => clampZoom(z + delta));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (fileType !== "image" || zoom <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragging(false);

  const zoomIn = () => setZoom((z) => clampZoom(z + 0.25));
  const zoomOut = () => setZoom((z) => clampZoom(z - 0.25));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const openInTab = () => {
    if (blobUrl) window.open(blobUrl, "_blank");
  };

  const downloadFile = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "document";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] py-10 text-muted-foreground rounded-xl border border-border bg-muted/10 font-sans">
        <Spinner size="md" className="mr-2" />
        <span className="text-sm">{t("submissions.detail.documentViewer.loading")}</span>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] py-10 text-muted-foreground rounded-xl border border-border bg-muted/10 font-sans">
        <AlertCircle className="size-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">{t("submissions.detail.documentViewer.failedLoad")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("submissions.detail.documentViewer.fileUnavailable")}
        </p>
      </div>
    );
  }

  const getBadgeText = () => {
    switch (fileType) {
      case "pdf":
        return t("submissions.detail.documentViewer.pdfHint");
      case "word":
        return t("submissions.detail.documentViewer.wordHint");
      case "excel":
        return t("submissions.detail.documentViewer.excelHint");
      default:
        return t("submissions.detail.documentViewer.documentHint");
    }
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-muted/5 font-sans">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-1">
          {fileType === "image" && (
            <>
              <button
                onClick={zoomOut}
                disabled={zoom <= 0.25}
                title={t("submissions.detail.documentViewer.zoomOut")}
                className="inline-flex items-center justify-center size-7 rounded-md hover:bg-muted/60 disabled:opacity-40 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ZoomOut className="size-4" />
              </button>
              <span className="text-xs font-mono text-muted-foreground w-12 text-center select-none">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={zoomIn}
                disabled={zoom >= 4}
                title={t("submissions.detail.documentViewer.zoomIn")}
                className="inline-flex items-center justify-center size-7 rounded-md hover:bg-muted/60 disabled:opacity-40 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ZoomIn className="size-4" />
              </button>
              <button
                onClick={resetView}
                title={t("submissions.detail.documentViewer.resetView")}
                className="inline-flex items-center justify-center size-7 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground ml-1 cursor-pointer"
              >
                <Maximize2 className="size-4" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/50 rounded px-2 py-0.5">
            {getBadgeText()}
          </span>
          <button
            onClick={openInTab}
            title={t("submissions.detail.documentViewer.openInNewTab")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <ExternalLink className="size-3.5" />
            {t("submissions.detail.documentViewer.openFull")}
          </button>
        </div>
      </div>

      {/* Viewer area */}
      {fileType === "pdf" ? (
        <iframe
          src={blobUrl}
          className="w-full border-0"
          style={{ height: "72vh", minHeight: 480 }}
          title={t("submissions.detail.documentViewer.iframeTitle")}
        />
      ) : fileType === "image" ? (
        <div
          ref={containerRef}
          className="relative overflow-hidden bg-[#1e1e1e]"
          style={{
            height: "72vh",
            minHeight: 480,
            cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={blobUrl}
            alt={t("submissions.detail.documentViewer.iframeTitle")}
            draggable={false}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: "center center",
              transition: dragging ? "none" : "transform 0.15s ease",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              userSelect: "none",
            }}
          />
          {zoom > 1 && (
            <div className="absolute bottom-3 right-3 text-[10px] text-white/50 bg-black/30 rounded px-2 py-1 pointer-events-none select-none">
              {t("submissions.detail.documentViewer.zoomPanHint")}
            </div>
          )}
          {zoom <= 1 && (
            <div className="absolute bottom-3 right-3 text-[10px] text-white/50 bg-black/30 rounded px-2 py-1 pointer-events-none select-none">
              {t("submissions.detail.documentViewer.zoomHint")}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 px-4 bg-muted/10 font-sans min-h-[200px]">
          <div className="flex flex-col items-center max-w-md text-center bg-card border border-border rounded-2xl p-6 shadow-xs">
            <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              {fileType === "excel" ? (
                <FileSpreadsheet className="size-8 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <FileText className="size-8 text-blue-600 dark:text-blue-400" />
              )}
            </div>

            <h3 className="text-base font-semibold text-foreground truncate max-w-xs mb-1" title={fileName}>
              {fileName || t("submissions.detail.documentViewer.iframeTitle")}
            </h3>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
              {getBadgeText()}
            </p>

            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              {t("submissions.detail.documentViewer.docPreviewDesc")}
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={downloadFile}
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
              >
                <Download className="size-4" />
                {t("submissions.detail.documentViewer.downloadDoc")}
              </button>
              <button
                onClick={openInTab}
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg border border-border hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <ExternalLink className="size-4" />
                {t("submissions.detail.documentViewer.openFull")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
