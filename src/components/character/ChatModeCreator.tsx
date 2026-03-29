import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw, Send, MessageSquare, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatModeCreatorProps {
  apiKey: string;
  onImagesGenerated: (images: string[]) => void;
  onGenerationStart?: (total: number) => void;
  onGenerationProgress?: (index: number) => void;
  onGenerationEnd?: () => void;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const ChatModeCreator: React.FC<ChatModeCreatorProps> = ({ apiKey, onImagesGenerated, onGenerationStart, onGenerationProgress, onGenerationEnd }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<string[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    if (generatedPrompts && !hasGenerated && apiKey) {
      setChatOpen(false);
      generateImages(generatedPrompts);
    }
  }, [generatedPrompts]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const startChat = async () => {
    setChatStarted(true);
    setMessages([{
      role: "assistant",
      content: "Hallo, hier ist dein KI-Avatar Character Creator Assistent. Beantworte jetzt ein paar Fragen und ich erstelle dir deinen persönlichen KI-Avatar nach deinen Wünschen. Los geht's!\n\nWelches Geschlecht soll dein Avatar haben? (Männlich, Weiblich, Androgyn)"
    }]);
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
        if (parsed.ready && Array.isArray(parsed.prompts) && parsed.prompts.length >= 1) {
          setGeneratedPrompts(parsed.prompts);
        }
      }
    } catch {}
  };

  const handleSend = () => {
    sendMessage(input);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const requestGenerateNow = async () => {
    if (isStreaming || !apiKey) return;
    const triggerMsg = "Fasse meine bisherigen Angaben zusammen und zeige mir die Übersicht. Denke dir fehlende Details selbst aus.";
    await sendMessage(triggerMsg);
  };

  const generateImages = async (prompts: string[]) => {
    if (!prompts || !apiKey) return;
    const limitedPrompts = prompts.slice(0, 10);
    const total = limitedPrompts.length;
    setIsGenerating(true);
    setHasGenerated(true);
    setError(null);
    onGenerationStart?.(total);

    try {
      for (let i = 0; i < total; i++) {
        setGeneratingIndex(i);
        onGenerationProgress?.(i);
        try {
          const img = await generateSingleImage(limitedPrompts[i]);
          if (img) onImagesGenerated([img]);
        } catch (err: any) {
          if (err.message === "rate_limit") {
            await new Promise(r => setTimeout(r, 5000));
            i--;
            continue;
          }
        }
        if (i < total - 1) await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err: any) {
      setError(err.message || "Ein Fehler ist aufgetreten");
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(-1);
      onGenerationEnd?.();
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

  const handleRegenerateWithChanges = async () => {
    setGeneratedPrompts(null);
    setHasGenerated(false);
    const triggerMsg = "Fasse meine bisherigen Angaben inklusive der Änderungen zusammen und zeige mir die aktualisierte Übersicht.";
    await sendMessage(triggerMsg);
  };

  const handleNewChat = () => {
    setMessages([]);
    setGeneratedPrompts(null);
    setError(null);
    setChatStarted(false);
    setChatOpen(true);
    setHasGenerated(false);
  };

  if (!chatStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-center text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <MessageSquare className="w-8 h-8 text-primary/60" />
        </div>
        <p className="text-sm mb-4">Beschreibe deinen Charakter im Chat und die KI erstellt 4 einzigartige Varianten.</p>
        <Button onClick={startChat}>
          <MessageSquare className="w-4 h-4" />Chat starten
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            <div ref={chatContainerRef} className="overflow-y-auto space-y-3 pr-1 max-h-[300px]">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
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

            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasGenerated ? "Beschreibe Änderungen..." : "Deine Eingabe..."}
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
                <Button onClick={handleNewChat} variant="outline" size="sm">
                  <MessageSquare className="w-3.5 h-3.5" />Neu
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>
      )}

      {isGenerating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Generiere Bild {generatingIndex + 1} von {generatedPrompts?.length ?? 4}...
        </div>
      )}
    </div>
  );
};
