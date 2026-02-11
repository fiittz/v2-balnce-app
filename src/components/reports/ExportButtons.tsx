import { useState } from "react";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportButtonsProps {
  onPdf: () => void | Promise<void>;
  onExcel: () => void | Promise<void>;
  disabled?: boolean;
  pdfLabel?: string;
  excelLabel?: string;
}

export function ExportButtons({ onPdf, onExcel, disabled, pdfLabel, excelLabel }: ExportButtonsProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      await onPdf();
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExcel = async () => {
    setExcelLoading(true);
    try {
      await onExcel();
    } finally {
      setExcelLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePdf}
        disabled={disabled || pdfLoading}
        className="rounded-xl"
      >
        {pdfLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <FileText className="w-4 h-4 mr-2" />
        )}
        {pdfLabel ?? "Download PDF"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExcel}
        disabled={disabled || excelLoading}
        className="rounded-xl"
      >
        {excelLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4 mr-2" />
        )}
        {excelLabel ?? "Download Excel"}
      </Button>
    </div>
  );
}
