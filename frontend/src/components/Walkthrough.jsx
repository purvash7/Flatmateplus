import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, X, SlidersHorizontal, MessageCircle, User, ChevronRight } from "lucide-react";

const STEPS = [
  {
    icon: Heart,
    title: "Swipe or tap to like",
    body: "Drag a card right to like, left to pass. Or use the buttons at the bottom.",
  },
  {
    icon: SlidersHorizontal,
    title: "Filter your feed",
    body: "Use the filter icon to narrow by radius, budget, food and more.",
  },
  {
    icon: MessageCircle,
    title: "Match & chat",
    body: "When both of you like each other, it's a match — start chatting instantly.",
  },
  {
    icon: User,
    title: "Update your profile",
    body: "Edit your details, photos and non-negotiables any time from Profile.",
  },
];

const LS_KEY = "fm_walkthrough_v1_done";

export default function Walkthrough({ open, onClose }) {
  const [i, setI] = useState(0);

  useEffect(() => { if (open) setI(0); }, [open]);

  if (!open) return null;
  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;

  const finish = () => {
    localStorage.setItem(LS_KEY, "1");
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-foreground/70 backdrop-blur-sm grid place-items-center px-6">
        <motion.div key={i} initial={{ scale: 0.95, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
                    className="w-full max-w-sm bg-background rounded-3xl p-6 border shadow-lift text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary grid place-items-center mx-auto">
            <step.icon className="w-7 h-7"/>
          </div>
          <h2 className="font-display font-extrabold text-2xl mt-4">{step.title}</h2>
          <p className="text-sm text-muted-foreground mt-2">{step.body}</p>

          <div className="mt-5 flex items-center justify-center gap-2">
            {STEPS.map((_, idx) => (
              <div key={idx} className={`h-1.5 rounded-full transition-all ${idx===i ? "w-6 bg-primary" : "w-2 bg-border"}`}/>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2">
            <Button data-testid="walkthrough-skip-btn" variant="ghost" onClick={finish} className="flex-1 h-11 rounded-2xl">
              Skip
            </Button>
            <Button data-testid="walkthrough-next-btn"
                    onClick={()=> isLast ? finish() : setI(i+1)}
                    className="flex-1 h-11 rounded-2xl bg-primary hover:bg-primary/90 gap-1">
              {isLast ? "Start swiping" : "Next"} <ChevronRight className="w-4 h-4"/>
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function shouldShowWalkthrough() {
  return localStorage.getItem(LS_KEY) !== "1";
}

export function markWalkthroughDone() {
  localStorage.setItem(LS_KEY, "1");
}
