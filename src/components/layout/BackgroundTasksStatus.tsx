import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, Upload } from "lucide-react";
import { useBackgroundTasks } from "@/contexts/BackgroundTasksContext";

const BackgroundTasksStatus = () => {
  const navigate = useNavigate();
  const { receiptState, totalFiles, processedFiles, errorFiles } = useBackgroundTasks();
  const { phase, currentIndex, matchedCount, notMatchedCount } = receiptState;

  if (phase === "idle") return null;

  const handleClick = () => {
    navigate("/receipts/bulk");
  };

  let icon: React.ReactNode;
  let label: string;

  if (phase === "ocr") {
    icon = <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    label = `Processing receipts ${currentIndex}/${totalFiles}...`;
  } else if (phase === "matching") {
    icon = <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    label = `Matching receipts...`;
  } else {
    // done
    icon = <CheckCircle2 className="w-4 h-4 text-green-600" />;
    label = `Done: ${matchedCount} matched, ${notMatchedCount} review`;
    if (errorFiles > 0) {
      label += `, ${errorFiles} errors`;
    }
  }

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-background border rounded-xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

export default BackgroundTasksStatus;
