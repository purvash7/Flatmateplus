import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import BottomNav from "@/components/BottomNav";
import SwipeCard from "@/components/SwipeCard";
import MatchModal from "@/components/MatchModal";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { X, Heart, RefreshCw, Home } from "lucide-react";

export default function Discover() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchInfo, setMatchInfo] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/discover");
      setCandidates(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const doSwipe = async (dir) => {
    const top = candidates[0];
    if (!top) return;
    setCandidates(c => c.slice(1));
    try {
      const { data } = await api.post("/swipe", { target_user_id: top.user.user_id, direction: dir });
      if (data.matched) setMatchInfo({ match: data.match, other: data.other });
    } catch (e) {
      toast.error("Swipe failed");
    }
  };

  return (
    <div className="app-shell">
      <div className="px-6 pt-8 pb-4 flex items-center justify-between">
        <div>
          <div className="font-mono-label text-primary">DISCOVER</div>
          <h1 className="text-2xl font-display font-extrabold leading-tight">Your matches</h1>
        </div>
        <button data-testid="discover-refresh-btn" onClick={load} className="w-10 h-10 rounded-full bg-card border grid place-items-center hover:bg-secondary">
          <RefreshCw className="w-4 h-4"/>
        </button>
      </div>

      <div className="px-6">
        <div className="relative w-full aspect-[3/4] max-h-[540px]">
          {loading ? (
            <div className="absolute inset-0 rounded-3xl bg-card border grid place-items-center">
              <div className="text-muted-foreground">Finding your people…</div>
            </div>
          ) : candidates.length === 0 ? (
            <div className="absolute inset-0 rounded-3xl bg-card border grid place-items-center p-8 text-center">
              <div>
                <Home className="w-10 h-10 mx-auto text-muted-foreground"/>
                <div className="font-display font-extrabold text-xl mt-3">You&apos;re all caught up</div>
                <p className="text-sm text-muted-foreground mt-1">Come back later — new folks join every day.</p>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {candidates.slice(0, 3).reverse().map((c, revIdx) => {
                const total = Math.min(candidates.length, 3);
                const index = total - 1 - revIdx;
                const isTop = index === 0;
                return <SwipeCard key={c.user.user_id} candidate={c} onSwipe={doSwipe} isTop={isTop} index={index}/>;
              })}
            </AnimatePresence>
          )}
        </div>

        {candidates.length > 0 && !loading && (
          <div className="mt-6 flex items-center justify-center gap-6">
            <Button data-testid="swipe-pass-btn" onClick={()=>doSwipe("pass")} variant="outline"
                    className="w-16 h-16 rounded-full border-2 shadow-soft bg-card hover:bg-secondary">
              <X className="w-6 h-6 text-destructive"/>
            </Button>
            <Button data-testid="swipe-like-btn" onClick={()=>doSwipe("like")}
                    className="w-20 h-20 rounded-full bg-primary hover:bg-primary/90 shadow-lift">
              <Heart className="w-8 h-8" fill="currentColor"/>
            </Button>
          </div>
        )}
      </div>

      {matchInfo && (
        <MatchModal match={matchInfo.match} other={matchInfo.other} meName={user?.name} onClose={()=>setMatchInfo(null)}/>
      )}

      <BottomNav/>
    </div>
  );
}
