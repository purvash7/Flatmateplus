import { NavLink } from "react-router-dom";
import { Flame, MessageCircle, User } from "lucide-react";

export default function BottomNav() {
  const items = [
    { to: "/discover", icon: Flame, label: "Discover", testid: "nav-discover" },
    { to: "/matches", icon: MessageCircle, label: "Matches", testid: "nav-matches" },
    { to: "/profile", icon: User, label: "Profile", testid: "nav-profile" },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto z-30">
      <div className="mx-4 mb-4 bg-card/90 backdrop-blur-md border shadow-lift rounded-full px-2 py-2 flex items-center justify-around">
        {items.map(({ to, icon: Icon, label, testid }) => (
          <NavLink key={to} to={to} data-testid={testid}
                   className={({isActive}) => `flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-4 h-4"/>
            <span className="font-semibold">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
