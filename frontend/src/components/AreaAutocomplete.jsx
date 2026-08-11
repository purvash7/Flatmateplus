import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

export default function AreaAutocomplete({ value, onSelect, placeholder = "Search your area…", testid = "area-search" }) {
  const [q, setQ] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef();

  useEffect(() => { setQ(value || ""); }, [value]);

  const onChange = (e) => {
    const v = e.target.value;
    setQ(v);
    clearTimeout(timer.current);
    if (v.length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/geo/search", { params: { q: v } });
        setResults(data);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  };

  const pick = (r) => {
    setQ(r.primary);
    setOpen(false);
    onSelect({ locality: r.primary, city: r.city, lat: r.lat, lng: r.lng, display: r.display_name });
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
        <Input data-testid={testid} value={q} onChange={onChange} onFocus={()=>q.length>=3 && setOpen(true)}
               onBlur={()=>setTimeout(()=>setOpen(false), 150)}
               placeholder={placeholder} className="rounded-2xl h-12 pl-10 bg-card"/>
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground"/>}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-card border rounded-2xl shadow-lift overflow-hidden max-h-72 overflow-y-auto">
          {results.map((r) => (
            <button data-testid={`${testid}-item-${r.lat}-${r.lng}`} key={`${r.lat}-${r.lng}-${r.primary}`} type="button"
                    onMouseDown={(e)=>{ e.preventDefault(); pick(r); }}
                    className="w-full text-left px-4 py-3 hover:bg-secondary border-b last:border-0">
              <div className="font-semibold text-sm">{r.primary}</div>
              <div className="text-xs text-muted-foreground truncate">{r.display_name}</div>
            </button>
          ))}
        </div>
      )}
      {open && !loading && q.length >= 3 && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-card border rounded-2xl shadow-lift px-4 py-3 text-sm text-muted-foreground">
          No matches — try a nearby landmark
        </div>
      )}
    </div>
  );
}
