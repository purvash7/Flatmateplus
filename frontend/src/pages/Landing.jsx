import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Home, Sparkles } from "lucide-react";

export default function Landing() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = mode === "login"
        ? await login(form.email, form.password)
        : await register(form.email, form.password, form.name);
      toast.success(`Welcome ${user.name?.split(" ")[0] || ""}!`);
      if (!user.onboarding_done) navigate("/onboarding");
      else if (!user.liveness_verified) navigate("/liveness");
      else if (!user.profile_complete) navigate("/profile-setup");
      else navigate("/discover");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/discover";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="app-shell">
      <div className="relative min-h-[100dvh] flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/15 to-transparent pointer-events-none" />
        <div className="relative px-6 pt-12 pb-6">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-soft">
              <Home className="w-5 h-5" strokeWidth={2.4}/>
            </div>
            <div>
              <div className="font-display font-extrabold text-xl leading-none">FlatMate+</div>
              <div className="text-[11px] text-muted-foreground mt-1 font-mono-label">FIND YOUR PEOPLE</div>
            </div>
          </div>
        </div>

        <div className="px-6 flex-1 flex flex-col justify-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-4xl sm:text-5xl font-display font-extrabold leading-[1.05]">
              Live with people <span className="text-primary">who get you.</span>
            </h1>
            <p className="mt-4 text-muted-foreground text-base leading-relaxed">
              India&apos;s smart flatmate matcher — swipe, match on compatibility, chat, move in.
            </p>
          </motion.div>

          <form onSubmit={submit} className="mt-8 space-y-3">
            {mode === "register" && (
              <Input data-testid="auth-name-input" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})}
                     placeholder="Your name" required className="rounded-2xl h-12 bg-card"/>
            )}
            <Input data-testid="auth-email-input" type="email" value={form.email} onChange={(e)=>setForm({...form, email: e.target.value})}
                   placeholder="you@example.com" required className="rounded-2xl h-12 bg-card"/>
            <Input data-testid="auth-password-input" type="password" value={form.password} onChange={(e)=>setForm({...form, password: e.target.value})}
                   placeholder="Password" required minLength={6} className="rounded-2xl h-12 bg-card"/>
            <Button data-testid="auth-submit-btn" type="submit" disabled={busy}
                    className="w-full h-12 rounded-2xl text-base bg-primary hover:bg-primary/90 shadow-soft">
              {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-border flex-1"/>
            <div className="font-mono-label text-muted-foreground">OR</div>
            <div className="h-px bg-border flex-1"/>
          </div>

          <Button data-testid="google-login-btn" onClick={googleLogin} variant="outline"
                  className="w-full h-12 rounded-2xl bg-card hover:bg-secondary text-base gap-2">
            <Sparkles className="w-4 h-4"/> Continue with Google
          </Button>

          <button data-testid="auth-toggle-btn" type="button" onClick={()=>setMode(mode === "login" ? "register" : "login")}
                  className="mt-5 text-sm text-muted-foreground hover:text-foreground text-center w-full">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <span className="text-primary font-semibold underline-offset-4 hover:underline">
              {mode === "login" ? "Create an account" : "Log in"}
            </span>
          </button>
        </div>

        <div className="px-6 pb-8 pt-4 text-center text-[11px] text-muted-foreground font-mono-label">
          MADE IN INDIA • FOR PEOPLE, NOT PROFILES
        </div>
      </div>
    </div>
  );
}
