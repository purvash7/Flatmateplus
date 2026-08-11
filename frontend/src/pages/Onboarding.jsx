import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const INTERESTS = ["Cooking", "Fitness", "Gaming", "Reading", "Movies", "Music", "Travel", "Startups", "Art", "Pets", "Yoga", "Hiking", "Foodie", "Tech"];
const LANGUAGES = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi", "Bengali", "Gujarati", "Punjabi"];
const FLAT_PREFS = [
  ["attached_washroom", "Attached washroom"], ["balcony", "Balcony"], ["lift", "Lift"],
  ["power_backup", "Power backup"], ["parking", "Parking"], ["ac", "AC"],
  ["wifi", "Wi-Fi"], ["geyser", "Geyser"], ["gated_community", "Gated community"], ["gym", "Gym"],
];
const NON_NEG_OPTIONS = [
  ["food_pref", "Food preference"], ["smoking", "Smoking"], ["drinking", "Drinking"],
  ["cleanliness", "Cleanliness"], ["pets_ok", "Pets"], ["male_guests_ok", "Male guests"],
  ["family_visits_ok", "Family visits"], ["hosts_parties", "Parties"], ["sleep_schedule", "Sleep schedule"],
];

const Star = () => <span className="text-primary ml-0.5">*</span>;

const Chip = ({ active, children, onClick, testid }) => (
  <button data-testid={testid} type="button" onClick={onClick}
          className={`rounded-full px-3.5 py-1.5 text-sm border transition-colors ${active?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>
    {children}
  </button>
);

export default function Onboarding() {
  const { refreshUser, user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [d, setD] = useState({
    age: 24, gender: "", flatmate_gender_pref: "any",
    city: "", locality: "", home_lat: null, home_lng: null, radius_km: 5,
    housing_status: "", budget_min: 8000, budget_max: 25000, move_in_date: "",
    work_profile: "", company_or_college: "", work_schedule: "hybrid",
    food_pref: "", cooks_at_home: "", cleanliness: 3, sleep_schedule: "",
    social_level: "", drinking: "no", smoking: "no", pets_ok: true,
    guests_freq: "sometimes", male_guests_ok: true, family_visits_ok: true, hosts_parties: "sometimes",
    music_ok: true, languages: [], interests: [], flat_preferences: [],
    non_negotiables: [],
  });
  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const toggleIn = (k, v) => setD(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }));

  const isFlatOwner = d.housing_status === "have_house";

  const steps = [
    {
      title: "The basics",
      valid: () => d.age >= 18 && d.gender && d.flatmate_gender_pref,
      body: (
        <div className="space-y-6">
          <div>
            <Label className="font-mono-label mb-2 block">NAME</Label>
            <Input value={user?.name || ""} disabled className="rounded-2xl h-12 bg-secondary"/>
          </div>
          <div>
            <Label className="font-mono-label mb-2 block">AGE<Star/></Label>
            <Input data-testid="ob-age" type="number" min={18} max={99} value={d.age}
                   onChange={(e)=>set("age", parseInt(e.target.value)||18)} className="rounded-2xl h-12"/>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">GENDER<Star/></Label>
            <div className="grid grid-cols-3 gap-2">
              {[["male","Man"],["female","Woman"],["non_binary","Non-binary"]].map(([v,l])=>(
                <Chip testid={`ob-gender-${v}`} key={v} active={d.gender===v} onClick={()=>set("gender", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">OPEN TO LIVING WITH<Star/></Label>
            <div className="grid grid-cols-3 gap-2">
              {[["male","Men"],["female","Women"],["any","Anyone"]].map(([v,l])=>(
                <Chip testid={`ob-fgpref-${v}`} key={v} active={d.flatmate_gender_pref===v} onClick={()=>set("flatmate_gender_pref", v)}>{l}</Chip>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Where & when",
      valid: () => d.locality && d.city && d.move_in_date,
      body: (
        <div className="space-y-6">
          <div>
            <Label className="font-mono-label mb-2 block">LOCALITY<Star/></Label>
            <AreaAutocomplete testid="ob-home-area" value={d.locality}
              onSelect={(r)=>{ setD(p=>({...p, locality: r.locality, city: r.city, home_lat: r.lat, home_lng: r.lng})); }}/>
            {d.city && <div className="mt-2 text-xs text-muted-foreground">📍 {d.locality}, {d.city}</div>}
          </div>
          <div>
            <Label className="font-mono-label mb-2 block">SEARCH RADIUS</Label>
            <div className="flex items-center justify-between text-sm mb-2 text-muted-foreground">
              <span>1 km</span><span className="text-foreground font-semibold">{d.radius_km} km</span><span>25 km</span>
            </div>
            <Slider data-testid="ob-radius" min={1} max={25} step={1} value={[d.radius_km]}
                    onValueChange={(v)=>set("radius_km", v[0])}/>
          </div>
          <div>
            <Label className="font-mono-label mb-2 block">MOVE-IN DATE<Star/></Label>
            <Input data-testid="ob-movein" type="date" value={d.move_in_date}
                   onChange={(e)=>set("move_in_date", e.target.value)} className="rounded-2xl h-12"/>
          </div>
        </div>
      )
    },
    {
      title: "Your situation",
      valid: () => d.housing_status,
      body: (
        <div className="space-y-3">
          <Label className="font-mono-label mb-1 block">HOUSING STATUS<Star/></Label>
          {[
            ["have_house","I have a house","Looking for a flatmate"],
            ["need_house_together","Let's find a place together","Team up and hunt a house"],
            ["need_house_from_someone","Looking for a spare room","Someone else has space"],
          ].map(([v,t,s]) => (
            <button data-testid={`ob-housing-${v}`} key={v} type="button" onClick={()=>set("housing_status", v)}
                    className={`w-full text-left p-4 rounded-2xl border transition-colors ${d.housing_status===v?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>
              <div className="font-semibold">{t}</div>
              <div className={`text-sm mt-1 ${d.housing_status===v?"text-primary-foreground/85":"text-muted-foreground"}`}>{s}</div>
            </button>
          ))}
          <div className="pt-2">
            <Label className="font-mono-label mb-2 block">BUDGET (₹/month)<Star/></Label>
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
      title: "Home rhythm",
      valid: () => d.food_pref && d.cooks_at_home && d.sleep_schedule && d.social_level,
      body: (
        <div className="space-y-6">
          <div>
            <Label className="font-mono-label mb-3 block">FOOD<Star/></Label>
            <div className="grid grid-cols-2 gap-2">
              {[["veg","Vegetarian"],["non_veg","Non-Vegetarian"],["eggetarian","Eggetarian"],["vegan","Vegan"]].map(([v,l])=>(
                <Chip testid={`ob-food-${v}`} key={v} active={d.food_pref===v} onClick={()=>set("food_pref", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">COOKS AT HOME<Star/></Label>
            <div className="grid grid-cols-4 gap-2">
              {[["daily","Daily"],["sometimes","Some"],["rarely","Rarely"],["never","Never"]].map(([v,l])=>(
                <Chip testid={`ob-cook-${v}`} key={v} active={d.cooks_at_home===v} onClick={()=>set("cooks_at_home", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-2 block">CLEANLINESS<Star/></Label>
            <div className="flex items-center justify-between text-sm mb-1 text-muted-foreground">
              <span>Relaxed</span><span className="text-foreground font-semibold">{d.cleanliness}/5</span><span>Spotless</span>
            </div>
            <Slider data-testid="ob-cleanliness" min={1} max={5} step={1} value={[d.cleanliness]}
                    onValueChange={(v)=>set("cleanliness", v[0])}/>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">SLEEP<Star/></Label>
            <div className="grid grid-cols-3 gap-2">
              {[["early_bird","Early bird"],["night_owl","Night owl"],["flexible","Flexible"]].map(([v,l])=>(
                <Chip testid={`ob-sleep-${v}`} key={v} active={d.sleep_schedule===v} onClick={()=>set("sleep_schedule", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">SOCIAL<Star/></Label>
            <div className="grid grid-cols-3 gap-2">
              {[["introvert","Introvert"],["ambivert","Ambivert"],["extrovert","Extrovert"]].map(([v,l])=>(
                <Chip testid={`ob-social-${v}`} key={v} active={d.social_level===v} onClick={()=>set("social_level", v)}>{l}</Chip>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Habits & guests",
      valid: () => true,
      body: (
        <div className="space-y-5">
          {[["drinking","Drinking"],["smoking","Smoking"]].map(([k, l])=>(
            <div key={k}>
              <Label className="font-mono-label mb-3 block">{l.toUpperCase()}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[["no","No"],["occasionally","Occasionally"],["yes","Yes"]].map(([v, lb])=>(
                  <Chip testid={`ob-${k}-${v}`} key={v} active={d[k]===v} onClick={()=>set(k, v)}>{lb}</Chip>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-card border">
            <div className="font-semibold">Pets OK</div>
            <Switch data-testid="ob-pets" checked={d.pets_ok} onCheckedChange={(v)=>set("pets_ok", v)}/>
          </div>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-card border">
            <div className="font-semibold">Male guests / partners OK</div>
            <Switch data-testid="ob-malegs" checked={d.male_guests_ok} onCheckedChange={(v)=>set("male_guests_ok", v)}/>
          </div>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-card border">
            <div className="font-semibold">Family visits OK</div>
            <Switch data-testid="ob-family" checked={d.family_visits_ok} onCheckedChange={(v)=>set("family_visits_ok", v)}/>
          </div>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-card border">
            <div className="font-semibold">Loud music OK</div>
            <Switch data-testid="ob-music" checked={d.music_ok} onCheckedChange={(v)=>set("music_ok", v)}/>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">GUEST FREQUENCY</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["rarely","Rarely"],["sometimes","Sometimes"],["often","Often"]].map(([v,l])=>(
                <Chip testid={`ob-guests-${v}`} key={v} active={d.guests_freq===v} onClick={()=>set("guests_freq", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">HOSTS PARTIES</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["rarely","Rarely"],["sometimes","Sometimes"],["often","Often"]].map(([v,l])=>(
                <Chip testid={`ob-party-${v}`} key={v} active={d.hosts_parties===v} onClick={()=>set("hosts_parties", v)}>{l}</Chip>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "About you",
      valid: () => d.work_profile && d.work_schedule && d.interests.length >= 3 && d.languages.length >= 1,
      body: (
        <div className="space-y-6">
          <div>
            <Label className="font-mono-label mb-3 block">WORK PROFILE<Star/></Label>
            <div className="grid grid-cols-2 gap-2">
              {[["working_professional","Working"],["student","Student"],["freelancer","Freelancer"],["business","Business"]].map(([v,l])=>(
                <Chip testid={`ob-work-${v}`} key={v} active={d.work_profile===v} onClick={()=>set("work_profile", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-2 block">COMPANY / COLLEGE</Label>
            <Input data-testid="ob-company" value={d.company_or_college}
                   onChange={(e)=>set("company_or_college", e.target.value)}
                   placeholder="Where do you work or study?" className="rounded-2xl h-12"/>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">WORK SCHEDULE<Star/></Label>
            <div className="grid grid-cols-3 gap-2">
              {[["wfh","WFH"],["wfo","WFO"],["hybrid","Hybrid"]].map(([v,l])=>(
                <Chip testid={`ob-schedule-${v}`} key={v} active={d.work_schedule===v} onClick={()=>set("work_schedule", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono-label mb-3 block">LANGUAGES<Star/></Label>
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
            <Label className="font-mono-label mb-3 block">INTERESTS<Star/></Label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(i => (
                <Badge data-testid={`ob-interest-${i}`} key={i} onClick={()=>toggleIn("interests", i)}
                       className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ${d.interests.includes(i)?"bg-foreground text-background":"bg-card text-foreground border border-border hover:bg-secondary"}`}>
                  {i}
                </Badge>
              ))}
            </div>
          </div>
          {isFlatOwner && (
            <div>
              <Label className="font-mono-label mb-3 block">FLAT AMENITIES</Label>
              <div className="flex flex-wrap gap-2">
                {FLAT_PREFS.map(([v, l]) => (
                  <Badge data-testid={`ob-flatpref-${v}`} key={v} onClick={()=>toggleIn("flat_preferences", v)}
                         className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ${d.flat_preferences.includes(v)?"bg-accent text-accent-foreground":"bg-card text-foreground border border-border hover:bg-secondary"}`}>
                    {l}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      title: "Non-negotiables",
      valid: () => true,
      body: (
        <div>
          <Label className="font-mono-label mb-3 block">PICK UP TO 4</Label>
          <div className="space-y-2">
            {NON_NEG_OPTIONS.map(([v, l]) => {
              const active = d.non_negotiables.includes(v);
              return (
                <button data-testid={`ob-nn-${v}`} key={v} type="button"
                        onClick={()=>{
                          if (active) toggleIn("non_negotiables", v);
                          else if (d.non_negotiables.length < 4) toggleIn("non_negotiables", v);
                          else toast.info("Maximum 4");
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-colors ${active?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>
                  <span className="font-semibold">{l}</span>
                  {active && <Check className="w-5 h-5"/>}
                </button>
              );
            })}
          </div>
        </div>
      )
    },
  ];

  const cur = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  const next = async () => {
    if (!cur.valid()) { toast.error("Please complete the required fields"); return; }
    if (step < steps.length - 1) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    try {
      const { non_negotiables, ...payload } = d;
      await api.put("/onboarding", payload);
      await api.put("/non-negotiables", { non_negotiables });
      await refreshUser();
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
            <div className="mt-8">{cur.body}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto px-6 py-4 bg-background/90 backdrop-blur border-t">
        <Button data-testid="ob-next-btn" onClick={next} className="w-full h-12 rounded-2xl text-base bg-primary hover:bg-primary/90 gap-2">
          {step === steps.length - 1 ? "Finish" : "Continue"} <ArrowRight className="w-4 h-4"/>
        </Button>
      </div>
    </div>
  );
}
