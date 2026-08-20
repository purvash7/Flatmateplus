import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Home } from "lucide-react";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "yopmail.com", "sharklasers.com", "getnada.com",
  "trashmail.com", "dispostable.com", "maildrop.cc"
]);

function isAllowedEmail(email) {
  const value = email.trim().toLowerCase();
  const match = value.match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
  if (!match) return false;
  return !DISPOSABLE_DOMAINS.has(match[1]);
}

export default function Landing() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);
  const googleRef = useRef(null);
  const navigate = useNavigate();

  const routeUser = (user) => {
    if (!user.onboarding_done) navigate("/onboarding");
    else if (!user.liveness_verified) navigate("/liveness");
    else if (!user.profile_complete) navigate("/profile-setup");
    else navigate("/discover");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!isAllowedEmail(form.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const user = mode === "login"
        ? await login(form.email.trim(), form.password)
        : await register(form.email.trim(), form.password, form.name.trim());
      toast.success(`Welcome ${user.name?.split(" ")[0] || ""}!`);
      routeUser(user);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId || !googleRef.current) return undefined;
    const renderGoogle = () => {
      if (!window.google?.accounts?.id || !googleRef.current) return false;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setBusy(true);
          try {
            const { data } = await api.post("/auth/google", { credential });
            setToken(data.token);
            toast.success(`Welcome ${data.user.name?.split(" ")[0] || ""}!`);
            routeUser(data.user);
          } catch (err) {
            toast.error(err.response?.data?.detail || "Google sign-in failed");
          } finally {
            setBusy(false);
          }
        },
      });
      googleRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleRef.current, {
        theme: "outline", size: "large", width: 360, text: "continue_with", shape: "pill"
      });
      return true;
    };
    if (renderGoogle()) return undefined;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogle;
    document.head.appendChild(script);
    return () => { script.onload = null; };
  }, []);

  return <div className="app-shell"><div className="relative min-h-[100dvh] flex flex-col"><div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/15 to-transparent pointer-events-none"/><div className="relative px-6 pt-12 pb-6"><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-soft"><Home className="w-5 h-5" strokeWidth={2.4}/></div><div><div className="font-display font-extrabold text-xl leading-none">FlatMate+</div><div className="text-[11px] text-muted-foreground mt-1 font-mono-label">FIND YOUR PEOPLE</div></div></div></div><div className="px-6 flex-1 flex flex-col justify-center"><motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.5}}><h1 className="text-4xl sm:text-5xl font-display font-extrabold leading-[1.05]">Live with people <span className="text-primary">who get you.</span></h1><p className="mt-4 text-muted-foreground text-base leading-relaxed">India&apos;s smart flatmate matcher — swipe, match on compatibility, chat, move in.</p></motion.div><form onSubmit={submit} className="mt-8 space-y-3">{mode === "register" && <Input data-testid="auth-name-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" required className="rounded-2xl h-12 bg-card"/>}<Input data-testid="auth-email-input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" required className="rounded-2xl h-12 bg-card"/><Input data-testid="auth-password-input" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" required minLength={6} className="rounded-2xl h-12 bg-card"/><Button data-testid="auth-submit-btn" type="submit" disabled={busy} className="w-full h-12 rounded-2xl text-base bg-primary hover:bg-primary/90 shadow-soft">{busy ? "…" : mode === "login" ? "Log in" : "Create account"}</Button></form><div className="flex items-center gap-3 my-5"><div className="h-px bg-border flex-1"/><div className="font-mono-label text-muted-foreground">OR</div><div className="h-px bg-border flex-1"/></div><div ref={googleRef} id="google-signin" className="flex justify-center min-h-[44px]"/><button data-testid="auth-toggle-btn" type="button" onClick={()=>setMode(mode === "login" ? "register" : "login")} className="mt-5 text-sm text-muted-foreground hover:text-foreground text-center w-full">{mode === "login" ? "New here? " : "Already have an account? "}<span className="text-primary font-semibold underline-offset-4 hover:underline">{mode === "login" ? "Create an account" : "Log in"}</span></button></div><div className="px-6 pb-8 pt-4 text-center text-[11px] text-muted-foreground font-mono-label">MADE IN INDIA • FOR PEOPLE, NOT PROFILES</div></div></div>;
}
