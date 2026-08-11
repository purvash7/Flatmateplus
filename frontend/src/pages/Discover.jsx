import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import BottomNav from "@/components/BottomNav";
import SwipeCard from "@/components/SwipeCard";
import MatchModal from "@/components/MatchModal";
import FiltersSheet from "@/components/FiltersSheet";
import Walkthrough, { shouldShowWalkthrough } from "@/components/Walkthrough";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { X, Heart, SlidersHorizontal, Home, MapPin, RotateCcw } from "lucide-react";

export default function Discover() {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [showingNearby, setShowingNearby] = useState(false);
  const [nearestArea, setNearestArea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matchInfo, setMatchInfo] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);

  const load = async (f = filters) => {
    setLoading(true);
    try {
      const params = {};
      if (f.radius_km) params.radius_km = f.radius_km;
      if (f.food?.length) params.food = f.food.join(",");
      if (f.smoking?.length) params.smoking = f.smoking.join(",");
      if (f.drinking?.length) params.drinking = f.drinking.join(",");
      if (f.housing?.length) params.housing = f.housing.join(",");
      if (f.budget_min) params.budget_min = f.budget_min;
      if (f.budget_max) params.budget_max = f.budget_max;
      const { data } = await api.get("/discover", { params });
      const primary = data.primary || [];
      const nb = data.nearby || [];
      setCards(primary);
      setNearby(nb);
      // pull nearest area label from first nearby candidate
      const firstNb = nb[0];
      setNearestArea(firstNb ? (firstNb.user.locality || firstNb.user.city) : null);
      setShowingNearby(!primary.length && !!nb.length);
    } catch (e) {
      console.error("Discover load failed", e);
      toast.error(e.response?.data?.detail || "Failed to load");
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (user?.profile_complete && shouldShowWalkthrough()) {
      const t = setTimeout(() => setWalkthroughOpen(true), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [user?.profile_complete]);

  const applyFilters = (f) => { setFilters(f); load(f); };
  const activeList = showingNearby ? nearby : cards;

  const doSwipe = async (dir) => {
    const top = activeList[0];
    if (!top) return;
    if (showingNearby) setNearby((c) => c.slice(1));
    else setCards((c) => c.slice(1));
    try {
      const { data } = await api.post("/swipe", { target_user_id: top.user.user_id, direction: dir });
      if (data.matched) setMatchInfo({ match: data.match, other: data.other });
    } catch (err) {
      console.error("Swipe failed", err);
      toast.error("Swipe failed");
    }
  };

  const showNearbyNow = () => setShowingNearby(true);

  const reviewPassed = async () => {
    try {
      const { data } = await api.post("/swipes/reset-passed");
      toast.success(`${data.reset || 0} profiles unlocked — take another look!`);
      load();
      setShowingNearby(false);
    } catch (err) {
      toast.error("Couldn't reload passed profiles");
    }
  };

  const activeFiltersCount = ["food", "smoking", "drinking", "housing"].filter((k) => (filters[k] || []).length > 0).length
    + (filters.radius_km && filters.radius_km !== (user?.radius_km ?? 5) ? 1 : 0)
    + ((filters.budget_min && filters.budget_min !== 3000) || (filters.budget_max && filters.budget_max !== 80000) ? 1 : 0);

  const noPrimary = !loading && cards.length === 0 && !showingNearby;
  const totallyEmpty = !loading && cards.length === 0 && nearby.length === 0;
  const showingNearbyEmpty = showingNearby && nearby.length === 0;

  return (
    <div className="app-shell">
      <div className="px-6 pt-8 pb-4 flex items-center justify-between">
        <div>
          <div className="font-mono-label text-primary">DISCOVER</div>
          <h1 className="text-2xl font-display font-extrabold leading-tight">
            {showingNearby ? "Nearby areas" : "Your matches"}
          </h1>
          {user?.locality && !showingNearby && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3"/>{user.locality}, {user.city}
            </div>
          )}
        </div>
        <button data-testid="discover-filters-btn" onClick={() => setFiltersOpen(true)}
                className="relative w-10 h-10 rounded-full bg-card border grid place-items-center hover:bg-secondary">
          <SlidersHorizontal className="w-4 h-4"/>
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Fallback banner: no one in exact area but nearby exist */}
      {noPrimary && nearby.length > 0 && (
        <div data-testid="fallback-banner" className="mx-6 mb-3 p-4 rounded-2xl bg-accent/40 border border-accent">
          <div className="text-sm">
            <span className="font-semibold">No one in {user?.locality || "your area"} yet.</span> Showing profiles from{" "}
            <span className="font-semibold">{nearestArea}</span> that match your preferences.
          </div>
          <button data-testid="show-nearby-btn" onClick={showNearbyNow}
                  className="mt-2 text-sm font-semibold text-primary hover:underline">
            Show nearby profiles →
          </button>
        </div>
      )}
      {showingNearby && (
        <button data-testid="back-to-primary-btn" onClick={() => setShowingNearby(false)}
                className="mx-6 mb-3 text-xs text-primary font-semibold flex items-center gap-1">
          ← Back to my area
        </button>
      )}

      <div className="px-6">
        <div className="relative w-full aspect-[3/4] max-h-[540px]">
          {loading ? (
            <div className="absolute inset-0 rounded-3xl bg-card border grid place-items-center">
              <div className="text-muted-foreground">Finding your people…</div>
            </div>
          ) : totallyEmpty || showingNearbyEmpty ? (
            <div data-testid="empty-state" className="absolute inset-0 rounded-3xl bg-card border grid place-items-center p-8 text-center">
              <div>
                <Home className="w-10 h-10 mx-auto text-muted-foreground"/>
                <div className="font-display font-extrabold text-xl mt-3">
                  You&apos;re all caught up
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Would you like to take a look at the profiles you passed on once again?
                </p>
                <Button data-testid="review-passed-btn" onClick={reviewPassed}
                        className="mt-4 rounded-2xl bg-primary hover:bg-primary/90 gap-2">
                  <RotateCcw className="w-4 h-4"/> Review passed profiles
                </Button>
              </div>
            </div>
          ) : activeList.length === 0 ? (
            <div className="absolute inset-0 rounded-3xl bg-card border grid place-items-center p-8 text-center">
              <div className="text-muted-foreground">Loading…</div>
            </div>
          ) : (
            <AnimatePresence>
              {activeList.slice(0, 3).reverse().map((c, revIdx) => {
                const total = Math.min(activeList.length, 3);
                const index = total - 1 - revIdx;
                const isTop = index === 0;
                return <SwipeCard key={c.user.user_id} candidate={c} onSwipe={doSwipe} isTop={isTop} index={index}/>;
              })}
            </AnimatePresence>
          )}
        </div>

        {activeList.length > 0 && !loading && (
          <div className="mt-6 flex items-center justify-center gap-6">
            <Button data-testid="swipe-pass-btn" onClick={() => doSwipe("pass")} variant="outline"
                    className="w-16 h-16 rounded-full border-2 shadow-soft bg-card hover:bg-secondary">
              <X className="w-6 h-6 text-destructive"/>
            </Button>
            <Button data-testid="swipe-like-btn" onClick={() => doSwipe("like")}
                    className="w-20 h-20 rounded-full bg-primary hover:bg-primary/90 shadow-lift">
              <Heart className="w-8 h-8" fill="currentColor"/>
            </Button>
          </div>
        )}
      </div>

      {matchInfo && (
        <MatchModal match={matchInfo.match} other={matchInfo.other} meName={user?.name} onClose={() => setMatchInfo(null)}/>
      )}

      <FiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen}
                    filters={filters} onApply={applyFilters} userRadius={user?.radius_km}/>

      <Walkthrough open={walkthroughOpen} onClose={() => setWalkthroughOpen(false)}/>

      <BottomNav/>
    </div>
  );
}
