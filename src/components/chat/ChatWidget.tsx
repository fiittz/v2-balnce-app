import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, Send, Trash2, Sparkles, ChevronRight, MessageSquarePlus, History, ChevronLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PenguinIcon from "@/components/PenguinIcon";
import ChatMarkdown from "@/components/chat/ChatMarkdown";
import ChatChart, { parseChartBlocks } from "@/components/chat/ChatChart";
import { useAuth } from "@/hooks/useAuth";
import { useCT1Data } from "@/hooks/useCT1Data";
import { useTransactions } from "@/hooks/useTransactions";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { useDirectorOnboarding } from "@/hooks/useDirectorOnboarding";
import { useInvoices } from "@/hooks/useInvoices";
import { buildFinancialContext } from "@/lib/buildFinancialContext";
import { executeToolCall, getPageLabel } from "@/lib/chatTools";
import { supabase } from "@/integrations/supabase/client";
import type { ToolContext } from "@/lib/chatTools";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  lastTool?: string;
}

// ── Bouncing dots ───────────────────────────────────────────
function BouncingDots({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}

// ── Assistant message with chart support ────────────────────
function AssistantMessage({ content }: { content: string }) {
  const parts = parseChartBlocks(content);
  if (parts.length === 1 && typeof parts[0] === "string") {
    return <ChatMarkdown content={parts[0]} />;
  }
  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <ChatMarkdown key={i} content={part} />
        ) : (
          <ChatChart key={i} chart={part} />
        )
      )}
    </>
  );
}

// ── Follow-up suggestion map ────────────────────────────────
const FOLLOW_UPS: Record<string, string[]> = {
  show_tax_summary: ["Show my expense breakdown", "How can I reduce this?", "What if I contributed to pension?"],
  show_expense_breakdown: ["Show expenses as a chart", "Which of these are disallowed?", "Run a company health check"],
  calculate_pension_savings: ["Compare salary vs dividend vs pension", "Show me my CT1 computation", "What if I bought a van?"],
  show_tax_deadlines: ["Run a company health check", "How much CT do I owe?", "Show me my P&L"],
  run_company_health_check: ["Run a director health check", "How much could I save with pension?", "Show my expenses as a chart"],
  run_director_health_check: ["Run a company health check", "Compare salary vs dividend", "What are my deadlines?"],
  what_if_buy_van: ["What if I hire an employee at €35k?", "Show my CT1 computation", "Run a company health check"],
  what_if_hire_employee: ["Compare salary vs dividend", "What if I bought a van?", "Show my expense breakdown"],
  what_if_salary_vs_dividend: ["Calculate pension savings for €20k", "Show me my CT1", "Run a director health check"],
  search_transactions: ["Show my expenses as a chart", "Run a company health check", "How much CT do I owe?"],
  show_chart: ["Show my expense breakdown", "How can I reduce my tax?", "Run a company health check"],
  navigate_to_page: ["How much CT do I owe?", "Run a company health check", "Show my expenses"],
};

// ── Tool status labels ──────────────────────────────────────
const TOOL_STATUS_LABELS: Record<string, string> = {
  navigate_to_page: "Navigating...",
  show_tax_summary: "Looking up your CT1 data...",
  show_expense_breakdown: "Analysing your expenses...",
  calculate_pension_savings: "Calculating pension savings...",
  show_tax_deadlines: "Checking deadlines...",
  run_company_health_check: "Running company health check...",
  run_director_health_check: "Running director health check...",
  what_if_buy_van: "Modelling van purchase...",
  what_if_hire_employee: "Calculating employment costs...",
  what_if_salary_vs_dividend: "Comparing extraction methods...",
  search_transactions: "Searching transactions...",
  show_chart: "Generating chart...",
};

const ALL_TOOL_NAMES = new Set(Object.keys(TOOL_STATUS_LABELS));

// ── Content sanitizer ───────────────────────────────────────
const JUNK_RE = /### Function<[^>]*>\w+\s*(?:json\s*)?\{[\s\S]*?\}\s*#?|<\|?tool_?call\|?>\s*\w+\s*\{[\s\S]*?\}|จัดอันดับ;/gi;
function sanitize(text: string) { return text.replace(JUNK_RE, "").trim(); }

// ── Conversation grouping ────────────────────────────────────
interface StoredMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  date: string;
  messages: ChatMessage[];
}

/** Group messages into conversations — a gap of 2+ hours = new conversation */
function groupConversations(msgs: StoredMessage[]): Conversation[] {
  if (msgs.length === 0) return [];
  const convos: Conversation[] = [];
  let current: StoredMessage[] = [msgs[0]];

  for (let i = 1; i < msgs.length; i++) {
    const gap = new Date(msgs[i].created_at).getTime() - new Date(msgs[i - 1].created_at).getTime();
    if (gap > 2 * 60 * 60 * 1000) {
      convos.push(buildConvo(current));
      current = [msgs[i]];
    } else {
      current.push(msgs[i]);
    }
  }
  convos.push(buildConvo(current));
  return convos.reverse(); // newest first
}

function buildConvo(msgs: StoredMessage[]): Conversation {
  const firstUser = msgs.find((m) => m.role === "user");
  const title = firstUser
    ? firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? "..." : "")
    : "New conversation";
  const date = msgs[0].created_at;
  return {
    id: msgs[0].id,
    title,
    date,
    messages: msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  };
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Balnce is thinking...");
  const [lastToolUsed, setLastToolUsed] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, directorCount } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Load all chat history from Supabase on mount
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const grouped = groupConversations(data as StoredMessage[]);
          setConversations(grouped);
          // Load the most recent conversation
          if (grouped.length > 0) {
            setMessages(grouped[0].messages);
          }
        }
      });
  }, [user?.id]);

  const ct1 = useCT1Data();
  const { data: allTransactions } = useTransactions();
  const { data: onboardingSettings } = useOnboardingSettings();
  const { data: directorRows } = useDirectorOnboarding();
  const { data: invoices } = useInvoices();

  const businessExtra = useMemo(() => {
    const raw = localStorage.getItem("business_onboarding_extra");
    return raw ? JSON.parse(raw) : null;
  }, []);

  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const savedCT1 = useMemo(() => {
    const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${taxYear}`);
    return raw ? JSON.parse(raw) : null;
  }, [user?.id, taxYear]);

  const allDirectorData = useMemo(() => {
    if (!user?.id) return [];
    const directors: Record<string, unknown>[] = [];
    for (let i = 1; i <= (directorCount || 1); i++) {
      const raw = localStorage.getItem(`director_onboarding_${user.id}_${i}`);
      if (raw) directors.push(JSON.parse(raw));
    }
    return directors;
  }, [user?.id, directorCount]);

  const allForm11Data = useMemo(() => {
    if (!user?.id) return [];
    const forms: { directorNumber: number; data: Record<string, unknown> }[] = [];
    for (let i = 1; i <= (directorCount || 1); i++) {
      const raw = localStorage.getItem(`form11_questionnaire_${user.id}_${i}`);
      if (raw) forms.push({ directorNumber: i, data: JSON.parse(raw) });
    }
    return forms;
  }, [user?.id, directorCount]);

  const financialContext = useMemo(() => {
    if (ct1.isLoading) return "";
    return buildFinancialContext({
      businessName: profile?.business_name || "Company",
      businessType: profile?.business_type || "limited_company",
      taxYear: String(taxYear),
      ct1,
      savedCT1,
      directorData: allDirectorData[0] ?? null,
      transactionCount: allTransactions?.length ?? 0,
      profile,
      onboardingSettings,
      businessExtra,
      allDirectorData,
      directorRows: directorRows ?? [],
      allForm11Data,
      invoices: invoices ?? [],
    });
  }, [ct1, savedCT1, allDirectorData, profile, taxYear, allTransactions, onboardingSettings, businessExtra, directorRows, allForm11Data, invoices]);

  const toolContext: ToolContext = useMemo(() => ({
    ct1,
    savedCT1,
    taxYear,
    navigate,
    directorData: allDirectorData[0] ?? null,
    transactionCount: allTransactions?.length ?? 0,
    invoiceCount: invoices?.length ?? 0,
    transactions: allTransactions ?? [],
    invoices: invoices ?? [],
    incorporationDate: profile?.incorporation_date ?? null,
    allForm11Data,
  }), [ct1, savedCT1, taxYear, navigate, allDirectorData, allTransactions, invoices, profile, allForm11Data]);

  // ── Proactive personalized opener ─────────────────────────
  const proactiveGreeting = useMemo(() => {
    if (ct1.isLoading || !allTransactions) return null;
    const eur = (n: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);

    const totalIncome = ct1.detectedIncome.reduce((s, i) => s + i.amount, 0);
    if (totalIncome === 0) return null;

    const motorVehicleAllowance = ct1.vehicleAsset
      ? ct1.vehicleAsset.depreciation.annualAllowance
      : (savedCT1?.capitalAllowancesMotorVehicles ?? 0);
    const capitalAllowancesTotal = (savedCT1?.capitalAllowancesPlant ?? 0) + motorVehicleAllowance;
    const expensesBase = ct1.expenseSummary.allowable + capitalAllowancesTotal + ct1.directorsLoanTravel;
    const tradingProfit = Math.max(0, totalIncome - expensesBase);
    const lf = savedCT1?.lossesForward ?? 0;
    const taxableProfit = Math.max(0, tradingProfit - lf);
    const totalCT = taxableProfit * 0.125 + (savedCT1?.closeCompanySurcharge ?? 0);

    const parts: string[] = [];
    parts.push(`I can see **${eur(totalIncome)}** income and **${eur(totalCT)}** CT liability for ${taxYear}.`);

    const anyPension = allForm11Data?.some(f => Number(f.data?.pensionContributions) > 0);
    if (!anyPension && tradingProfit > 10000) {
      const suggestedPension = Math.min(tradingProfit * 0.3, 50000);
      const saving = suggestedPension * 0.125 + suggestedPension * 0.492;
      parts.push(`You're missing ~**${eur(saving)}** in pension relief.`);
    }

    const uncategorized = allTransactions.filter((t: { category?: string | Record<string, unknown> | null }) => !t.category || t.category === "Uncategorized").length;
    if (uncategorized > 5) {
      parts.push(`${uncategorized} transactions need categorizing.`);
    }

    return parts.join(" ");
  }, [ct1, allTransactions, savedCT1, allForm11Data, taxYear]);

  // ── Dynamic suggested questions ───────────────────────────
  const suggestedQuestions = useMemo(() => {
    const questions: string[] = [];
    const txCount = allTransactions?.length ?? 0;
    const uncategorized = allTransactions?.filter((t: { category?: string | Record<string, unknown> | null }) => t.category === "Uncategorized" || !t.category).length ?? 0;

    if (uncategorized > 0) {
      questions.push(`I have ${uncategorized} uncategorized transactions — can you help?`);
    }

    const anyPension = allForm11Data?.some(f => Number(f.data?.pensionContributions) > 0);
    if (!anyPension && txCount > 0) {
      questions.push("How much could I save with a pension contribution?");
    }

    questions.push("Run a company health check");
    if (questions.length < 4) {
      questions.push("Run a director health check");
    }

    if (questions.length < 4) {
      questions.push("Show my expenses as a chart");
    }
    if (questions.length < 4) {
      questions.push("What if I bought a van for €30,000?");
    }

    return questions.slice(0, 4);
  }, [allTransactions, allForm11Data]);

  // ── Insight badge count ───────────────────────────────────
  const insightCount = useMemo(() => {
    let count = 0;
    const uncategorized = allTransactions?.filter((t: { category?: string | Record<string, unknown> | null }) => t.category === "Uncategorized" || !t.category).length ?? 0;
    if (uncategorized > 5) count++;
    const anyPension = allForm11Data?.some(f => Number(f.data?.pensionContributions) > 0);
    if (!anyPension && (allTransactions?.length ?? 0) > 0) count++;
    const today = new Date();
    const oct31 = new Date(taxYear, 9, 31);
    if (oct31.getTime() - today.getTime() < 60 * 24 * 60 * 60 * 1000 && oct31 > today) count++;
    return count;
  }, [allTransactions, allForm11Data, taxYear]);

  // ── Follow-up suggestions for last message ────────────────
  const followUpSuggestions = useMemo(() => {
    if (messages.length === 0 || isLoading) return [];
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return [];
    if (lastToolUsed && FOLLOW_UPS[lastToolUsed]) {
      return FOLLOW_UPS[lastToolUsed];
    }
    // Generic follow-ups based on content
    const c = lastMsg.content.toLowerCase();
    if (c.includes("corporation tax") || c.includes("ct1")) {
      return ["Show my expense breakdown", "How can I reduce this?", "What if I contributed to pension?"];
    }
    if (c.includes("pension")) {
      return ["Compare salary vs dividend", "Show my CT1", "Run a director health check"];
    }
    return [];
  }, [messages, lastToolUsed, isLoading]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);

  // ── Raw tool-call detection ───────────────────────────────
  const filterRawToolCalls = useCallback((accumulated: string): {
    cleanText: string;
    parsedCall: { id: string; name: string; arguments: string } | null;
  } => {
    const RAW_TOOL_PATTERNS = [
      /### Function<[^>]*>(\w+)\s*(?:json\s*)?\s*(\{[\s\S]*?\})\s*#?/i,
      /<\|tool_call\|>\s*(\w+)\s*(\{[\s\S]*?\})/i,
      /<tool_call>\s*(\w+)\s*(\{[\s\S]*?\})/i,
      /\u{FF1C}[^>]*tool[^>]*\u{FF1E}\s*(\w+)\s*(\{[\s\S]*?\})/iu,
    ];
    for (const pattern of RAW_TOOL_PATTERNS) {
      const match = accumulated.match(pattern);
      if (match && ALL_TOOL_NAMES.has(match[1])) {
        return {
          cleanText: accumulated.replace(pattern, "").trim(),
          parsedCall: { id: `raw_${Date.now()}`, name: match[1], arguments: match[2] },
        };
      }
    }
    const junkPatterns = /### Function<[｜|]tool[▁_]sep[｜|]>|<[|]tool_call[|]>|<tool_call>|จัดอันดับ;/g;
    if (junkPatterns.test(accumulated)) {
      return { cleanText: accumulated.replace(junkPatterns, "").trim(), parsedCall: null };
    }
    return { cleanText: accumulated, parsedCall: null };
  }, []);

  // ── Stream reader ─────────────────────────────────────────
  const readStream = useCallback(async (
    response: Response,
    onContent: (text: string) => void,
    onToolCalls: (calls: { id: string; name: string; arguments: string }[]) => void,
    signal: AbortSignal
  ) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";

    try {
      while (true) {
        if (signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: tool_calls") || line.startsWith("event: error")) continue;
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            const { cleanText, parsedCall } = filterRawToolCalls(accumulated);
            if (parsedCall) onToolCalls([parsedCall]);
            if (cleanText !== accumulated) { accumulated = cleanText; onContent(""); }
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              accumulated += parsed.content;
              const { cleanText, parsedCall } = filterRawToolCalls(accumulated);
              if (parsedCall) { accumulated = cleanText; onToolCalls([parsedCall]); }
              else onContent(parsed.content);
            }
            if (Array.isArray(parsed) && parsed[0]?.name) onToolCalls(parsed);
          } catch { /* skip */ }
        }
      }
    } finally { reader.releaseLock(); }
  }, [filterRawToolCalls]);

  // ── Send message with streaming ───────────────────────────
  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: messageText }]);
    setInput("");
    setIsLoading(true);
    setLoadingText("Balnce is thinking...");
    setLastToolUsed(null);
    let toolWasUsed = false;

    if (user?.id) {
      supabase.from("chat_messages").insert({ user_id: user.id, role: "user", content: messageText }).then();
    }

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const currentPage = getPageLabel(location.pathname);

      const response = await fetch(`${supabaseUrl}/functions/v1/chat-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          message: messageText,
          financialContext,
          chatHistory: messages.slice(-30),
          currentPage,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      let fullContent = "";
      let displayContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      await readStream(
        response,
        (chunk) => {
          fullContent += chunk;
          displayContent = sanitize(fullContent);
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: displayContent };
            return updated;
          });
        },
        async (toolCalls) => {
          for (const tc of toolCalls) {
            const toolName = tc.name;
            setLoadingText(TOOL_STATUS_LABELS[toolName] || "Working on it...");
            setLastToolUsed(toolName);
            toolWasUsed = true;

            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.arguments || "{}"); } catch { /* empty */ }

            const { result, navigated } = executeToolCall(toolName, args, toolContext);

            if (navigated) {
              fullContent += result;
              displayContent = sanitize(fullContent);
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: displayContent };
                return updated;
              });
            } else if (toolName === "show_chart") {
              // Charts render client-side — show directly without two-turn
              fullContent = result;
              displayContent = result;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: displayContent };
                return updated;
              });
            } else {
              setLoadingText("Balnce is thinking...");
              const historyForToolTurn = [
                ...messages.slice(-30),
                { role: "user", content: messageText },
                { role: "assistant", content: "", tool_calls: [{ id: tc.id, type: "function", function: { name: tc.name, arguments: tc.arguments } }] },
              ];

              const toolResponse = await fetch(`${supabaseUrl}/functions/v1/chat-assistant`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                },
                body: JSON.stringify({
                  financialContext,
                  chatHistory: historyForToolTurn,
                  toolResults: [{ tool_call_id: tc.id, name: tc.name, content: result }],
                  currentPage,
                }),
                signal: abortController.signal,
              });

              if (toolResponse.ok) {
                fullContent = "";
                displayContent = "";
                await readStream(
                  toolResponse,
                  (chunk) => {
                    fullContent += chunk;
                    displayContent = sanitize(fullContent);
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = { role: "assistant", content: displayContent };
                      return updated;
                    });
                  },
                  () => {},
                  abortController.signal
                );
              } else {
                // Tool response failed — show the tool result directly
                fullContent = result;
                displayContent = result;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: displayContent };
                  return updated;
                });
              }
            }
          }
        },
        abortController.signal
      );

      const finalContent = displayContent || fullContent;
      if (!finalContent && !toolWasUsed) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "Sorry, I couldn't generate a response. Please try again." };
          return updated;
        });
      }
      if (user?.id && finalContent) {
        supabase.from("chat_messages").insert({ user_id: user.id, role: "assistant", content: finalContent }).then();
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Chat error:", err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev.filter(m => m.content !== ""),
        { role: "assistant", content: `Sorry, something went wrong: ${errMsg}` },
      ]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating penguin button with insight badge */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-5 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full bg-[#FFD700] shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center ring-2 ring-blue-900/30"
          aria-label="Ask Balnce"
        >
          <PenguinIcon className="w-9 h-9" />
          {insightCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
              {insightCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel — larger with history sidebar */}
      {isOpen && (
        <div className="fixed bottom-24 right-3 md:bottom-6 md:right-6 z-50 w-[420px] md:w-[700px] max-w-[calc(100vw-24px)] h-[680px] max-h-[calc(100vh-100px)] bg-background border border-border rounded-2xl shadow-2xl flex overflow-hidden">
          {/* History sidebar */}
          {showHistory && (
            <div className="w-[220px] border-r border-border flex flex-col bg-muted/30 shrink-0">
              <div className="px-3 py-3 border-b border-border flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</p>
                <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <button
                  onClick={() => {
                    setMessages([]);
                    setLastToolUsed(null);
                    setShowHistory(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs border-b border-border/50 hover:bg-muted/50 transition-colors flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  New chat
                </button>
                {conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => {
                      setMessages(convo.messages);
                      setShowHistory(false);
                    }}
                    className="w-full text-left px-3 py-2.5 text-xs border-b border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium text-foreground truncate">{convo.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(convo.date).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                    </p>
                  </button>
                ))}
                {conversations.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">No history yet</p>
                )}
              </div>
            </div>
          )}

          {/* Main chat area */}
          <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-4 py-3 flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Chat history"
            >
              <History className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-[#FFD700] flex items-center justify-center">
              <PenguinIcon className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Balnce</p>
              <p className="text-blue-200 text-xs">AI tax assistant</p>
            </div>
            <button
              onClick={() => {
                setMessages([]);
                setLastToolUsed(null);
              }}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="New chat"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setMessages([]);
                setLastToolUsed(null);
                if (user?.id) {
                  supabase.from("chat_messages").delete().eq("user_id", user.id).then();
                  setConversations([]);
                }
              }}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Clear all history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                {/* Proactive personalized opener */}
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3">
                  {proactiveGreeting ? (
                    <div className="text-sm text-foreground">
                      <ChatMarkdown content={`Hi! I'm **Balnce**, your AI tax assistant. ${proactiveGreeting} Want me to run a **company health check** or **director health check**?`} />
                    </div>
                  ) : (
                    <p className="text-sm text-foreground">
                      Hi! I'm Balnce, your AI tax assistant. I can see your financial data, run calculations, and navigate the app. Ask me anything!
                    </p>
                  )}
                </div>

                {/* Insight cards */}
                {insightCount > 0 && (
                  <div className="space-y-2">
                    {(() => {
                      const cards: { text: string; question: string }[] = [];
                      const uncategorized = allTransactions?.filter((t: { category?: string | Record<string, unknown> | null }) => t.category === "Uncategorized" || !t.category).length ?? 0;
                      if (uncategorized > 5) {
                        cards.push({
                          text: `${uncategorized} transactions need categorizing`,
                          question: `I have ${uncategorized} uncategorized transactions — what should I do?`,
                        });
                      }
                      const anyPension = allForm11Data?.some(f => Number(f.data?.pensionContributions) > 0);
                      if (!anyPension && (allTransactions?.length ?? 0) > 0) {
                        cards.push({
                          text: "No pension contributions — you could save thousands",
                          question: "How much could I save with a €10,000 pension contribution?",
                        });
                      }
                      return cards.map((card, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(card.question)}
                          className="flex items-center gap-2 w-full text-left bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                        >
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-xs text-foreground">{card.text}</span>
                        </button>
                      ));
                    })()}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="block w-full text-left text-xs bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 transition-colors text-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-900 text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <AssistantMessage content={msg.content} />
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}

            {/* Follow-up suggestions after last assistant message */}
            {followUpSuggestions.length > 0 && !isLoading && (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {followUpSuggestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="inline-flex items-center gap-1 text-[11px] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-1 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                  >
                    <ChevronRight className="w-3 h-3" />
                    {q}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2">
                  <BouncingDots text={loadingText} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t px-3 py-2 shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your tax..."
                className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-900/20 placeholder:text-muted-foreground"
                disabled={isLoading}
              />
              <Button
                size="icon"
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="shrink-0 bg-blue-900 hover:bg-blue-800 h-9 w-9"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              AI-generated — verify with a professional before filing
            </p>
          </div>
          </div>
        </div>
      )}
    </>
  );
}
