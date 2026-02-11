import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Receipt, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AppLayout from "@/components/layout/AppLayout";

type View = "dashboard" | "add-contract";

const rctRates = [
  { rate: "0%", label: "Zero Rate", description: "Compliant contractors", color: "bg-green-500" },
  { rate: "20%", label: "Standard Rate", description: "Most common rate", color: "bg-primary" },
  { rate: "35%", label: "Higher Rate", description: "Non-compliant contractors", color: "bg-red-500" },
];

const contracts = [
  { id: 1, contractor: "Murphy Construction", description: "Site works Phase 1", rate: "20%", status: "pending", amount: 15000 },
  { id: 2, contractor: "Kelly Builders", description: "Foundation work", rate: "0%", status: "filed", amount: 8500 },
  { id: 3, contractor: "Dublin Groundworks", description: "Excavation", rate: "20%", status: "paid", amount: 12000 },
  { id: 4, contractor: "O'Brien Electrical", description: "Wiring installation", rate: "35%", status: "pending", amount: 6500 },
];

const RCTCentre = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("dashboard");
  const [filter, setFilter] = useState<string>("all");
  const [selectedRate, setSelectedRate] = useState<string | null>("20%");

  const filteredContracts = contracts.filter(c => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  const statusColors = {
    pending: "bg-orange-100 text-orange-800",
    filed: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
  };

  const totalDeductions = contracts.reduce((sum, c) => {
    const rate = parseFloat(c.rate) / 100;
    return sum + (c.amount * rate);
  }, 0);

  if (view === "add-contract") {
    return (
      <AppLayout>
        <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setView("dashboard")} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="font-semibold text-xl">Add Contract</h1>
          </div>
        </header>

        <main className="px-4 md:px-6 py-6 pb-32 max-w-4xl mx-auto md:mx-0 space-y-6">
          <div className="bg-card rounded-2xl p-6 card-shadow space-y-5 animate-fade-in">
            <div className="space-y-2">
              <Label className="font-medium">Contractor Name</Label>
              <Input 
                placeholder="Enter contractor name"
                className="h-14 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Contract Description</Label>
              <Input 
                placeholder="Describe the work"
                className="h-14 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Contract Value (€)</Label>
              <Input 
                type="number"
                placeholder="0.00"
                className="h-14 rounded-xl text-base"
              />
            </div>
          </div>

          <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <Label className="font-medium mb-4 block">RCT Rate</Label>
            <div className="space-y-3">
              {rctRates.map((rate) => (
                <button
                  key={rate.rate}
                  onClick={() => setSelectedRate(rate.rate)}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    selectedRate === rate.rate
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${rate.color}`} />
                  <div className="flex-1 text-left">
                    <p className="font-semibold">{rate.rate} - {rate.label}</p>
                    <p className="text-sm text-muted-foreground">{rate.description}</p>
                  </div>
                  {selectedRate === rate.rate && (
                    <div className="w-6 h-6 bg-foreground rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-background rounded-full" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 md:left-60">
          <div className="max-w-4xl mx-auto md:mx-0">
            <Button 
              onClick={() => setView("dashboard")}
              className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 rounded-xl text-lg font-semibold"
            >
              Save Contract
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="w-24" />
          <div className="flex-1 text-center">
            <h1 className="font-semibold text-xl">RCT Centre</h1>
          </div>
          <div className="w-24 flex justify-end">
            <Button 
              onClick={() => setView("add-contract")}
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-6 py-6 max-w-4xl mx-auto md:mx-0 space-y-5">
        {/* RCT Rate Summary */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in">
          {rctRates.map((rate, index) => (
            <div 
              key={rate.rate}
              className={`rounded-2xl p-4 card-shadow ${index === 1 ? "bg-primary" : "bg-card"}`}
            >
              <div className={`w-8 h-8 rounded-full ${rate.color} flex items-center justify-center mb-2`}>
                <span className="text-xs font-bold text-white">{rate.rate}</span>
              </div>
              <p className={`text-sm font-medium ${index === 1 ? "text-primary-foreground" : ""}`}>{rate.label}</p>
              <p className={`text-xs ${index === 1 ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {contracts.filter(c => c.rate === rate.rate).length} contracts
              </p>
            </div>
          ))}
        </div>

        {/* Deduction Summary */}
        <div className="bg-foreground rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <p className="text-background/70 mb-1">Total RCT Deductions</p>
          <p className="text-3xl font-bold text-primary">€{totalDeductions.toLocaleString()}</p>
          <p className="text-sm text-background/60 mt-2">This period</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          {["all", "pending", "filed", "paid"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-all ${
                filter === f
                  ? "bg-foreground text-background"
                  : "bg-card border border-border text-foreground hover:border-foreground/40"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Contracts List */}
        <div className="bg-card rounded-2xl card-shadow overflow-hidden animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Contracts</h2>
          </div>
          {filteredContracts.map((contract, index) => (
            <div 
              key={contract.id}
              className={`p-4 flex items-center gap-4 ${index !== filteredContracts.length - 1 ? "border-b border-border" : ""}`}
            >
              <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{contract.contractor}</p>
                <p className="text-sm text-muted-foreground truncate">{contract.description}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">€{contract.amount.toLocaleString()}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium">{contract.rate}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[contract.status as keyof typeof statusColors]}`}>
                    {contract.status}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          ))}
        </div>
      </main>
    </AppLayout>
  );
};

export default RCTCentre;
