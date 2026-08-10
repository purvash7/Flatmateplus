import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { navigate("/", { replace: true }); return; }
    const session_id = decodeURIComponent(m[1]);
    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id });
        setToken(data.token);
        setUser(data.user);
        // Clear hash
        window.history.replaceState(null, "", window.location.pathname);
        // Route based on onboarding state
        if (!data.user.onboarding_done) navigate("/onboarding", { replace: true });
        else if (!data.user.liveness_verified) navigate("/liveness", { replace: true });
        else if (!data.user.profile_complete) navigate("/profile-setup", { replace: true });
        else navigate("/discover", { replace: true });
      } catch (e) {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="app-shell flex items-center justify-center">
      <div className="text-muted-foreground text-sm">Signing you in…</div>
    </div>
  );
}
