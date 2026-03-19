import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, RotateCcw, Send, ImageIcon, MessageSquare, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Image as LucideImage } from "lucide-react";

interface ChatModeCreatorProps {
  apiKey: string;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const COLLAGE_LABELS = ["Charakter 1", "Charakter 2", "Charakter 3", "Charakter 4"];

export const ChatModeCreator: React.FC<ChatModeCreatorProps> = ({ apiKey }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<string[] | null>(null);
  const [collageImages, setCollageImages] = useState<(string | null)[]>([null, null, null, null]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  // Auto-generate when prompts become available
  useEffect(() => {
    if (generatedPrompts && !hasGenerated && apiKey) {
      setChatOpen(false);
      generateImages(generatedPrompts);
    }
  }, [generatedPrompts]);

  const startChat = async () => {
    setChatStarted(true);
    await sendMessage("Hallo, ich möchte einen Charakter erstellen.");
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    let assistantContent = "";

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/character-chat`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Fehler: ${resp.status}`);
      }

      if (!resp.body) throw new Error("Keine Streaming-Antwort erhalten");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content
              || parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {}
        }
      }

      if (assistantContent) {
        tryExtractPrompts(assistantContent);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: `❌ Fehler: ${err.message || "Verbindungsfehler"}` }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const tryExtractPrompts = (text: string) => {
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        if (parsed.ready && Array.isArray(parsed.prompts) && parsed.prompts.length >= 4) {
          setGeneratedPrompts(parsed.prompts.slice(0, 4));
        }
      }
    } catch {}
  };

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Request prompts from the AI based on current conversation, then auto-generate
  const requestGenerateNow = async () => {
    if (isStreaming || !apiKey) return;
    const triggerMsg = "Erstelle jetzt die 4 Prompts basierend auf den bisherigen Angaben. Denke dir fehlende Details selbst aus.";
    await sendMessage(triggerMsg);
  };

  const generateImages = async (prompts: string[]) => {
    if (!prompts || !apiKey) return;
    setIsGenerating(true);
    setHasGenerated(true);
    setError(null);
    setCollageImages([null, null, null, null]);

    try {
      for (let i = 0; i < 4; i++) {
        setGeneratingIndex(i);
        try {
          const img = await generateSingleImage(prompts[i]);
          if (img) {
            setCollageImages(prev => { const next = [...prev]; next[i] = img; return next; });
          }
        } catch (err: any) {
          if (err.message === "rate_limit") {
            await new Promise(r => setTimeout(r, 5000));
            i--;
            continue;
          }
        }
        if (i < 3) await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err: any) {
      setError(err.message || "Ein Fehler ist aufgetreten");
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(-1);
    }
  };

  const generateSingleImage = async (prompt: string): Promise<string | null> => {
    const model = "gemini-3.1-flash-image-preview";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) throw new Error("rate_limit");
      throw new Error(`API Fehler: ${response.status}`);
    }

    const data = await response.json();
    const candidates = data?.candidates ?? [];
    if (candidates[0]?.finishReason === "IMAGE_OTHER" || candidates[0]?.finishReason === "SAFETY") return null;
    const imgParts = candidates[0]?.content?.parts ?? [];
    const imagePart = imgParts.find((p: any) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/"));
    if (imagePart?.inlineData) {
      return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
    }
    return null;
  };

  const handleDownloadCollage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imgSize = 512, padding = 12, cols = 2, rows = 2;
    canvas.width = cols * imgSize + (cols + 1) * padding;
    canvas.height = rows * imgSize + (rows + 1) * padding;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => { const img = new window.Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });

    for (let i = 0; i < 4; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = padding + col * (imgSize + padding), y = padding + row * (imgSize + padding);
      if (collageImages[i]) {
        try {
          const img = await loadImage(collageImages[i]!);
          const radius = 16;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, y, imgSize, imgSize, radius);
          ctx.clip();
          const scale = Math.max(imgSize / img.width, imgSize / img.height);
          const sw = imgSize / scale, sh = imgSize / scale;
          ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, imgSize, imgSize);
          ctx.restore();
        } catch { ctx.fillStyle = "#2a2a3e"; ctx.fillRect(x, y, imgSize, imgSize); }
      } else {
        ctx.fillStyle = "#2a2a3e"; ctx.fillRect(x, y, imgSize, imgSize);
      }
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y + imgSize - 36, imgSize, 36);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(COLLAGE_LABELS[i], x + imgSize / 2, y + imgSize - 12);
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `character-collage-${Date.now()}.png`;
    link.click();
  }, [collageImages]);

  const handleDownloadSingle = (index: number) => {
    const img = collageImages[index];
    if (!img) return;
    const link = document.createElement("a");
    link.href = img;
    link.download = `character-${index + 1}-${Date.now()}.png`;
    link.click();
  };

  const handleRegenerate = () => {
    if (!generatedPrompts) return;
    setCollageImages([null, null, null, null]);
    generateImages(generatedPrompts);
  };

  const handleRegenerateWithChanges = async () => {
    setGeneratedPrompts(null);
    setHasGenerated(false);
    const triggerMsg = "Erstelle jetzt neue 4 Prompts basierend auf allen bisherigen Angaben und Änderungen. Denke dir fehlende Details selbst aus.";
    await sendMessage(triggerMsg);
  };

  const handleNewChat = () => {
    setMessages([]);
    setGeneratedPrompts(null);
    setCollageImages([null, null, null, null]);
    setError(null);
    setChatStarted(false);
    setChatOpen(true);
    setHasGenerated(false);
  };

  const hasAnyImage = collageImages.some(img => img !== null);

  // ─── Not started yet ───
  if (!chatStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center text-muted-foreground">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <MessageSquare className="w-10 h-10 text-primary/60" />
        </div>
        <p className="text-sm mb-4">Beschreibe deinen Charakter im Chat und die KI erstellt 4 einzigartige Varianten.</p>
        <Button onClick={startChat}>
          <MessageSquare className="w-4 h-4" />Chat starten
        </Button>
      </div>
    );
  }

  // ─── Main view: Chat + Images ───
  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />

      {/* Collapsible Chat */}
      <div className="border border-border/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Chat {messages.length > 0 && `(${messages.length} Nachrichten)`}
          </span>
          {chatOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {chatOpen && (
          <div className="p-4 space-y-3">
            {/* Messages */}
            <div className="overflow-y-auto space-y-3 pr-1 max-h-[350px]">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted/50 text-foreground rounded-bl-md"
                  )}>
                    {msg.role === "assistant" && msg.content.includes('"ready"') 
                      ? "✅ Prompts erstellt! Bilder werden generiert..."
                      : msg.content}
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasGenerated ? "Beschreibe Änderungen..." : "Beschreibe deinen Charakter..."}
                rows={2}
                className="resize-none flex-1"
                disabled={isStreaming}
              />
              <div className="flex flex-col gap-1.5 shrink-0 self-end">
                <Button onClick={handleSend} disabled={!input.trim() || isStreaming} size="icon" title="Senden">
                  {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Action buttons under chat */}
            {!isGenerating && (
              <div className="flex gap-2 pt-1">
                {hasGenerated ? (
                  <Button onClick={handleRegenerateWithChanges} disabled={isStreaming} variant="outline" size="sm" className="flex-1">
                    <RotateCcw className="w-3.5 h-3.5" />Mit Änderungen neu generieren
                  </Button>
                ) : (
                  <Button onClick={requestGenerateNow} disabled={isStreaming || messages.length < 2} size="sm" className="flex-1">
                    <Sparkles className="w-3.5 h-3.5" />Jetzt generieren
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>
      )}

      {/* Image Grid */}
      {(hasAnyImage || isGenerating) && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2 max-w-xl">
            {COLLAGE_LABELS.map((label, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden border border-border/50 bg-muted/20 aspect-square group">
                {collageImages[i] ? (
                  <>
                    <img src={collageImages[i]!} alt={label} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                      <p className="text-[10px] text-white font-medium text-center">{label}</p>
                    </div>
                    <button onClick={() => handleDownloadSingle(i)} className="absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Download className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    {isGenerating && generatingIndex === i
                      ? <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      : <LucideImage className="w-5 h-5 text-muted-foreground/30" />}
                    <p className="text-[10px] mt-1">{label}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasAnyImage && !isGenerating && (
            <div className="flex gap-3">
              <Button onClick={handleDownloadCollage} variant="outline" className="flex-1">
                <Download className="w-4 h-4" />Collage herunterladen
              </Button>
              <Button onClick={handleRegenerate} variant="outline" className="flex-1">
                <RotateCcw className="w-4 h-4" />Gleiche Prompts
              </Button>
              <Button onClick={handleNewChat} variant="outline">
                <MessageSquare className="w-4 h-4" />Neu
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Hint when no images yet and chat is closed */}
      {!hasAnyImage && !isGenerating && !chatOpen && (
        <div className="text-center text-muted-foreground text-sm py-6">
          <p>Öffne den Chat um deinen Charakter zu beschreiben oder klicke auf "Jetzt generieren".</p>
        </div>
      )}
    </div>
  );
};
