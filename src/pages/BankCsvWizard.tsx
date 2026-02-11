import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type WizardStep = 1 | 2 | 3 | 4;

const stepLabels: Record<WizardStep, string> = {
  1: "Upload CSV",
  2: "Map Columns",
  3: "Review & Categorise",
  4: "Post to Accounts",
};

export default function BankCsvWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>(1);

  const goNext = () => setStep((s) => (s < 4 ? ((s + 1) as WizardStep) : s));
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));

  return (
    <div className="min-h-screen bg-secondary pb-24">
      <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="font-semibold text-xl">Bank CSV Import</h1>
            <p className="text-sm text-muted-foreground">Upload, review and post your bank statement</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {([1, 2, 3, 4] as WizardStep[]).map((s) => {
            const isActive = s === step;
            const isComplete = s < step;
            return (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border text-sm font-semibold
                    ${isActive ? "bg-[#F2C300] text-black border-[#F2C300]" : "bg-white text-black border-gray-300"}
                  `}
                >
                  {isComplete ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                <span className={`text-sm ${isActive ? "font-semibold" : "text-muted-foreground"}`}>
                  {stepLabels[s]}
                </span>
              </div>
            );
          })}
        </div>
      </header>

      <main className="px-6 pt-6 max-w-4xl mx-auto space-y-6">
        {step === 1 && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold">Upload your bank CSV</h2>
              <p className="text-sm text-muted-foreground">
                Drop a CSV from your bank and well auto-categorise everything for you.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
              <p className="font-medium mb-2">Drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mb-4">or click below to browse</p>
              <Button className="bg-black text-white hover:bg-black/90 rounded-xl px-6">Browse CSV</Button>
              <p className="mt-3 text-xs text-muted-foreground">Supported: .csv only</p>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Map your columns</h2>
            <p className="text-sm text-muted-foreground">Tell Balnce what each column means.</p>
            <div className="bg-white rounded-2xl p-6 shadow-sm min-h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Column mapping UI will go here.
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Review transactions</h2>
                <p className="text-sm text-muted-foreground">Filter, adjust categories and confirm anything that needs review.</p>
              </div>
              <div className="text-xs text-muted-foreground">Legend: High / Medium / Needs review</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm min-h-[260px] flex items-center justify-center text-sm text-muted-foreground">
              Review & categorisation table will go here.
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Ready to post</h2>
            <p className="text-sm text-muted-foreground">Review the summary below and post to your accounts.</p>
            <div className="bg-white rounded-2xl p-6 shadow-sm min-h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Posting summary will go here.
            </div>
          </section>
        )}

        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={goBack} disabled={step === 1} className="rounded-xl">
            Back
          </Button>
          <Button onClick={goNext} className="rounded-xl bg-black text-white hover:bg-black/90">
            {step === 4 ? "Finish" : "Continue"}
          </Button>
        </div>
      </main>
    </div>
  );
}
