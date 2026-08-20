import { useEffect, useState, useCallback } from "react";
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

function presetFilters(user){
  const nn=new Set(user?.non_negotiables||[]);
  const out={radius_km:user?.radius_km??5,food:[],smoking:[],drinking:[],housing:[],budget_min:3000,budget_max:80000,cleanliness:[],pets_ok:[],male_guests_ok:[],family_visits_ok:[],hosts_parties:[],sleep_schedule:[]};
  if(nn.has("food_pref")&&user?.food_pref)out.food=[user.food_pref];
  if(nn.has("smoking")&&user?.smoking)out.smoking=[user.smoking];
  if(nn.has("drinking")&&user?.drinking)out.drinking=[user.drinking];
  if(nn.has("cleanliness")&&user?.cleanliness)out.cleanliness=[String(user.cleanliness)];
  if(nn.has("pets_ok")&&typeof user?.pets_ok==="boolean")out.pets_ok=[String(user.pets_ok)];
  if(nn.has("male_guests_ok")&&typeof user?.male_guests_ok==="boolean")out.male_guests_ok=[String(user.male_guests_ok)];
  if(nn.has("family_visits_ok")&&typeof user?.family_visits_ok==="boolean")out.family_visits_ok=[String(user.family_visits_ok)];
  if(nn.has("hosts_parties")&&user?.hosts_parties)out.hosts_parties=[user.hosts_parties];
  if(nn.has("sleep_schedule")&&user?.sleep_schedule)out.sleep_schedule=[user.sleep_schedule];
  return out;
}

export default function Discover(){
  const{user}=useAuth();
  const[filters,setFilters]=useState(()=>presetFilters(user));
  const[cards,setCards]=useState([]);
  const[nearby,setNearby]=useState([]);
  const[showingNearby,setShowingNearby]=useState(false);
  const[nearestArea,setNearestArea]=useState(null);
  const[loading,setLoading]=useState(true);
  const[matchInfo,setMatchInfo]=useState(null);
  const[filtersOpen,setFiltersOpen]=useState(false);
  const[walkthroughOpen,setWalkthroughOpen]=useState(false);
  const[revisitMode,setRevisitMode]=useState(false);

  const load=useCallback(async(f=filters,{silent=false}={})=>{
    if(!silent)setLoading(true);
    try{
      const params={};
      Object.entries(f).forEach(([k,v])=>{
        if(Array.isArray(v)&&v.length)params[k]=v.join(",");
        else if(v!==""&&v!=null&&!Array.isArray(v))params[k]=v;
      });
      const{data}=await api.get("/discover-v2",{params});
      const primary=data.primary||[];
      const nb=data.nearby||[];
      setCards(primary);
      setNearby(nb);
      setNearestArea(nb[0]?(nb[0].user.locality||nb[0].user.city):null);
      if(!revisitMode)setShowingNearby(!primary.length&&!!nb.length);
    }catch(e){
      console.error(e);
      if(!silent)toast.error(e.response?.data?.detail||"Failed to load");
    }finally{if(!silent)setLoading(false)}
  },[filters,revisitMode]);

  useEffect(()=>{if(user){const next=presetFilters(user);setFilters(next);load(next)}},[user?.user_id]);

  // Keep Discover synchronized with newly completed profiles without requiring a refresh.
  // A short polling interval is used because the public discovery endpoint is stateless.
  useEffect(()=>{
    if(!user?.user_id)return;
    const timer=setInterval(()=>load(filters,{silent:true}),5000);
    return()=>clearInterval(timer);
  },[user?.user_id,filters,load]);

  useEffect(()=>{
    if(user?.profile_complete&&shouldShowWalkthrough()){
      const t=setTimeout(()=>setWalkthroughOpen(true),400);
      return()=>clearTimeout(t);
    }
  },[user?.profile_complete]);

  const applyFilters=f=>{setRevisitMode(false);setFilters(f);load(f)};
  const activeList=showingNearby?nearby:cards;

  const doSwipe=async dir=>{
    const top=activeList[0];
    if(!top)return;
    if(showingNearby)setNearby(c=>c.slice(1));else setCards(c=>c.slice(1));
    try{
      const{data}=await api.post("/swipe",{target_user_id:top.user.user_id,direction:dir});
      if(data.matched)setMatchInfo({match:data.match,other:data.other});
    }catch{toast.error("Swipe failed")}
  };

  const reviewPassed=async()=>{
    try{
      const{data}=await api.post("/swipes/reset-passed");
      setRevisitMode(true);
      setShowingNearby(false);
      toast.success(data.reset?`${data.reset} skipped profiles unlocked — take another look!`:"No skipped profiles yet.");
      await load(filters);
    }catch{toast.error("Couldn't reload passed profiles")}
  };

  const activeFiltersCount=["food","smoking","drinking","housing","cleanliness","pets_ok","male_guests_ok","family_visits_ok","hosts_parties","sleep_schedule"].filter(k=>(filters[k]||[]).length>0).length+(filters.radius_km&&(filters.radius_km!==(user?.radius_km??5))?1:0)+((filters.budget_min&&filters.budget_min!==3000)||(filters.budget_max&&filters.budget_max!==80000)?1:0);
  const noPrimary=!loading&&cards.length===0&&!showingNearby;
  const totallyEmpty=!loading&&cards.length===0&&nearby.length===0;
  const showingNearbyEmpty=showingNearby&&nearby.length===0;

  return <div className="app-shell">
    <div className="px-6 pt-8 pb-4 flex items-center justify-between">
      <div><div className="font-mono-label text-primary">DISCOVER</div><h1 className="text-2xl font-display font-extrabold leading-tight">{revisitMode?"Revisiting skipped profiles":showingNearby?"Nearby areas":"Your matches"}</h1>{user?.locality&&!showingNearby&&<div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3"/>{user.locality}, {user.city}</div>}</div>
      <button data-testid="discover-filters-btn" onClick={()=>setFiltersOpen(true)} className="relative w-10 h-10 rounded-full bg-card border grid place-items-center hover:bg-secondary"><SlidersHorizontal className="w-4 h-4"/>{activeFiltersCount>0&&<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">{activeFiltersCount}</span>}</button>
    </div>
    {revisitMode&&<div data-testid="revisit-banner" className="mx-6 mb-3 p-3 rounded-2xl bg-primary/10 border border-primary/20 text-sm"><span className="font-semibold">Revisiting your skipped profiles.</span> These profiles can be swiped again.</div>}
    {noPrimary&&nearby.length>0&&<div data-testid="fallback-banner" className="mx-6 mb-3 p-4 rounded-2xl bg-accent/40 border border-accent"><div className="text-sm"><span className="font-semibold">No one in {user?.locality||"your area"} yet.</span> Showing profiles from <span className="font-semibold">{nearestArea}</span> that match your preferences.</div><button data-testid="show-nearby-btn" onClick={()=>setShowingNearby(true)} className="mt-2 text-sm font-semibold text-primary hover:underline">Show nearby profiles →</button></div>}
    {showingNearby&&<button data-testid="back-to-primary-btn" onClick={()=>setShowingNearby(false)} className="mx-6 mb-3 text-xs text-primary font-semibold">← Back to my area</button>}
    <div className="px-6"><div className="relative w-full aspect-[3/4] max-h-[540px]">
      {loading?<div className="absolute inset-0 rounded-3xl bg-card border grid place-items-center"><div className="text-muted-foreground">Finding your people…</div></div>:totallyEmpty||showingNearbyEmpty?<div data-testid="empty-state" className="absolute inset-0 rounded-3xl bg-card border grid place-items-center p-8 text-center"><div><Home className="w-10 h-10 mx-auto text-muted-foreground"/><div className="font-display font-extrabold text-xl mt-3">You're all caught up</div><p className="text-sm text-muted-foreground mt-2">Would you like to take a look at the profiles you passed on once again?</p><Button data-testid="review-passed-btn" onClick={reviewPassed} className="mt-4 rounded-2xl bg-primary hover:bg-primary/90 gap-2"><RotateCcw className="w-4 h-4"/> Review passed profiles</Button></div></div>:activeList.length===0?<div className="absolute inset-0 rounded-3xl bg-card border grid place-items-center p-8 text-center"><div className="text-muted-foreground">Loading…</div></div>:<AnimatePresence>{activeList.slice(0,3).reverse().map((c,revIdx)=>{const total=Math.min(activeList.length,3);const index=total-1-revIdx;return <SwipeCard key={c.user.user_id} candidate={c} onSwipe={doSwipe} isTop={index===0} index={index}/>})}</AnimatePresence>}
    </div>{activeList.length>0&&!loading&&<div className="mt-6 flex items-center justify-center gap-6"><Button data-testid="swipe-pass-btn" onClick={()=>doSwipe("pass")} variant="outline" className="w-16 h-16 rounded-full border-2 shadow-soft bg-card hover:bg-secondary"><X className="w-6 h-6 text-destructive"/></Button><Button data-testid="swipe-like-btn" onClick={()=>doSwipe("like")} className="w-20 h-20 rounded-full bg-primary hover:bg-primary/90 shadow-lift"><Heart className="w-8 h-8" fill="currentColor"/></Button></div>}</div>
    {matchInfo&&<MatchModal match={matchInfo.match} other={matchInfo.other} meName={user?.name} onClose={()=>setMatchInfo(null)}/>}<FiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen} filters={filters} onApply={applyFilters} userRadius={user?.radius_km}/><Walkthrough open={walkthroughOpen} onClose={()=>setWalkthroughOpen(false)}/><BottomNav/>
  </div>;
}
