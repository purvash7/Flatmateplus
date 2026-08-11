import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

const INTERESTS = ["Cooking", "Fitness", "Gaming", "Reading", "Movies", "Music", "Travel", "Startups", "Art", "Pets", "Yoga", "Hiking", "Foodie", "Tech"];
const LANGUAGES = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi", "Bengali", "Gujarati", "Punjabi"];
const FLAT_PREFS = [
  ["attached_washroom", "Attached washroom"], ["balcony", "Balcony"], ["lift", "Lift"],
  ["power_backup", "Power backup"], ["parking", "Parking"], ["ac", "AC"],
  ["wifi", "Wi-Fi"], ["geyser", "Geyser"], ["gated_community", "Gated community"], ["gym", "Gym"],
];
const NON_NEG = [
  ["food_pref", "Food"], ["smoking", "Smoking"], ["drinking", "Drinking"], ["cleanliness", "Cleanliness"],
  ["pets_ok", "Pets"], ["male_guests_ok", "Male guests"], ["family_visits_ok", "Family visits"],
  ["hosts_parties", "Parties"], ["sleep_schedule", "Sleep"],
];

const Chip = ({ active, onClick, children, testid }) => (
  <button data-testid={testid} type="button" onClick={onClick}
          className={`rounded-full px-3.5 py-1.5 text-sm border ${active?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>
    {children}
  </button>
);

const Section = ({ title, children }) => (
  <div className="space-y-3">
    <h3 className="font-mono-label text-muted-foreground">{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);

export default function EditProfile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({});
  const [nn, setNN] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setF({ ...user });
    setNN(user.non_negotiables || []);
    // Only re-run when the user's user_id changes (i.e. new user loaded), not on every field edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggle = (k, v) => setF(p => ({ ...p, [k]: (p[k]||[]).includes(v) ? p[k].filter(x=>x!==v) : [...(p[k]||[]), v] }));
  const toggleNN = (v) => setNN(p => p.includes(v) ? p.filter(x=>x!==v) : (p.length<4 ? [...p, v] : (toast.info("Max 4"), p)));

  const save = async () => {
    setSaving(true);
    try {
      const { name, email, user_id, created_at, password_hash, onboarding_done, liveness_verified, profile_complete,
              main_photo_verified, non_negotiables, photos, flat_photos, prompts, ...rest } = f;
      await api.patch("/profile/edit", rest);
      await api.put("/non-negotiables", { non_negotiables: nn });
      await refreshUser();
      toast.success("Profile updated");
      navigate("/profile");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  if (!user) return null;

  return (
    <div className="app-shell pb-32">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b px-4 py-3 flex items-center gap-3">
        <button data-testid="edit-back-btn" onClick={()=>navigate("/profile")} className="w-9 h-9 rounded-full grid place-items-center hover:bg-secondary">
          <ArrowLeft className="w-4 h-4"/>
        </button>
        <div className="font-display font-extrabold text-lg flex-1">Edit profile</div>
      </div>

      <div className="px-6 py-6 space-y-8">
        <Section title="BASICS">
          <div>
            <Label className="text-xs text-muted-foreground">NAME (can't change)</Label>
            <Input value={f.name || ""} disabled className="rounded-2xl h-11 bg-secondary mt-1"/>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">AGE</Label>
            <Input data-testid="ep-age" type="number" min={18} max={99} value={f.age || 18}
                   onChange={(e)=>set("age", parseInt(e.target.value)||18)} className="rounded-2xl h-11 mt-1"/>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">GENDER</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["male","Man"],["female","Woman"],["non_binary","Non-binary"]].map(([v,l])=>(
                <Chip key={v} testid={`ep-gender-${v}`} active={f.gender===v} onClick={()=>set("gender", v)}>{l}</Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title="LOCATION">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">HOME AREA</Label>
            <AreaAutocomplete testid="ep-home-area" value={f.locality}
              onSelect={(r)=>setF(p=>({...p, locality:r.locality, city:r.city, home_lat:r.lat, home_lng:r.lng}))}/>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">RADIUS ({f.radius_km || 5}km)</Label>
            <Slider data-testid="ep-radius" min={1} max={50} step={1} value={[f.radius_km || 5]}
                    onValueChange={(v)=>set("radius_km", v[0])}/>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">OFFICE / COLLEGE AREA</Label>
            <AreaAutocomplete testid="ep-office-area" value={f.office_locality}
              onSelect={(r)=>setF(p=>({...p, office_locality:r.locality, office_lat:r.lat, office_lng:r.lng}))}/>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">MOVE-IN DATE</Label>
            <Input data-testid="ep-movein" type="date" value={f.move_in_date || ""} onChange={(e)=>set("move_in_date", e.target.value)} className="rounded-2xl h-11 mt-1"/>
          </div>
        </Section>

        <Section title="HOUSING & BUDGET">
          <div className="space-y-2">
            {[["have_house","I have a house"],["need_house_together","Find a place together"],["need_house_from_someone","Looking for a spare room"]].map(([v,l])=>(
              <button data-testid={`ep-housing-${v}`} key={v} type="button" onClick={()=>set("housing_status", v)}
                      className={`w-full text-left p-3 rounded-2xl border ${f.housing_status===v?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-secondary"}`}>
                {l}
              </button>
            ))}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">BUDGET ₹{f.budget_min?.toLocaleString()} – ₹{f.budget_max?.toLocaleString()}</Label>
            <Slider data-testid="ep-budget" min={3000} max={80000} step={1000}
                    value={[f.budget_min || 8000, f.budget_max || 25000]}
                    onValueChange={(v)=>setF(p=>({...p, budget_min:v[0], budget_max:v[1]}))}/>
          </div>
        </Section>

        <Section title="WORK">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">PROFILE</Label>
            <div className="grid grid-cols-2 gap-2">
              {[["working_professional","Working"],["student","Student"],["freelancer","Freelancer"],["business","Business"]].map(([v,l])=>(
                <Chip key={v} testid={`ep-work-${v}`} active={f.work_profile===v} onClick={()=>set("work_profile", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">COMPANY / COLLEGE</Label>
            <Input data-testid="ep-company" value={f.company_or_college || ""} onChange={(e)=>set("company_or_college", e.target.value)} className="rounded-2xl h-11 mt-1"/>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">SCHEDULE</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["wfh","WFH"],["wfo","WFO"],["hybrid","Hybrid"]].map(([v,l])=>(
                <Chip key={v} testid={`ep-sched-${v}`} active={f.work_schedule===v} onClick={()=>set("work_schedule", v)}>{l}</Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title="HOME RHYTHM">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">FOOD</Label>
            <div className="grid grid-cols-2 gap-2">
              {[["veg","Veg"],["non_veg","Non-veg"],["eggetarian","Eggetarian"],["vegan","Vegan"]].map(([v,l])=>(
                <Chip key={v} testid={`ep-food-${v}`} active={f.food_pref===v} onClick={()=>set("food_pref", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">COOKS AT HOME</Label>
            <div className="grid grid-cols-4 gap-2">
              {[["daily","Daily"],["sometimes","Some"],["rarely","Rarely"],["never","Never"]].map(([v,l])=>(
                <Chip key={v} testid={`ep-cook-${v}`} active={f.cooks_at_home===v} onClick={()=>set("cooks_at_home", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">CLEANLINESS {f.cleanliness}/5</Label>
            <Slider data-testid="ep-clean" min={1} max={5} step={1} value={[f.cleanliness || 3]} onValueChange={(v)=>set("cleanliness", v[0])}/>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">SLEEP</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["early_bird","Early"],["night_owl","Night owl"],["flexible","Flexible"]].map(([v,l])=>(
                <Chip key={v} testid={`ep-sleep-${v}`} active={f.sleep_schedule===v} onClick={()=>set("sleep_schedule", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">SOCIAL</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["introvert","Introvert"],["ambivert","Ambivert"],["extrovert","Extrovert"]].map(([v,l])=>(
                <Chip key={v} testid={`ep-social-${v}`} active={f.social_level===v} onClick={()=>set("social_level", v)}>{l}</Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title="HABITS & GUESTS">
          {[["drinking","Drinking"],["smoking","Smoking"]].map(([k, l])=>(
            <div key={k}>
              <Label className="text-xs text-muted-foreground mb-1 block">{l.toUpperCase()}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[["no","No"],["occasionally","Occasionally"],["yes","Yes"]].map(([v, lb])=>(
                  <Chip key={v} testid={`ep-${k}-${v}`} active={f[k]===v} onClick={()=>set(k, v)}>{lb}</Chip>
                ))}
              </div>
            </div>
          ))}
          {[["pets_ok","Pets OK"],["male_guests_ok","Male guests OK"],["family_visits_ok","Family visits OK"],["music_ok","Loud music OK"]].map(([k,l])=>(
            <div key={k} className="flex items-center justify-between p-3 rounded-2xl bg-card border">
              <span className="font-semibold text-sm">{l}</span>
              <Switch data-testid={`ep-${k}`} checked={!!f[k]} onCheckedChange={(v)=>set(k, v)}/>
            </div>
          ))}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">GUEST FREQUENCY</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["rarely","Rarely"],["sometimes","Sometimes"],["often","Often"]].map(([v,l])=>(
                <Chip key={v} testid={`ep-guests-${v}`} active={f.guests_freq===v} onClick={()=>set("guests_freq", v)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">PARTIES</Label>
            <div className="grid grid-cols-3 gap-2">
              {[["rarely","Rarely"],["sometimes","Sometimes"],["often","Often"]].map(([v,l])=>(
                <Chip key={v} testid={`ep-party-${v}`} active={f.hosts_parties===v} onClick={()=>set("hosts_parties", v)}>{l}</Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title="ABOUT">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">BIO</Label>
            <Textarea data-testid="ep-bio" value={f.bio || ""} onChange={(e)=>set("bio", e.target.value)} rows={3} className="rounded-2xl resize-none"/>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">LANGUAGES</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(l => (
                <Badge data-testid={`ep-lang-${l}`} key={l} onClick={()=>toggle("languages", l)}
                       className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ${(f.languages||[]).includes(l)?"bg-primary text-primary-foreground":"bg-card border border-border hover:bg-secondary"}`}>
                  {l}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">INTERESTS</Label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(i => (
                <Badge data-testid={`ep-interest-${i}`} key={i} onClick={()=>toggle("interests", i)}
                       className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ${(f.interests||[]).includes(i)?"bg-foreground text-background":"bg-card border border-border hover:bg-secondary"}`}>
                  {i}
                </Badge>
              ))}
            </div>
          </div>
          {f.housing_status === "have_house" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">FLAT AMENITIES</Label>
              <div className="flex flex-wrap gap-2">
                {FLAT_PREFS.map(([v, l]) => (
                  <Badge data-testid={`ep-flatpref-${v}`} key={v} onClick={()=>toggle("flat_preferences", v)}
                         className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ${(f.flat_preferences||[]).includes(v)?"bg-accent text-accent-foreground":"bg-card border border-border hover:bg-secondary"}`}>
                    {l}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="NON-NEGOTIABLES (MAX 4)">
          <div className="grid grid-cols-2 gap-2">
            {NON_NEG.map(([v, l]) => (
              <Chip key={v} testid={`ep-nn-${v}`} active={nn.includes(v)} onClick={()=>toggleNN(v)}>{l}</Chip>
            ))}
          </div>
        </Section>
      </div>

      <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto px-6 py-4 bg-background/90 backdrop-blur border-t">
        <Button data-testid="ep-save-btn" onClick={save} disabled={saving} className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 gap-2">
          <Save className="w-4 h-4"/> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
