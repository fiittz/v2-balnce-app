import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ReceiptImageViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  title?: string;
}

export function ReceiptImageViewer({ open, onOpenChange, imageUrl, title }: ReceiptImageViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] sm:max-w-2xl p-4">
        <DialogHeader>
          <DialogTitle>{title || "Receipt"}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center overflow-auto max-h-[75vh]">
          <img src={imageUrl} alt={title || "Receipt"} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
