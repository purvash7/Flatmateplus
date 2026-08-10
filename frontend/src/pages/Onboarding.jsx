import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";

const CITIES = ["Bangalore", "Mumbai", "Delhi NCR", "Pune", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Goa"];
const INTERESTS = ["Cooking", "Fitness", "Gaming", "Reading", "Movies", "Music", "Travel", "Startups", "Art", "Pets", "Yoga", "Hiking", "Foodie", "Tech"];
const LANGUAGES = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi", "Bengali", "Gujarati", "Punjabi"];

export default function Onboarding() {
  const { refreshUser, user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [d, setD] = useState({
    age: 24, gender: "", city: "", locality: "",
    housing_status: "", budget_min: 8000, budget_max: 25000, move_in_date: "",
    flatmate_gender_pref: "any", work_profile: "", company_or_college: "",
    food_pref: "", cooks_at_home: "", cleanliness: 3, sleep_schedule: "",
    social_level: "", drinking: "no", smoking: "no", pets_ok: true,
    guests_freq: "sometimes", music_ok: true, languages: [], interests: [],
  });
  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const toggleIn = (k, v) => setD(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }));

  const steps = [
    {
      title: "The basics", sub: "Let's start with a quick intro.",
      valid: () => d.age >= 18 && d.gender,
      body: (
        <div className="space-y-6">
          <div>
            <Label className="font-mono-label mb-2 block">YOUR NAME</Label>
            <Input data-testid="ob-name" value={user?.name || ""} disabled className="rounded-2xl h-12 bg-secondary"/>
          </div>
          <div>
            <Label className="font-mono-label mb-2 block">AGE</Label>
            <Input data-testid="ob-age" type="number" min={18} max={99} value={d.age}
                   onChange={(e)=>set("age", parseInt(e.target.value)||18)} className="rounded-2xl h-12"/>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">GENDER</Label>
            <RadioGroup value={d.gender} onValueChange={(v)=>set("gender", v)} className="grid grid-cols-3 gap-2">
              {[["male","Man"],["female","Woman"],["non_binary","Non-binary"]].map(([v,l])=>(
                <label key={v} className={`rounded-2xl border p-3 text-center cursor-pointer text-sm ${d.gender===v?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>
                  <RadioGroupItem data-testid={`ob-gender-${v}`} value={v} className="sr-only"/>{l}
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>
      )
    },
    {
      title: "Where & when", sub: "City, area and move-in.",
      valid: () => d.city && d.locality && d.move_in_date,
      body: (
        <div className="space-y-6">
          <div>
            <Label className="font-mono-label mb-3 block">CITY</Label>
            <div className="flex flex-wrap gap-2">
              {CITIES.map(c => (
                <button data-testid={`ob-city-${c}`} type="button" key={c} onClick={()=>set("city", c)}
                        className={`px-4 py-2 rounded-full text-sm border ${d.city===c?"bg-foreground text-background border-foreground":"bg-card hover:bg-secondary"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-2 block">PREFERRED LOCALITY</Label>
            <Input data-testid="ob-locality" placeholder="e.g. Indiranagar, Powai" value={d.locality}
                   onChange={(e)=>set("locality", e.target.value)} className="rounded-2xl h-12"/>
          </div>
          <div>
            <Label className="font-mono-label mb-2 block">MOVE-IN DATE</Label>
            <Input data-testid="ob-movein" type="date" value={d.move_in_date}
                   onChange={(e)=>set("move_in_date", e.target.value)} className="rounded-2xl h-12"/>
          </div>
        </div>
      )
    },
    {
      title: "Your situation", sub: "What are you looking for?",
      valid: () => d.housing_status,
      body: (
        <div className="space-y-3">
          {[
            ["have_house","I have a house","Looking for a flatmate to move in"],
            ["need_house_together","Let's find a place together","Team up and hunt a house"],
            ["need_house_from_someone","Looking for a spare room","Someone else has space"],
          ].map(([v,t,s]) => (
            <button data-testid={`ob-housing-${v}`} key={v} type="button" onClick={()=>set("housing_status", v)}
                    className={`w-full text-left p-4 rounded-2xl border ${d.housing_status===v?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>
              <div className="font-semibold">{t}</div>
              <div className={`text-sm mt-1 ${d.housing_status===v?"text-primary-foreground/85":"text-muted-foreground"}`}>{s}</div>
            </button>
          ))}
          <div className="pt-2">
            <Label className="font-mono-label mb-2 block">BUDGET (₹/month)</Label>
            <div className="flex items-center justify-between text-sm mb-1 text-muted-foreground">
              <span>₹{d.budget_min.toLocaleString()}</span><span>₹{d.budget_max.toLocaleString()}</span>
            </div>
            <Slider data-testid="ob-budget" min={3000} max={80000} step={1000}
                    value={[d.budget_min, d.budget_max]}
                    onValueChange={(v)=>{ set("budget_min", v[0]); set("budget_max", v[1]); }}/>
          </div>
        </div>
      )
    },
    {
      title: "Flatmate vibe", sub: "Who would you live with?",
      valid: () => d.flatmate_gender_pref && d.work_profile,
      body: (
        <div className="space-y-6">
          <div>
            <Label className="font-mono-label mb-3 block">FLATMATE GENDER PREFERENCE</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["male","Men"],["female","Women"],["any","Anyone"]].map(([v,l])=>(
                <button data-testid={`ob-fgpref-${v}`} key={v} type="button" onClick={()=>set("flatmate_gender_pref", v)}
                        className={`rounded-2xl border p-3 text-sm ${d.flatmate_gender_pref===v?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">WORK PROFILE</Label>
            <div className="grid grid-cols-2 gap-2">
              {[["working_professional","Working"],["student","Student"],["freelancer","Freelancer"],["business","Business"]].map(([v,l])=>(
                <button data-testid={`ob-work-${v}`} key={v} type="button" onClick={()=>set("work_profile", v)}
                        className={`rounded-2xl border p-3 text-sm ${d.work_profile===v?"bg-foreground text-background border-foreground":"bg-card hover:bg-secondary"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-2 block">COMPANY / COLLEGE (optional)</Label>
            <Input data-testid="ob-company" value={d.company_or_college}
                   onChange={(e)=>set("company_or_college", e.target.value)} className="rounded-2xl h-12"/>
          </div>
        </div>
      )
    },
    {
      title: "Home rhythm", sub: "How do you live day-to-day?",
      valid: () => d.food_pref && d.cooks_at_home && d.sleep_schedule && d.social_level,
      body: (
        <div className="space-y-6">
          <div>
            <Label className="font-mono-label mb-3 block">FOOD PREFERENCE</Label>
            <div className="grid grid-cols-2 gap-2">
              {[["veg","Vegetarian"],["non_veg","Non-Vegetarian"],["eggetarian","Eggetarian"],["vegan","Vegan"]].map(([v,l])=>(
                <button data-testid={`ob-food-${v}`} key={v} type="button" onClick={()=>set("food_pref", v)}
                        className={`rounded-2xl border p-3 text-sm ${d.food_pref===v?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">COOKS AT HOME</Label>
            <div className="grid grid-cols-4 gap-2">
              {[["daily","Daily"],["sometimes","Sometimes"],["rarely","Rarely"],["never","Never"]].map(([v,l])=>(
                <button data-testid={`ob-cook-${v}`} key={v} type="button" onClick={()=>set("cooks_at_home", v)}
                        className={`rounded-2xl border p-2 text-xs ${d.cooks_at_home===v?"bg-foreground text-background border-foreground":"bg-card hover:bg-secondary"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-2 block">CLEANLINESS (1 relaxed – 5 spotless)</Label>
            <div className="flex items-center justify-between text-sm mb-1 text-muted-foreground">
              <span>Relaxed</span><span className="text-foreground font-semibold">{d.cleanliness}/5</span><span>Spotless</span>
            </div>
            <Slider data-testid="ob-cleanliness" min={1} max={5} step={1} value={[d.cleanliness]}
                    onValueChange={(v)=>set("cleanliness", v[0])}/>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">SLEEP SCHEDULE</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["early_bird","Early bird"],["night_owl","Night owl"],["flexible","Flexible"]].map(([v,l])=>(
                <button data-testid={`ob-sleep-${v}`} key={v} type="button" onClick={()=>set("sleep_schedule", v)}
                        className={`rounded-2xl border p-3 text-xs ${d.sleep_schedule===v?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">SOCIAL LEVEL</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["introvert","Introvert"],["ambivert","Ambivert"],["extrovert","Extrovert"]].map(([v,l])=>(
                <button data-testid={`ob-social-${v}`} key={v} type="button" onClick={()=>set("social_level", v)}
                        className={`rounded-2xl border p-3 text-xs ${d.social_level===v?"bg-foreground text-background border-foreground":"bg-card hover:bg-secondary"}`}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Habits & vibes", sub: "The little things that matter.",
      valid: () => true,
      body: (
        <div className="space-y-5">
          {[["drinking","Drinking"],["smoking","Smoking"]].map(([k, l])=>(
            <div key={k}>
              <Label className="font-mono-label mb-3 block">{l.toUpperCase()}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[["no","No"],["occasionally","Occasionally"],["yes","Yes"]].map(([v, lb])=>(
                  <button data-testid={`ob-${k}-${v}`} key={v} type="button" onClick={()=>set(k, v)}
                          className={`rounded-2xl border p-3 text-sm ${d[k]===v?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>{lb}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-card border">
            <div><div className="font-semibold">Pets OK?</div><div className="text-sm text-muted-foreground">Cats, dogs, plants…</div></div>
            <Switch data-testid="ob-pets" checked={d.pets_ok} onCheckedChange={(v)=>set("pets_ok", v)}/>
          </div>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-card border">
            <div><div className="font-semibold">Loud music OK?</div><div className="text-sm text-muted-foreground">Speakers, jam sessions</div></div>
            <Switch data-testid="ob-music" checked={d.music_ok} onCheckedChange={(v)=>set("music_ok", v)}/>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">GUESTS FREQUENCY</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["rarely","Rarely"],["sometimes","Sometimes"],["often","Often"]].map(([v,l])=>(
                <button data-testid={`ob-guests-${v}`} key={v} type="button" onClick={()=>set("guests_freq", v)}
                        className={`rounded-2xl border p-3 text-sm ${d.guests_freq===v?"bg-foreground text-background border-foreground":"bg-card hover:bg-secondary"}`}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "About you", sub: "Interests & languages",
      valid: () => d.interests.length >= 3 && d.languages.length >= 1,
      body: (
        <div className="space-y-6">
          <div>
            <Label className="font-mono-label mb-3 block">LANGUAGES (PICK AT LEAST 1)</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(l => (
                <Badge data-testid={`ob-lang-${l}`} key={l} onClick={()=>toggleIn("languages", l)}
                       className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ${d.languages.includes(l)?"bg-primary text-primary-foreground":"bg-card text-foreground border border-border hover:bg-secondary"}`}>
                  {l}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">INTERESTS (PICK AT LEAST 3)</Label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(i => (
                <Badge data-testid={`ob-interest-${i}`} key={i} onClick={()=>toggleIn("interests", i)}
                       className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ${d.interests.includes(i)?"bg-foreground text-background":"bg-card text-foreground border border-border hover:bg-secondary"}`}>
                  {i}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )
    },
  ];

  const cur = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  const next = async () => {
    if (!cur.valid()) { toast.error("Please complete this step"); return; }
    if (step < steps.length - 1) { setStep(step + 1); return; }
    try {
      await api.put("/onboarding", d);
      await refreshUser();
      toast.success("Basics done! Time for a quick selfie check.");
      navigate("/liveness");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    }
  };

  return (
    <div className="app-shell">
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-md border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <button data-testid="ob-back-btn" onClick={()=>step>0 && setStep(step-1)} disabled={step===0}
                  className={`w-9 h-9 rounded-full grid place-items-center border ${step===0?"opacity-30":"hover:bg-secondary"}`}>
            <ArrowLeft className="w-4 h-4"/>
          </button>
          <div className="flex-1"><Progress value={progress} className="h-2"/></div>
          <div className="text-xs text-muted-foreground font-mono-label">{step+1}/{steps.length}</div>
        </div>
      </div>

      <div className="px-6 pt-6 pb-32">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <div className="font-mono-label text-primary mb-2">STEP {step+1}</div>
            <h1 className="text-3xl font-display font-extrabold leading-tight">{cur.title}</h1>
            <p className="text-muted-foreground mt-1">{cur.sub}</p>
            <div className="mt-8">{cur.body}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto px-6 py-4 bg-background/90 backdrop-blur border-t">
        <Button data-testid="ob-next-btn" onClick={next} className="w-full h-12 rounded-2xl text-base bg-primary hover:bg-primary/90 gap-2">
          {step === steps.length - 1 ? "Finish basics" : "Continue"} <ArrowRight className="w-4 h-4"/>
        </Button>
      </div>
    </div>
  );
}
