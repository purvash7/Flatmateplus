import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function MatchModal({ match, other, meName, onClose }) {
  const navigate = useNavigate();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 bg-foreground/70 backdrop-blur-md grid place-items-center px-6">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-sm bg-background rounded-3xl p-6 border shadow-lift text-center">
        <div className="font-mono-label text-primary">IT'S A MATCH</div>
        <h2 className="font-display font-extrabold text-4xl mt-2 leading-tight">
          You & <span className="text-primary">{other?.name}</span>
        </h2>
        <div className="flex items-center justify-center gap-4 mt-6">
          {[{ name: meName, photo: null, invert: true }, { name: other?.name, photo: other?.photos?.[0] }].map((p, i) => (
            <div key={i} className={`w-24 h-24 rounded-full overflow-hidden bg-secondary border-4 border-background shadow-soft ${i===1?"-ml-6":""}`}>
              {p.photo ? <img src={fileUrl(p.photo)} className="w-full h-full object-cover" alt={p.name}/> :
                <div className="w-full h-full grid place-items-center font-display font-extrabold text-3xl bg-primary/15 text-primary">{p.name?.[0]}</div>}
            </div>
          ))}
        </div>
        <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
          <Sparkles className="w-4 h-4"/>
          <span className="font-display font-extrabold">{match.score}% compatibility</span>
        </div>
        <p className="text-sm text-muted-foreground mt-4">Say hi before someone else does.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button data-testid="match-chat-btn" onClick={()=>navigate(`/chat/${match.match_id}`)}
                  className="h-12 rounded-2xl bg-primary hover:bg-primary/90">Send a message</Button>
          <Button data-testid="match-keep-btn" onClick={onClose} variant="ghost"
                  className="h-11 rounded-2xl hover:bg-secondary">Keep swiping</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
