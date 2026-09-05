import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  Layers,
  Users,
  PiggyBank,
  HandCoins,
  Landmark,
  Sprout,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNfUpload } from "@/hooks/non-financial/useNfUpload";
import { toast } from "sonner";
import type { NfUploadResponse } from "@/types/non-financial";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";

interface NfUploadZoneProps {
  submissionId?: string;
  onUploadComplete?: (result: NfUploadResponse) => void;
}

interface SectionMeta {
  id: string;
  code: string;
  titleKey: string;
  sheetName: string;
  icon: React.ElementType;
}

const SECTIONS: SectionMeta[] = [
  {
    id: "",
    code: "ALL",
    titleKey: "nf.sectionAll",
    sheetName: "NF MSHIP, NF S, NF LOANS, NF FS, NF FARM",
    icon: Layers,
  },
  {
    id: "members",
    code: "NF MSHIP",
    titleKey: "nf.sectionMembers",
    sheetName: "NF MSHIP",
    icon: Users,
  },
  {
    id: "savings",
    code: "NF S",
    titleKey: "nf.sectionSavings",
    sheetName: "NF S",
    icon: PiggyBank,
  },
  {
    id: "loans",
    code: "NF LOANS",
    titleKey: "nf.sectionLoans",
    sheetName: "NF LOANS",
    icon: HandCoins,
  },
  {
    id: "fixed_deposits",
    code: "NF FS",
    titleKey: "nf.sectionFixedDeposits",
    sheetName: "NF FS",
    icon: Landmark,
  },
  {
    id: "farm",
    code: "NF FARM",
    titleKey: "nf.sectionFarmCoop",
    sheetName: "NF FARM",
    icon: Sprout,
  },
];

export function NfUploadZone({ submissionId = "", onUploadComplete }: NfUploadZoneProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [section, setSection] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useNfUpload();

  const activeMeta = SECTIONS.find((s) => s.id === section) || SECTIONS[0];

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      const validExtensions = [".xlsx", ".xls"];
      const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
      if (!validExtensions.includes(ext)) {
        toast.error(t("nf.unsupportedFileType"));
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error(t("nf.fileTooLarge"));
        return;
      }
      setFile(selectedFile);
      setIsDragging(false);
    },
    [t],
  );

  const triggerFilePickerForSection = (sectionId: string) => {
    setSection(sectionId);
    setFile(null);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect],
  );

  const handleUpload = async () => {
    if (!file) {
      toast.error(t("nf.selectFileFirst"));
      return;
    }
    try {
      const result = await uploadMutation.mutateAsync({
        file,
        submissionId,
        section: section || undefined,
      });
      const total =
        result.rows_imported.members +
        result.rows_imported.savings_accounts +
        result.rows_imported.loans +
        result.rows_imported.fixed_deposits +
        result.rows_imported.farm_coop;
      toast.success(t("nf.uploadComplete", { count: total }));
      onUploadComplete?.(result);
      setFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(message || t("nf.uploadFailed"));
    }
  };

  const handleReset = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Upload className="size-4 text-primary shrink-0" />
          {t("nf.uploadTitle")}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {t(
            "nf.sectionChoiceSubtitle",
            "Select a specific section or upload a single workbook containing all sheets",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Direct Section Cards Grid */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {t("nf.selectTargetSection", "1. Select Section to Upload")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isSelected = section === sec.id;
              return (
                <div
                  key={sec.id || "all"}
                  onClick={() => setSection(sec.id)}
                  className={`group relative rounded-xl border p-3.5 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs"
                      : "border-border/70 hover:border-primary/50 hover:bg-muted/20 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`size-8 rounded-lg grid place-items-center transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                        }`}
                      >
                        <Icon className="size-4 shrink-0" />
                      </div>
                      <div>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                          {sec.code}
                        </span>
                        <p className="text-xs font-semibold text-foreground mt-1">
                          {t(sec.titleKey)}
                        </p>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="size-4 text-primary shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerFilePickerForSection(sec.id);
                        }}
                        title={t("upload", "Upload Excel")}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 hover:bg-primary/10 text-primary"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <span className="text-muted-foreground truncate max-w-[140px]">
                      {sec.id === "" ? "Full workbook" : sec.sheetName}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerFilePickerForSection(sec.id);
                      }}
                      className="font-medium text-primary hover:underline flex items-center gap-1 text-xs"
                    >
                      {t("nf.uploadFile", "Upload")}
                      <Upload className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Dropzone Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="uppercase tracking-wider">
              {t("nf.stepDropFile", "2. Drop or Choose File")}
            </span>
            <span className="text-muted-foreground font-normal">
              Target: <strong className="text-foreground">{t(activeMeta.titleKey)}</strong> (
              <code className="font-mono text-xs text-primary">{activeMeta.code}</code>)
            </span>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/10 scale-[1.01]"
                : "border-border/80 hover:border-primary/60 hover:bg-muted/20 bg-muted/5"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <div className="size-12 rounded-full bg-primary/10 text-primary mx-auto grid place-items-center mb-3">
              <FileSpreadsheet className="size-6" />
            </div>
            <p className="text-sm font-bold text-foreground">
              {file
                ? file.name
                : t("nf.dropFileForSection", {
                    section: t(activeMeta.titleKey),
                    defaultValue: `Drop Excel file for ${t(activeMeta.titleKey)} here or click to browse`,
                  })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {file ? `${(file.size / 1024).toFixed(0)} KB` : t("nf.fileSizeHint")}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2 font-mono">
              Expected sheet: {activeMeta.sheetName}
            </p>
          </div>
        </div>

        {/* Selected File Card */}
        {file && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-primary/5 border border-primary/20">
            <FileSpreadsheet className="size-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{(file.size / 1024).toFixed(0)} KB</span>
                <span>•</span>
                <span className="font-semibold text-primary">{t(activeMeta.titleKey)}</span>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="size-7 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={handleUpload}
          disabled={!file || uploadMutation.isPending}
          className="w-full h-11 text-sm font-bold shadow-sm cursor-pointer"
        >
          {uploadMutation.isPending ? (
            <>
              <Spinner size="sm" /> {t("nf.uploadingParsing")}
            </>
          ) : (
            <>
              <Upload className="size-4" />{" "}
              {t("nf.uploadParseSection", {
                section: t(activeMeta.titleKey),
                defaultValue: `Upload & Parse (${t(activeMeta.titleKey)})`,
              })}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
