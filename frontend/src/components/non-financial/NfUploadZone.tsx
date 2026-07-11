import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNfUpload } from "@/hooks/non-financial/useNfUpload";
import { toast } from "sonner";
import type { NfUploadResponse } from "@/types/non-financial";

interface NfUploadZoneProps {
  submissionId: string;
  onUploadComplete?: (result: NfUploadResponse) => void;
}

export function NfUploadZone({ submissionId, onUploadComplete }: NfUploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useNfUpload();

  const handleFileSelect = useCallback((selectedFile: File) => {
    const validExtensions = [".xlsx", ".xls"];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error("Unsupported file type. Please upload an Excel file (.xlsx or .xls).");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 50 MB.");
      return;
    }
    setFile(selectedFile);
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!file) { toast.error("Please select an Excel file to upload."); return; }
    try {
      const result = await uploadMutation.mutateAsync({ file, submissionId });
      toast.success(`Upload complete: ${result.rows_imported.members} members imported.`);
      onUploadComplete?.(result);
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleReset = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Upload className="size-4" />
          Upload Non-Financial Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-primary bg-primary/10 scale-[1.02]"
              : "border-border hover:border-primary/50 hover:bg-muted/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
          <FileSpreadsheet className="size-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">
            {file ? file.name : "Drop your Excel file here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {file ? `${(file.size / 1024).toFixed(0)} KB` : ".xlsx or .xls — up to 50 MB"}
          </p>
        </div>

        {file && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <FileSpreadsheet className="size-5 text-success shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button
              onClick={handleReset}
              className="size-7 rounded grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <Button onClick={handleUpload} disabled={!file || uploadMutation.isPending} className="w-full">
          {uploadMutation.isPending ? (
            <><Loader2 className="size-4 animate-spin" /> Uploading & Parsing...</>
          ) : (
            <><Upload className="size-4" /> Upload & Parse</>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          Expected sheets: NF MSHIP, NF S, NF LOANS, NF FS, Farm Coop
        </p>
      </CardContent>
    </Card>
  );
}
