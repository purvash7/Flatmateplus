import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const FOOD_OPTS = [["veg","Veg"],["non_veg","Non-veg"],["eggetarian","Eggetarian"],["vegan","Vegan"]];
const SMOKE_OPTS = [["no","No"],["occasionally","Occasionally"],["yes","Yes"]];
const DRINK_OPTS = SMOKE_OPTS;
const HOUSING_OPTS = [["have_house","Has house"],["need_house_together","Find together"],["need_house_from_someone","Wants room"]];

export default function FiltersSheet({ open, onOpenChange, filters, onApply, userRadius }) {
  const [f, setF] = useState({
    radius_km: filters.radius_km ?? userRadius ?? 5,
    food: filters.food || [],
    smoking: filters.smoking || [],
    drinking: filters.drinking || [],
    housing: filters.housing || [],
    budget_min: filters.budget_min ?? 3000,
    budget_max: filters.budget_max ?? 80000,
  });

  const toggle = (k, v) => setF(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }));
  const reset = () => setF({ radius_km: userRadius ?? 5, food: [], smoking: [], drinking: [], housing: [], budget_min: 3000, budget_max: 80000 });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-3xl bg-background border-t px-6 pb-8 max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-display font-extrabold text-2xl text-left">Filters</SheetTitle>
          <SheetDescription className="sr-only">Filter potential flatmates by radius, budget and habits</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div>
            <Label className="font-mono-label mb-2 block">SEARCH RADIUS</Label>
            <div className="flex items-center justify-between text-sm mb-2 text-muted-foreground">
              <span>1 km</span><span className="text-foreground font-semibold">{f.radius_km} km</span><span>50 km</span>
            </div>
            <Slider data-testid="filter-radius" min={1} max={50} step={1} value={[f.radius_km]}
                    onValueChange={(v)=>setF(p=>({...p, radius_km: v[0]}))}/>
          </div>

          <div>
            <Label className="font-mono-label mb-2 block">BUDGET (₹/month)</Label>
            <div className="flex items-center justify-between text-sm mb-2 text-muted-foreground">
              <span>₹{f.budget_min.toLocaleString()}</span><span>₹{f.budget_max.toLocaleString()}</span>
            </div>
            <Slider data-testid="filter-budget" min={3000} max={80000} step={1000}
                    value={[f.budget_min, f.budget_max]}
                    onValueChange={(v)=>setF(p=>({...p, budget_min: v[0], budget_max: v[1]}))}/>
          </div>

          {[
            ["food", "FOOD", FOOD_OPTS],
            ["smoking", "SMOKING", SMOKE_OPTS],
            ["drinking", "DRINKING", DRINK_OPTS],
            ["housing", "HOUSING", HOUSING_OPTS],
          ].map(([k, l, opts]) => (
            <div key={k}>
              <Label className="font-mono-label mb-2 block">{l}</Label>
              <div className="flex flex-wrap gap-2">
                {opts.map(([v, lb]) => (
                  <Badge data-testid={`filter-${k}-${v}`} key={v} onClick={()=>toggle(k, v)}
                         className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ${f[k].includes(v)?"bg-primary text-primary-foreground":"bg-card text-foreground border border-border hover:bg-secondary"}`}>
                    {lb}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-2 sticky bottom-0 bg-background pt-3">
          <Button data-testid="filter-reset-btn" variant="outline" onClick={reset} className="flex-1 h-11 rounded-2xl bg-card">Reset</Button>
          <Button data-testid="filter-apply-btn" onClick={()=>{ onApply(f); onOpenChange(false); }}
                  className="flex-1 h-11 rounded-2xl bg-primary hover:bg-primary/90">Show matches</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
