import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function Settings(){
 const navigate=useNavigate(); const [banner,setBanner]=useState(localStorage.getItem("fm_notify_banner")!=="false");
 const toggle=v=>{setBanner(v);localStorage.setItem("fm_notify_banner",String(v));};
 return <div className="app-shell pb-12"><div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b px-4 py-3 flex items-center gap-3"><button onClick={()=>navigate("/profile")} className="w-9 h-9 rounded-full grid place-items-center hover:bg-secondary"><ArrowLeft className="w-4 h-4"/></button><div className="font-display font-extrabold text-lg">Settings</div></div><div className="px-6 py-6"><div className="font-mono-label text-primary mb-2">NOTIFICATIONS</div><div className="p-4 rounded-2xl bg-card border flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-primary/10 grid place-items-center"><Bell className="w-5 h-5 text-primary"/></div><div className="flex-1"><div className="font-semibold">New message banner</div><div className="text-sm text-muted-foreground mt-1">Show a small banner at the top when a new message arrives.</div></div><Switch checked={banner} onCheckedChange={toggle}/></div></div></div>;
}
