import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Landing from "@/pages/Landing";
import AuthCallback from "@/pages/AuthCallback";
import Onboarding from "@/pages/Onboarding";
import Liveness from "@/pages/Liveness";
import ProfileBuilder from "@/pages/ProfileBuilder";
import Discover from "@/pages/Discover";
import Matches from "@/pages/Matches";
import Chat from "@/pages/Chat";
import Profile from "@/pages/Profile";
import "@/App.css";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route path="/liveness" element={<Protected><Liveness /></Protected>} />
      <Route path="/profile-setup" element={<Protected><ProfileBuilder /></Protected>} />
      <Route path="/discover" element={<Protected><Discover /></Protected>} />
      <Route path="/matches" element={<Protected><Matches /></Protected>} />
      <Route path="/chat/:matchId" element={<Protected><Chat /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/", { replace: true }); return; }
    // gate onboarding step
    if (!user.onboarding_done && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    } else if (user.onboarding_done && !user.liveness_verified && location.pathname !== "/liveness") {
      navigate("/liveness", { replace: true });
    } else if (user.liveness_verified && !user.profile_complete &&
               !["/profile-setup", "/liveness"].includes(location.pathname) &&
               location.pathname !== "/onboarding") {
      navigate("/profile-setup", { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center">
        <div className="text-muted-foreground text-sm">loading…</div>
      </div>
    );
  }
  if (!user) return null;
  return children;
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
