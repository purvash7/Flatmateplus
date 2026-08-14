import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MessageCircle, X } from "lucide-react";

export default function MessageNotifier(){
 const {user}=useAuth(); const navigate=useNavigate(); const [message,setMessage]=useState(null); const wsRef=useRef(null);
 useEffect(()=>{if(!user)return;const token=localStorage.getItem("fm_token");if(!token)return;let closed=false,timer;const connect=()=>{if(closed)return;const ws=new WebSocket(BACKEND_URL.replace(/^http/,"ws")+`/api/ws/${user.user_id}?token=${token}`);wsRef.current=ws;ws.onmessage=ev=>{try{const d=JSON.parse(ev.data);if(d.type==="message"&&d.message?.sender_id!==user.user_id&&localStorage.getItem("fm_notify_banner")!=="false"){setMessage(d.message);}}catch{}};ws.onclose=()=>{if(!closed)timer=setTimeout(connect,3000)};};connect();return()=>{closed=true;clearTimeout(timer);wsRef.current?.close();};},[user]);
 if(!message)return null; return <div className="fixed top-3 left-3 right-3 z-[100] max-w-md mx-auto"><div className="bg-foreground text-background rounded-2xl shadow-xl p-3 flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-background/15 grid place-items-center"><MessageCircle className="w-4 h-4"/></div><button className="flex-1 text-left min-w-0" onClick={()=>{setMessage(null);navigate(`/chat/${message.match_id}`)}}><div className="text-sm font-semibold">New message</div><div className="text-xs opacity-80 truncate">{message.text}</div></button><button onClick={()=>setMessage(null)} className="w-8 h-8 rounded-full grid place-items-center hover:bg-background/10"><X className="w-4 h-4"/></button></div></div>;
}
