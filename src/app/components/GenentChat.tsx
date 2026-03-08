import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import {
  ArrowUpIcon,
  Paperclip,
  Instagram,
  Linkedin,
  Twitter,
  Layers,
  Sparkles,
  RefreshCw,
  Rocket,
  Lightbulb,
  Copy,
  Check,
  Download,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { GenentLogo } from "./GenentLogo";

const API_BASE = "https://rcejlzmfh0.execute-api.ap-south-1.amazonaws.com/prod";

interface AutoResizeProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: AutoResizeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset) { textarea.style.height = `${minHeight}px`; return; }
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Infinity));
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );
  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);
  return { textareaRef, adjustHeight };
}

type Platform = "instagram" | "linkedin" | "twitter";
type Tone = "Friendly" | "Neutral" | "Professional" | "Punchy";

interface Draft {
  draft_id: string;
  platform: Platform;
  content: any;
  metadata: { version: number; is_mock?: boolean; action?: string };
}

interface CopyState {
  [key: string]: boolean;
}

// Normalise Llama output which may use different key names than expected
function normaliseContent(platform: Platform, raw: any): any {
  let c = raw;
  if (c && typeof c === "object") {
    if (platform === "instagram" && c.instagram) c = c.instagram;
    else if (platform === "linkedin" && c.linkedin) c = c.linkedin;
    else if (platform === "twitter" && c.twitter) c = c.twitter;
  }

  if (platform === "instagram") {
    const rawSlides = c.slides || c.carousel || c.content || [];
    const slides = rawSlides.map((s: any, i: number) => ({
      title: s.title || s.slide_title || `Slide ${i + 1}`,
      text: s.text || s.content || s.body || s.slide_content || s.caption || "",
    }));
    return {
      slides,
      caption: c.caption || c.post_caption || "",
      hashtags: c.hashtags || c.tags || [],
    };
  }

  if (platform === "linkedin") {
    const body = c.body || c.paragraphs || c.content || [];
    return {
      hook: c.hook || c.opening || c.intro || "",
      body: Array.isArray(body) ? body : [body],
      cta: c.cta || c.call_to_action || c.closing || "",
    };
  }

  if (platform === "twitter") {
    const tweets = c.tweets || c.thread || c.content || c.posts || (Array.isArray(c) ? c : []);
    return { tweets: Array.isArray(tweets) ? tweets : [] };
  }

  return c;
}

export default function GenentChat() {
  const [message, setMessage] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["instagram", "linkedin", "twitter"]);
  const [tone, setTone] = useState<Tone>("Friendly");
  const [screen, setScreen] = useState<"input" | "loading" | "drafts">("input");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activePlatform, setActivePlatform] = useState<Platform>("instagram");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isMock, setIsMock] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [copyStates, setCopyStates] = useState<CopyState>({});
  const [error, setError] = useState<string | null>(null);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 48, maxHeight: 150 });

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? (prev.length > 1 ? prev.filter((x) => x !== p) : prev) : [...prev, p]
    );
  };

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopyStates((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setCopyStates((prev) => ({ ...prev, [key]: false })), 2000);
  };

  const handleGenerate = async () => {
    if (!message.trim()) return;
    setError(null);
    setScreen("loading");
    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: message.trim(), platforms: selectedPlatforms, tone, session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Generation failed");
      const normalisedDrafts = data.drafts.map((d: Draft) => ({
        ...d,
        content: normaliseContent(d.platform, d.content),
      }));
      setDrafts(normalisedDrafts);
      setIsMock(normalisedDrafts[0]?.metadata?.is_mock ?? false);
      setActivePlatform(normalisedDrafts[0]?.platform ?? selectedPlatforms[0]);
      setScreen("drafts");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Try again.");
      setScreen("input");
    }
  };

  const handleFeedback = async (action: string) => {
    const currentDraft = drafts.find((d) => d.platform === activePlatform);
    if (!currentDraft) return;
    setFeedbackLoading(action);
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_id: currentDraft.draft_id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Feedback failed");
      const normalisedContent = normaliseContent(activePlatform, data.revised_draft.content);
      setDrafts((prev) =>
        prev.map((d) => d.platform === activePlatform ? { ...d, ...data.revised_draft, content: normalisedContent } : d)
      );
    } catch {
      // keep current draft
    } finally {
      setFeedbackLoading(null);
    }
  };

  const handleExport = async () => {
    const currentDraft = drafts.find((d) => d.platform === activePlatform);
    if (!currentDraft) return;
    try {
      const res = await fetch(`${API_BASE}/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_id: currentDraft.draft_id, format: "json" }),
      });
      const data = await res.json();
      if (data.download_url) { window.open(data.download_url, "_blank"); return; }
      throw new Error("No URL");
    } catch {
      const blob = new Blob([JSON.stringify(currentDraft?.content, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `genent-${activePlatform}-draft.json`; a.click();
    }
  };

  // ── LOADING SCREEN ──────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <div className="relative w-full h-screen bg-cover bg-center flex flex-col items-center justify-center"
        style={{ backgroundImage: "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_moon_2.png')", backgroundAttachment: "fixed" }}>
        <div className="flex flex-col items-center gap-6">
          <div className="animate-spin"><GenentLogo className="w-20 h-20" /></div>
          <p className="text-white text-lg font-medium animate-pulse">Generating your drafts…</p>
          <p className="text-neutral-400 text-sm">Crafting content for {selectedPlatforms.join(", ")}</p>
        </div>
      </div>
    );
  }

  // ── DRAFTS SCREEN ───────────────────────────────────────────────────────
  if (screen === "drafts") {
    const currentDraft = drafts.find((d) => d.platform === activePlatform);
    const content = currentDraft?.content;

    const renderDraftContent = () => {
      if (!content) return <p className="text-neutral-400">No content found. Try generating again.</p>;

      if (activePlatform === "instagram") {
        const slides: any[] = content.slides || [];
        return (
          <div className="space-y-4">
            {isMock && <div className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded px-3 py-1 inline-block">DEMO MODE</div>}
            {slides.length === 0 && <p className="text-neutral-400 text-sm">No slides returned — try generating again.</p>}
            <div className="grid grid-cols-2 gap-3">
              {slides.map((slide: any, i: number) => (
                <div key={i} className="bg-gradient-to-br from-purple-900/60 to-pink-900/60 border border-purple-700/50 rounded-xl p-4 relative">
                  <p className="text-xs text-purple-300 font-semibold mb-1">{slide.title}</p>
                  <p className="text-white text-sm">{slide.text}</p>
                  <button onClick={() => handleCopy(slide.text, `slide-${i}`)} className="absolute top-2 right-2 text-neutral-400 hover:text-white">
                    {copyStates[`slide-${i}`] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              ))}
            </div>
            {content.caption && (
              <div className="bg-black/40 border border-neutral-700 rounded-xl p-4">
                <p className="text-xs text-neutral-400 mb-1">Caption</p>
                <p className="text-white text-sm">{content.caption}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(content.hashtags || []).map((tag: string, i: number) => (
                <span key={i} className="bg-blue-900/40 text-blue-300 text-xs px-2 py-1 rounded-full border border-blue-700/40">{tag}</span>
              ))}
            </div>
          </div>
        );
      }

      if (activePlatform === "linkedin") {
        const body: string[] = Array.isArray(content.body) ? content.body : [content.body || ""];
        return (
          <div className="space-y-4">
            {isMock && <div className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded px-3 py-1 inline-block">DEMO MODE</div>}
            {content.hook && (
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4">
                <p className="text-xs text-blue-300 font-semibold mb-2">Hook</p>
                <p className="text-white font-medium">{content.hook}</p>
              </div>
            )}
            {body.map((para: string, i: number) => (
              <div key={i} className="bg-black/40 border border-neutral-700 rounded-xl p-4">
                <p className="text-white text-sm leading-relaxed">{para}</p>
              </div>
            ))}
            {content.cta && (
              <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-4 relative">
                <p className="text-xs text-green-300 font-semibold mb-2">Call to Action</p>
                <p className="text-white text-sm">{content.cta}</p>
                <button onClick={() => handleCopy(content.cta, "cta")} className="absolute top-3 right-3 text-neutral-400 hover:text-white">
                  {copyStates["cta"] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
        );
      }

      if (activePlatform === "twitter") {
        const tweets: string[] = content.tweets || [];
        return (
          <div className="space-y-3">
            {isMock && <div className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded px-3 py-1 inline-block">DEMO MODE</div>}
            {tweets.length === 0 && <p className="text-neutral-400 text-sm">No tweets returned — try generating again.</p>}
            {tweets.map((tweet: string, i: number) => (
              <div key={i} className="bg-black/40 border border-neutral-700 rounded-xl p-4 relative">
                <p className="text-xs text-neutral-500 mb-1">{i + 1}/{tweets.length}</p>
                <p className="text-white text-sm leading-relaxed">{tweet}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className={cn("text-xs", tweet.length > 260 ? "text-red-400" : "text-neutral-500")}>{tweet.length}/280</span>
                  <button onClick={() => handleCopy(tweet, `tweet-${i}`)} className="text-neutral-400 hover:text-white">
                    {copyStates[`tweet-${i}`] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      }
    };

    return (
      <div className="relative w-full min-h-screen bg-cover bg-center flex flex-col"
        style={{ backgroundImage: "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_moon_2.png')", backgroundAttachment: "fixed" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => { setScreen("input"); setMessage(""); }} className="text-neutral-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <GenentLogo className="w-8 h-8" />
            <span className="text-white font-semibold">Genent AI</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 max-w-xs truncate">"{message}"</span>
            <Button onClick={handleExport} variant="ghost" size="sm" className="text-neutral-300 hover:text-white gap-1">
              <Download className="w-4 h-4" /> Export
            </Button>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-neutral-800 bg-black/30">
          {drafts.map((d) => (
            <button key={d.platform} onClick={() => setActivePlatform(d.platform)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activePlatform === d.platform ? "bg-white text-black" : "bg-black/40 text-neutral-400 hover:text-white border border-neutral-700")}>
              {d.platform === "instagram" && <Instagram className="w-4 h-4" />}
              {d.platform === "linkedin" && <Linkedin className="w-4 h-4" />}
              {d.platform === "twitter" && <Twitter className="w-4 h-4" />}
              {d.platform.charAt(0).toUpperCase() + d.platform.slice(1)}
              {d.metadata.version > 1 && <span className="text-xs opacity-60">v{d.metadata.version}</span>}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row gap-0">
          <div className="flex-1 p-6 overflow-y-auto">{renderDraftContent()}</div>
          <div className="w-full lg:w-64 p-4 border-t lg:border-t-0 lg:border-l border-neutral-800 bg-black/30 backdrop-blur-sm">
            <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-3">Refine Draft</p>
            <div className="flex flex-col gap-2">
              {[
                { action: "friendlier", label: "😊 Make Friendlier" },
                { action: "shorter", label: "✂️ Shorten" },
                { action: "add_cta", label: "📣 Add CTA" },
                { action: "more_professional", label: "💼 More Professional" },
                { action: "punchier", label: "⚡ Make Punchier" },
              ].map(({ action, label }) => (
                <Button key={action} onClick={() => handleFeedback(action)} disabled={feedbackLoading !== null}
                  variant="outline" className="justify-start text-sm border-neutral-700 bg-black/40 text-neutral-300 hover:text-white hover:bg-neutral-800">
                  {feedbackLoading === action ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                  {label}
                </Button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-800">
              <Button onClick={() => handleCopy(JSON.stringify(content, null, 2), "full-draft")}
                variant="outline" className="w-full justify-start text-sm border-neutral-700 bg-black/40 text-neutral-300 hover:text-white">
                {copyStates["full-draft"] ? <Check className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
                Copy Full Draft
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── INPUT SCREEN ────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-screen bg-cover bg-center flex flex-col items-center"
      style={{ backgroundImage: "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_moon_2.png')", backgroundAttachment: "fixed" }}>
      <div className="flex-1 w-full flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-6"><GenentLogo className="w-24 h-24" /></div>
          <h1 className="text-4xl font-semibold text-white drop-shadow-sm">Genent AI</h1>
          <p className="mt-2 text-neutral-200">Turn one idea into platform-ready content.</p>
        </div>
      </div>

      <div className="w-full max-w-3xl mb-[20vh] px-4">
        {error && (
          <div className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-2">{error}</div>
        )}
        <div className="relative bg-black/60 backdrop-blur-md rounded-xl border border-neutral-700">
          <Textarea ref={textareaRef} value={message}
            onChange={(e) => { setMessage(e.target.value); adjustHeight(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
            placeholder="Describe your idea… (e.g. '3 time-management tips for students')"
            className={cn("w-full px-4 py-3 resize-none border-none bg-transparent text-white text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-neutral-400 min-h-[48px]")}
            style={{ overflow: "hidden" }} />

          <div className="px-4 pb-2 flex flex-wrap items-center gap-2">
            {(["instagram", "linkedin", "twitter"] as Platform[]).map((p) => (
              <button key={p} onClick={() => togglePlatform(p)}
                className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors",
                  selectedPlatforms.includes(p) ? "bg-white text-black border-white" : "border-neutral-600 text-neutral-400 hover:text-white")}>
                {p === "instagram" && <Instagram className="w-3 h-3" />}
                {p === "linkedin" && <Linkedin className="w-3 h-3" />}
                {p === "twitter" && <Twitter className="w-3 h-3" />}
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
            <div className="w-px h-4 bg-neutral-700 mx-1" />
            {(["Friendly", "Neutral", "Professional", "Punchy"] as Tone[]).map((t) => (
              <button key={t} onClick={() => setTone(t)}
                className={cn("text-xs px-2 py-1 rounded-full border transition-colors",
                  tone === t ? "bg-indigo-600 text-white border-indigo-500" : "border-neutral-600 text-neutral-400 hover:text-white")}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between p-3 pt-0">
            <Button variant="ghost" size="icon" className="text-white hover:bg-neutral-700">
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button onClick={handleGenerate} disabled={!message.trim()}
              className={cn("flex items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                message.trim() ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-700 text-neutral-400 cursor-not-allowed")}>
              <ArrowUpIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Generate</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center flex-wrap gap-3 mt-6">
          {[
            { icon: <Instagram className="w-4 h-4" />, label: "Instagram Carousel", text: "Create an Instagram carousel post about " },
            { icon: <Linkedin className="w-4 h-4" />, label: "LinkedIn Post", text: "Write a LinkedIn post about " },
            { icon: <Twitter className="w-4 h-4" />, label: "Twitter Thread", text: "Create a Twitter thread about " },
            { icon: <Layers className="w-4 h-4" />, label: "Multi-Platform Draft", text: "Create content for all platforms about " },
            { icon: <Sparkles className="w-4 h-4" />, label: "Content Hooks", text: "Write attention-grabbing hooks for " },
            { icon: <RefreshCw className="w-4 h-4" />, label: "Repurpose Content", text: "Repurpose this content for social media: " },
            { icon: <Rocket className="w-4 h-4" />, label: "Product Launch Post", text: "Write a product launch announcement for " },
            { icon: <Lightbulb className="w-4 h-4" />, label: "Thought Leadership Post", text: "Write a thought leadership post about " },
          ].map(({ icon, label, text }) => (
            <Button key={label} variant="outline" onClick={() => { setMessage(text); adjustHeight(); }}
              className="flex items-center gap-2 rounded-full border-neutral-700 bg-black/50 text-neutral-300 hover:text-white hover:bg-neutral-700">
              {icon}
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
