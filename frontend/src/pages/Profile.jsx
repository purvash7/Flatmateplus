import { useAuth } from "@/context/AuthContext";
import { fileUrl, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { LogOut, MapPin, Briefcase, Utensils, CheckCircle2 } from "lucide-react";

const CHIP = "px-2.5 py-1 rounded-full bg-secondary text-xs";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const doLogout = async () => {
    await logout();
    setToken(null);
    navigate("/");
  };

  return (
    <div className="app-shell pb-32">
      <div className="px-6 pt-8 pb-4 flex items-center justify-between">
        <div>
          <div className="font-mono-label text-primary">PROFILE</div>
          <h1 className="text-2xl font-display font-extrabold leading-tight">Your card</h1>
        </div>
        <button data-testid="logout-btn" onClick={doLogout} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <LogOut className="w-4 h-4"/> Log out
        </button>
      </div>

      <div className="px-6">
        <div className="rounded-3xl overflow-hidden bg-card border shadow-soft">
          <div className="aspect-[4/5] bg-secondary relative">
            {user.photos?.[0] ? (
              <img src={fileUrl(user.photos[0])} className="w-full h-full object-cover" alt={user.name}/>
            ) : (
              <div className="w-full h-full grid place-items-center font-display font-extrabold text-6xl text-primary bg-primary/10">{user.name?.[0]}</div>
            )}
            {user.liveness_verified && (
              <div className="absolute top-3 right-3 bg-background/90 backdrop-blur px-2.5 py-1 rounded-full flex items-center gap-1 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary"/> Verified
              </div>
            )}
          </div>
          <div className="p-5">
            <div className="font-display font-extrabold text-2xl">{user.name}<span className="text-muted-foreground text-lg font-semibold ml-2">{user.age}</span></div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
              {user.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/>{user.locality}, {user.city}</span>}
              {user.work_profile && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5"/>{user.work_profile.replace(/_/g," ")}</span>}
              {user.food_pref && <span className="flex items-center gap-1"><Utensils className="w-3.5 h-3.5"/>{user.food_pref}</span>}
            </div>
            {user.bio && <p className="mt-3 text-sm">{user.bio}</p>}
            {user.prompts?.length > 0 && (
              <div className="mt-4 space-y-3">
                {user.prompts.map((p, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-secondary">
                    <div className="font-mono-label text-muted-foreground">{p.q}</div>
                    <div className="mt-1 font-semibold">{p.a}</div>
                  </div>
                ))}
              </div>
            )}
            {user.interests?.length > 0 && (
              <div className="mt-4">
                <div className="font-mono-label text-muted-foreground mb-2">INTERESTS</div>
                <div className="flex flex-wrap gap-2">
                  {user.interests.map(i => <span key={i} className={CHIP}>{i}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>

        <Button data-testid="edit-profile-btn" variant="outline" onClick={()=>navigate("/edit-profile")}
                className="mt-4 w-full h-11 rounded-2xl bg-card">Edit profile</Button>
        <Button data-testid="manage-photos-btn" variant="ghost" onClick={()=>navigate("/profile-setup")}
                className="mt-2 w-full h-11 rounded-2xl">Manage photos & prompts</Button>
      </div>
      <BottomNav/>
    </div>
  );
}
