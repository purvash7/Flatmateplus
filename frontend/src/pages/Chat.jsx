import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fileUrl, BACKEND_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Send, Sparkles } from "lucide-react";

function Avatar({ user }) {
  const [broken, setBroken] = useState(false);
  const photo = user?.photos?.[0];
  const initial = user?.name?.[0] || "?";
  if (photo && !broken) {
    return (
      <img
        src={fileUrl(photo)} alt={user?.name}
        onError={() => setBroken(true)}
        className="w-10 h-10 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full grid place-items-center font-display font-bold text-primary bg-secondary">
      {initial}
    </div>
  );
}

export default function Chat() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [other, setOther] = useState(null);
  const [score, setScore] = useState(0);
  const scrollRef = useRef();
  const wsRef = useRef();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: matches } = await api.get("/matches");
        if (cancelled) return;
        const m = matches.find((x) => x.match.match_id === matchId);
        if (!m) { navigate("/matches"); return; }
        setOther(m.other);
        setScore(m.match.score);
        const { data: messages } = await api.get(`/messages/${matchId}`);
        if (!cancelled) setMsgs(messages);
      } catch (e) {
        console.error("Failed to load chat", e);
        toast.error("Couldn't load conversation");
      }
    })();
    return () => { cancelled = true; };
  }, [matchId, navigate]);

  useEffect(() => {
    if (!user) return undefined;
    const token = localStorage.getItem("fm_token");
    if (!token) return undefined;
    let ws;
    let closed = false;
    let reconnectTimer;

    const connect = () => {
      const wsUrl = BACKEND_URL.replace(/^http/, "ws") + `/api/ws/${user.user_id}?token=${token}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (d.type === "message" && d.message.match_id === matchId) {
            setMsgs((m) => (m.some((x) => x.message_id === d.message.message_id) ? m : [...m, d.message]));
          }
        } catch (err) {
          console.error("WS parse error", err);
        }
      };
      ws.onerror = (err) => { console.error("WS error", err); };
      ws.onclose = () => {
        if (closed) return;
        reconnectTimer = setTimeout(connect, 2000);
      };
    };
    connect();

    // Polling backup — merges any messages the WS missed
    const pollTimer = setInterval(async () => {
      try {
        const { data } = await api.get(`/messages/${matchId}`);
        setMsgs((prev) => {
          const seen = new Set(prev.map((x) => x.message_id));
          const merged = [...prev];
          for (const m of data) if (!seen.has(m.message_id)) merged.push(m);
          return merged;
        });
      } catch (err) {
        // silent — likely transient
      }
    }, 3000);

    return () => {
      closed = true;
      clearInterval(pollTimer);
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [user, matchId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const { data } = await api.post("/messages", { match_id: matchId, text: text.trim() });
      setMsgs((m) => (m.some((x) => x.message_id === data.message_id) ? m : [...m, data]));
      setText("");
    } catch (err) {
      console.error("Send failed", err);
      toast.error("Couldn't send. Try again.");
    }
  };

  return (
    <div className="app-shell flex flex-col h-[100dvh]">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b px-4 py-3 flex items-center gap-3">
        <button data-testid="chat-back-btn" onClick={() => navigate("/matches")}
                className="w-9 h-9 rounded-full grid place-items-center hover:bg-secondary">
          <ArrowLeft className="w-4 h-4"/>
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden">
          <Avatar user={other}/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold truncate">{other?.name}</div>
          <div className="text-xs text-primary flex items-center gap-1"><Sparkles className="w-3 h-3"/>{score}% match</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {msgs.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6">
            You matched with {other?.name}. Break the ice!
          </div>
        )}
        {msgs.map((m) => {
          const mine = m.sender_id === user?.user_id;
          return (
            <div key={m.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border rounded-bl-md"}`}>
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="border-t px-3 py-3 flex items-center gap-2 bg-background">
        <Input data-testid="chat-input" value={text} onChange={(e) => setText(e.target.value)}
               placeholder={`Message ${other?.name || ""}`}
               className="rounded-full h-11 bg-card"/>
        <Button data-testid="chat-send-btn" type="submit"
                className="w-11 h-11 rounded-full bg-primary hover:bg-primary/90 p-0 shrink-0">
          <Send className="w-4 h-4"/>
        </Button>
      </form>
    </div>
  );
}
