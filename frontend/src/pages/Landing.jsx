import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Home, Phone, MailCheck } from "lucide-react";

export default function Landing() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "", otp: "" });
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const googleRef = useRef(null);
  const navigate = useNavigate();

  const routeUser = (user) => {
    if (!user.onboarding_done) navigate("/onboarding");
    else if (!user.liveness_verified) navigate("/liveness");
    else if (!user.profile_complete) navigate("/profile-setup");
    else navigate("/discover");
  };

  const validateEmail = async () => {
    await api.post("/auth/validate-email", { email: form.email.trim() });
  };

  const sendOtp = async () => {
    if (!form.email || !form.name || !form.password || !form.phone) {
      toast.error("Enter your name, email, password and phone number first."); return;
    }
    setBusy(true);
    try {
      await validateEmail();
      await api.post("/auth/phone/request-otp", { phone: form.phone });
      setOtpSent(true); toast.success("OTP sent to your phone.");
    } catch (err) { toast.error(err.response?.data?.detail || "Could not send OTP"); }
    finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      await api.post("/auth/phone/verify-otp", { phone: form.phone, otp: form.otp });
      setPhoneVerified(true); toast.success("Phone verified.");
    } catch (err) { toast.error(err.response?.data?.detail || "Invalid OTP"); }
    finally { setBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (mode === "register") {
        await validateEmail();
        if (!phoneVerified) { toast.error("Verify your phone number with OTP first."); setBusy(false); return; }
      }
      const user = mode === "login" ? await login(form.email, form.password) : await register(form.email, form.password, form.name);
      if (mode === "register") await api.post("/auth/phone/link", { phone: form.phone });
      toast.success(`Welcome ${user.name?.split(" ")[0] || ""}!`); routeUser(user);
    } catch (err) { toast.error(err.response?.data?.detail || "Something went wrong"); }
    finally { setBusy(false); }
  };

  const switchMode = () => { setMode(mode === "login" ? "register" : "login"); setOtpSent(false); setPhoneVerified(false); setForm({ email: "", password: "", name: "", phone: "", otp: "" }); };

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId || !googleRef.current) return undefined;
    const renderGoogle = () => {
      if (!window.google?.accounts?.id || !googleRef.current) return false;
      window.google.accounts.id.initialize({ client_id: clientId, callback: async ({ credential }) => {
        setBusy(true);
        try { const { data } = await api.post("/auth/google", { credential }); setToken(data.token); toast.success(`Welcome ${data.user.name?.split(" ")[0] || ""}!`); routeUser(data.user); }
        catch (err) { toast.error(err.response?.data?.detail || "Google sign-in failed"); }
        finally { setBusy(false); }
      } });
      googleRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleRef.current, { theme: "outline", size: "large", width: 360, text: "continue_with", shape: "pill" });
      return true;
    };
    if (renderGoogle()) return undefined;
    const script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.defer = true; script.onload = renderGoogle; document.head.appendChild(script);
    return () => { script.onload = null; };
  }, []);

  return <div className="app-shell"><div className="relative min-h-[100dvh] flex flex-col"><div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/15 to-transparent pointer-events-none"/><div className="relative px-6 pt-12 pb-6"><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-soft"><Home className="w-5 h-5" strokeWidth={2.4}/></div><div><div className="font-display font-extrabold text-xl leading-none">FlatMate+</div><div className="text-[11px] text-muted-foreground mt-1 font-mono-label">FIND YOUR PEOPLE</div></div></div></div><div className="px-6 flex-1 flex flex-col justify-center"><motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.5}}><h1 className="text-4xl sm:text-5xl font-display font-extrabold leading-[1.05]">Live with people <span className="text-primary">who get you.</span></h1><p className="mt-4 text-muted-foreground text-base leading-relaxed">India&apos;s smart flatmate matcher — swipe, match on compatibility, chat, move in.</p></motion.div><form onSubmit={submit} className="mt-8 space-y-3">{mode === "register" && <Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" required className="rounded-2xl h-12 bg-card"/>}<Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" required className="rounded-2xl h-12 bg-card"/>{mode === "register" && <><Input type="tel" inputMode="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Mobile number (+91)" required className="rounded-2xl h-12 bg-card"/><div className="flex gap-2">{otpSent && <Input inputMode="numeric" maxLength={6} value={form.otp} onChange={e=>setForm({...form,otp:e.target.value.replace(/\D/g,"")})} placeholder="6-digit OTP" className="rounded-2xl h-12 bg-card flex-1"/>}<Button type="button" variant="outline" disabled={busy||phoneVerified} onClick={phoneVerified?undefined:(otpSent?verifyOtp:sendOtp)} className="h-12 rounded-2xl px-4 shrink-0">{phoneVerified?<><MailCheck className="w-4 h-4 mr-1"/>Verified</>:otpSent?"Verify OTP":"Send OTP"}</Button></div></>}<Input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" required minLength={6} className="rounded-2xl h-12 bg-card"/><Button type="submit" disabled={busy||(mode === "register"&&!phoneVerified)} className="w-full h-12 rounded-2xl text-base bg-primary hover:bg-primary/90 shadow-soft">{busy ? "…" : mode === "login" ? "Log in" : "Create account"}</Button></form><div className="flex items-center gap-3 my-5"><div className="h-px bg-border flex-1"/><div className="font-mono-label text-muted-foreground">OR</div><div className="h-px bg-border flex-1"/></div><div ref={googleRef} id="google-signin" className="flex justify-center min-h-[44px]"/><button type="button" onClick={switchMode} className="mt-5 text-sm text-muted-foreground hover:text-foreground text-center w-full">{mode === "login" ? "New here? " : "Already have an account? "}<span className="text-primary font-semibold underline-offset-4 hover:underline">{mode === "login" ? "Create an account" : "Log in"}</span></button></div><div className="px-6 pb-8 pt-4 text-center text-[11px] text-muted-foreground font-mono-label">MADE IN INDIA • FOR PEOPLE, NOT PROFILES</div></div></div>;
}
