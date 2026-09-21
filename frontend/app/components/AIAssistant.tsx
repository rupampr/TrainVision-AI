"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { AIRecommendation, AIChatMessage, AIStatus } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  apiUrl?: string;
  onSelectTrain?: (trainId: string, stationId: string) => void;
}

export default function AIAssistant({
  isOpen,
  onClose,
  apiUrl = "http://127.0.0.1:8000",
  onSelectTrain,
}: Props) {
  const [activeTab, setActiveTab] = useState<"recommendations" | "chat">("recommendations");
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  
  // Recommendations state
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState<boolean>(false);
  const [recsError, setRecsError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello, Controller. I am TrainVision AI Copilot powered by Google Gemini. Ask me anything about current platform congestion, train delays, or conflict resolutions across Howrah, Santragachi, and Kharagpur.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState<string>("");
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch AI configuration status
  useEffect(() => {
    fetch(`${apiUrl}/ai/status`)
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then((data) => setAiStatus(data))
      .catch((err) => {
        console.error("AI Status fetch error:", err);
      });
  }, [apiUrl]);

  // Fetch recommendations
  const fetchRecommendations = async () => {
    setLoadingRecs(true);
    setRecsError(null);
    try {
      const res = await fetch(`${apiUrl}/recommendations`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRecsError(msg);
    } finally {
      setLoadingRecs(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "recommendations" && recommendations.length === 0 && !loadingRecs) {
      fetchRecommendations();
    }
  }, [isOpen, activeTab]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAnswering, activeTab]);

  // Handle free-text query
  const handleSendChat = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isAnswering) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsAnswering(true);
    setChatError(null);

    try {
      const res = await fetch(`${apiUrl}/ai/analyze-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSend.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Server error (${res.status})`);
      }

      const data = await res.json();
      const aiMsg: AIChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text: data.answer || "No response generated.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setChatError(msg);
      const errorMsg: AIChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: `⚠️ Analysis failed: ${msg}. If Gemini API is unconfigured, please set GEMINI_API_KEY in backend/.env.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAnswering(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSendChat();
  };

  const quickPrompts = [
    "Summarize current bottlenecks across all stations",
    "Which trains have the highest delay?",
    "Why are conflicts occurring at Howrah?",
    "Suggest priority allocation strategy",
  ];

  // Listen for Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer */}
      <div 
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-panel border-l border-border shadow-2xl shadow-black/70 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label="TrainVision AI Copilot"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-panel-alt/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-cyan-400 p-0.5 shadow-sm shadow-cyan/30 flex items-center justify-center text-slate-950 font-bold">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2v4" />
                <path d="m4.93 4.93 2.83 2.83" />
                <path d="M2 12h4" />
                <path d="m4.93 19.07 2.83-2.83" />
                <path d="M12 22v-4" />
                <path d="m19.07 19.07-2.83-2.83" />
                <path d="M22 12h-4" />
                <path d="m19.07 4.93-2.83 2.83" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-primary">
                  TrainVision AI Copilot
                </h2>
                {aiStatus?.configured ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Gemini Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-mono font-medium bg-amber/10 border border-amber/20 text-amber">
                    API Key Needed
                  </span>
                )}
              </div>
              <p className="text-[11px] text-dim font-mono">
                Model: {aiStatus?.model || "gemini-2.5-flash"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close AI Assistant drawer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-5 border-b border-border bg-deep/40 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("recommendations")}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "recommendations"
                ? "border-cyan text-cyan font-semibold"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Smart Recommendations
            {recommendations.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-cyan/20 text-cyan">
                {recommendations.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "chat"
                ? "border-cyan text-cyan font-semibold"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Operations Chat
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* RECOMMENDATIONS TAB */}
          {activeTab === "recommendations" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-dim">
                  AI Platform Recommendations
                </span>
                <button
                  type="button"
                  onClick={fetchRecommendations}
                  disabled={loadingRecs}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-deep border border-border hover:border-cyan/40 text-secondary hover:text-cyan text-xs font-mono transition-all cursor-pointer disabled:opacity-50"
                >
                  <svg className={`w-3 h-3 ${loadingRecs ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2v6h-6" />
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                    <path d="M3 22v-6h6" />
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  </svg>
                  {loadingRecs ? "Analyzing..." : "Refresh"}
                </button>
              </div>

              {/* Unconfigured API Notice */}
              {aiStatus && !aiStatus.configured && (
                <div className="p-3.5 rounded-lg border border-amber/30 bg-amber/5 text-xs text-amber space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Gemini API Key Required
                  </div>
                  <p className="text-secondary leading-relaxed">
                    To activate live Gemini 2.5 Flash recommendations and chatbot Q&amp;A, add your key to <code className="text-primary bg-deep px-1 py-0.5 rounded font-mono text-[11px]">backend/.env</code>:
                  </p>
                  <div className="p-2 rounded bg-deep/80 font-mono text-[11px] text-cyan select-all">
                    GEMINI_API_KEY=your_key_here
                  </div>
                </div>
              )}

              {recsError && (
                <div className="p-3 rounded-lg border border-red/30 bg-red/10 text-xs text-red">
                  {recsError}
                </div>
              )}

              {loadingRecs ? (
                <div className="py-12 text-center text-dim space-y-2">
                  <div className="w-8 h-8 mx-auto rounded-full border-2 border-cyan border-t-transparent animate-spin" />
                  <p className="text-xs font-mono">Gemini is synthesizing conflict patterns...</p>
                </div>
              ) : recommendations.length > 0 ? (
                recommendations.map((rec, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl border border-border bg-panel-alt/50 hover:border-slate-700 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-deep border border-border">
                          {rec.train_id}
                        </span>
                        <span className="font-mono text-xs text-secondary">
                          @ {rec.station_id}
                        </span>
                      </div>

                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold border ${
                        rec.priority_level === "high"
                          ? "bg-red/10 border-red/30 text-red"
                          : rec.priority_level === "medium"
                          ? "bg-amber/10 border-amber/30 text-amber"
                          : "bg-cyan/10 border-cyan/30 text-cyan"
                      }`}>
                        {rec.priority_level} priority
                      </span>
                    </div>

                    <div className="text-xs font-medium text-slate-100">
                      {rec.suggestion}
                    </div>

                    <div className="text-xs text-secondary leading-relaxed bg-deep/60 p-2.5 rounded-lg border border-border/80">
                      <span className="text-dim font-medium block mb-0.5">Rationale:</span>
                      {rec.rationale}
                    </div>

                    {onSelectTrain && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTrain(rec.train_id, rec.station_id);
                          onClose();
                        }}
                        className="text-xs text-cyan hover:text-cyan-glow font-medium inline-flex items-center gap-1 cursor-pointer pt-1"
                      >
                        Pre-fill in override panel &rarr;
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center rounded-xl border border-dashed border-border/80 bg-deep/30 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-cyan/10 border border-cyan/20 text-cyan flex items-center justify-center mx-auto">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-primary">No pending recommendations</p>
                  <p className="text-[11px] text-dim max-w-xs mx-auto">
                    Either no active platform conflicts are detected, or the current schedule is operating within optimal margins.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* OPERATIONS CHAT TAB */}
          {activeTab === "chat" && (
            <div className="flex flex-col h-full space-y-4">
              {/* Quick Prompts */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-dim block">
                  Quick Prompts
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendChat(prompt)}
                      disabled={isAnswering}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-deep border border-border hover:border-cyan/40 text-secondary hover:text-cyan transition-all text-left cursor-pointer disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Message History */}
              <div className="space-y-3 pt-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl p-3.5 text-xs leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-cyan/15 border border-cyan/30 text-slate-100 rounded-br-xs"
                          : "bg-panel-alt border border-border text-slate-200 rounded-bl-xs shadow-md shadow-black/20"
                      }`}
                    >
                      {msg.sender === "assistant" && (
                        <div className="flex items-center gap-1.5 mb-1.5 text-cyan font-mono text-[10px] font-bold uppercase tracking-wider">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 2v4" />
                            <path d="M2 12h4" />
                            <path d="M12 22v-4" />
                            <path d="M22 12h-4" />
                          </svg>
                          Gemini Operations Assistant
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>
                    <span className="text-[10px] text-dim font-mono mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}

                {isAnswering && (
                  <div className="flex flex-col items-start">
                    <div className="max-w-[85%] rounded-xl p-3.5 text-xs bg-panel-alt border border-border text-dim flex items-center gap-2.5 shadow-md shadow-black/20">
                      <div className="w-4 h-4 rounded-full border-2 border-cyan border-t-transparent animate-spin" />
                      <span>Gemini is analyzing the schedule...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Chat Input Bar (only shown on chat tab) */}
        {activeTab === "chat" && (
          <div className="p-4 border-t border-border bg-panel-alt/90">
            <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about trains, delays, or platform conflicts..."
                disabled={isAnswering}
                className="flex-1 bg-deep border border-border hover:border-slate-700 text-primary text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/40 focus:border-cyan transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || isAnswering}
                className="px-3.5 py-2.5 rounded-lg bg-cyan hover:bg-cyan-glow text-deep font-semibold text-xs transition-all shadow-md shadow-cyan/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                aria-label="Send query"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
