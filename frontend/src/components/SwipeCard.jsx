import { motion, useMotionValue, useTransform } from "framer-motion";
import { fileUrl } from "@/lib/api";
import { MapPin, Briefcase, Utensils, ShieldCheck } from "lucide-react";

const HOUSING_LABEL = {
  have_house: "Has a place — wants a flatmate",
  need_house_together: "Wants to find a place together",
  need_house_from_someone: "Looking for a spare room",
};

const HIGHLIGHT_LABELS = {
  same_locality: "Same area",
  close_by: "Nearby",
  housing_complementary: "Housing needs match",
  budget_overlap: "Budget aligns",
  food_same: "Same food vibe",
  clean_same: "Similar cleanliness",
  sleep_same: "Same sleep schedule",
  social_same: "Same social energy",
  smoking_same: "Smoking match",
  drinking_same: "Drinking match",
  pets_same: "Both pet-friendly",
  guests_align: "Guest habits align",
  work_schedule_same: "Same work schedule",
  interests_shared: "Shared interests",
  languages_shared: "Same language",
};

export default function SwipeCard({ candidate, onSwipe, isTop, index }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [40, 140], [0, 1]);
  const passOpacity = useTransform(x, [-140, -40], [1, 0]);
  const { user, highlights = [], distance_km } = candidate;
  const mainPhoto = user.photos?.[0];

  const handleEnd = (_, info) => {
    if (info.offset.x > 120) onSwipe("like");
    else if (info.offset.x < -120) onSwipe("pass");
  };

  const topHighlights = highlights.slice(0, 4);

  return (
    <motion.div
      data-testid={isTop ? "swipe-card-top" : `swipe-card-${index}`}
      className="absolute inset-0"
      style={{ x, rotate, zIndex: 100 - index }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleEnd}
      initial={{ scale: 1 - index * 0.04, y: index * 10, opacity: index > 2 ? 0 : 1 }}
      animate={{ scale: 1 - index * 0.04, y: index * 10, opacity: index > 2 ? 0 : 1 }}
      exit={{ x: x.get() > 0 ? 400 : -400, opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden bg-card border shadow-lift grainy">
        {mainPhoto ? (
          <img src={fileUrl(mainPhoto)} alt={user.name} className="absolute inset-0 w-full h-full object-cover"/>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/30 grid place-items-center">
            <div className="font-display text-7xl font-extrabold text-primary/40">{user.name?.[0]}</div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent"/>

        {user.main_photo_verified && (
          <div className="absolute top-4 right-4 bg-background/90 backdrop-blur rounded-full px-2.5 py-1 flex items-center gap-1 shadow-soft">
            <ShieldCheck className="w-3.5 h-3.5 text-primary"/>
            <span className="font-mono-label text-primary">VERIFIED</span>
          </div>
        )}

        <motion.div style={{ opacity: likeOpacity }} className="absolute top-8 left-6 rotate-[-12deg] border-4 border-primary text-primary rounded-2xl px-3 py-1 font-display font-extrabold text-2xl bg-background/70 backdrop-blur">
          LIKE
        </motion.div>
        <motion.div style={{ opacity: passOpacity }} className="absolute top-8 right-6 rotate-[12deg] border-4 border-destructive text-destructive rounded-2xl px-3 py-1 font-display font-extrabold text-2xl bg-background/70 backdrop-blur">
          NOPE
        </motion.div>

        <div className="absolute bottom-0 inset-x-0 p-5 text-white">
          <div className="flex items-end gap-2">
            <div className="font-display font-extrabold text-3xl leading-none">{user.name}</div>
            <div className="text-xl opacity-80 pb-0.5">{user.age}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="bg-white/15 backdrop-blur px-2 py-1 rounded-full flex items-center gap-1">
              <MapPin className="w-3 h-3"/>
              {user.locality || user.city}
              {distance_km != null && ` · ${distance_km.toFixed(1)}km`}
            </span>
            {user.work_profile && (
              <span className="bg-white/15 backdrop-blur px-2 py-1 rounded-full flex items-center gap-1">
                <Briefcase className="w-3 h-3"/>{user.work_profile.replace(/_/g, " ")}
              </span>
            )}
            {user.food_pref && (
              <span className="bg-white/15 backdrop-blur px-2 py-1 rounded-full flex items-center gap-1">
                <Utensils className="w-3 h-3"/>{user.food_pref}
              </span>
            )}
          </div>
          <div className="mt-3 text-sm text-white/90 line-clamp-2">
            {HOUSING_LABEL[user.housing_status]}
          </div>

          {topHighlights.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topHighlights.map(h => (
                <span key={h} className="text-[11px] bg-primary/95 text-primary-foreground px-2 py-1 rounded-full font-semibold">
                  ✓ {HIGHLIGHT_LABELS[h] || h}
                </span>
              ))}
            </div>
          )}
          {user.bio && <div className="mt-2 text-xs text-white/70 line-clamp-2">{user.bio}</div>}
        </div>
      </div>
    </motion.div>
  );
}
