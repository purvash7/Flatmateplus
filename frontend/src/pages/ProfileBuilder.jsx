import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Camera, Plus, X, Sparkles } from "lucide-react";

const PROMPT_OPTIONS = [
  "The house rule I swear by is…",
  "Sunday mornings look like…",
  "My idea of a perfect flatmate is…",
  "One quirky habit of mine…",
  "The last thing I cooked was…",
  "My top green flag is…",
];

export default function ProfileBuilder() {
  const { user, refreshUser } = useAuth();
  const [bio, setBio] = useState(user?.bio || "");
  const [photos, setPhotos] = useState(user?.photos || []);
  const [prompts, setPrompts] = useState(user?.prompts?.length ? user.prompts : [{ q: PROMPT_OPTIONS[0], a: "" }]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotos(p => [...p, data.path]);
      toast.success("Photo added");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (idx) => setPhotos(p => p.filter((_, i) => i !== idx));

  const setPromptAt = (i, key, val) => setPrompts(p => p.map((x, idx) => idx === i ? { ...x, [key]: val } : x));

  const addPrompt = () => setPrompts(p => [...p, { q: PROMPT_OPTIONS[p.length % PROMPT_OPTIONS.length], a: "" }]);

  const submit = async () => {
    if (photos.length < 1) return toast.error("Add at least 1 photo");
    const filled = prompts.filter(p => p.a.trim());
    if (filled.length < 1) return toast.error("Answer at least 1 prompt");
    setSaving(true);
    try {
      await api.put("/profile", { bio, photos, prompts: filled });
      await refreshUser();
      toast.success("Profile ready — go find your people!");
      navigate("/discover");
    } catch (e) {
      toast.error("Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <div className="app-shell pb-32">
      <div className="px-6 pt-10 pb-4">
        <div className="font-mono-label text-primary">FINAL STEP</div>
        <h1 className="text-3xl font-display font-extrabold leading-tight mt-1">Build your profile</h1>
        <p className="text-muted-foreground mt-1">Photos and prompts — let people meet the real you.</p>
      </div>

      <div className="px-6 space-y-6">
        <div>
          <Label className="font-mono-label mb-3 block">PHOTOS</Label>
          <div className="grid grid-cols-3 gap-3">
            {photos.map((p, i) => (
              <div key={p} className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-secondary border">
                <img src={fileUrl(p)} className="w-full h-full object-cover" alt="Profile"/>
                <button data-testid={`remove-photo-${i}`} onClick={()=>removePhoto(i)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-foreground/80 text-background grid place-items-center">
                  <X className="w-3.5 h-3.5"/>
                </button>
                {i === 0 && <div className="absolute bottom-1 left-1 text-[10px] font-mono-label bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md">MAIN</div>}
              </div>
            ))}
            {photos.length < 6 && (
              <button data-testid="add-photo-btn" onClick={()=>fileRef.current?.click()} disabled={uploading}
                      className="aspect-[3/4] rounded-2xl border-2 border-dashed grid place-items-center bg-card hover:bg-secondary">
                <div className="text-center">
                  <Camera className="w-6 h-6 mx-auto text-muted-foreground"/>
                  <div className="text-xs text-muted-foreground mt-1">{uploading ? "…" : "Add"}</div>
                </div>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} data-testid="photo-input"/>
        </div>

        <div>
          <Label className="font-mono-label mb-2 block">SHORT BIO</Label>
          <Textarea data-testid="bio-input" value={bio} onChange={(e)=>setBio(e.target.value)} rows={3}
                    placeholder="One-liner about you (optional)"
                    className="rounded-2xl bg-card resize-none"/>
        </div>

        <div>
          <Label className="font-mono-label mb-3 block">PROMPTS</Label>
          <div className="space-y-3">
            {prompts.map((p, i) => (
              <div key={i} className="p-4 rounded-2xl bg-card border space-y-2">
                <select data-testid={`prompt-q-${i}`} value={p.q} onChange={(e)=>setPromptAt(i, "q", e.target.value)}
                        className="w-full bg-transparent font-semibold text-sm outline-none">
                  {PROMPT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <Input data-testid={`prompt-a-${i}`} value={p.a} onChange={(e)=>setPromptAt(i, "a", e.target.value)}
                       placeholder="Your answer…" className="rounded-xl bg-secondary border-0"/>
              </div>
            ))}
            {prompts.length < 3 && (
              <button data-testid="add-prompt-btn" onClick={addPrompt}
                      className="w-full p-3 rounded-2xl border-2 border-dashed text-sm text-muted-foreground hover:bg-secondary flex items-center justify-center gap-2">
                <Plus className="w-4 h-4"/> Add another prompt
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto px-6 py-4 bg-background/90 backdrop-blur border-t">
        <Button data-testid="profile-save-btn" onClick={submit} disabled={saving}
                className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 gap-2">
          <Sparkles className="w-4 h-4"/> {saving ? "Saving…" : "Enter FlatMate+"}
        </Button>
      </div>
    </div>
  );
}
