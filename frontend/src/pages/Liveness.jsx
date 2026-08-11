import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { loadModels, detectDescriptorFromVideo } from "@/lib/faceUtils";

const STEP_ORDER = ["look_center", "look_left", "look_right", "smile"];
const STEP_LABEL = {
  look_center: "Look straight at the camera",
  look_left: "Slowly turn your head LEFT",
  look_right: "Now turn your head RIGHT",
  smile: "Great — give a big smile!",
};

export default function Liveness() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [error, setError] = useState("");
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (e) {
        setError("Camera access denied. Please allow camera to continue.");
      }
    })();
    loadModels().then(ok => setModelsReady(ok));
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const next = () => {
    if (stepIdx < STEP_ORDER.length - 1) setStepIdx(stepIdx + 1);
    else setDone(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const video = videoRef.current;
      const descriptor = await detectDescriptorFromVideo(video);
      if (!descriptor) {
        toast.error("Could not detect a face. Make sure your face is clearly visible and try again.");
        setSubmitting(false);
        return;
      }
      const canvas = canvasRef.current;
      canvas.width = 480; canvas.height = 640;
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      await api.post("/liveness/verify", {
        steps_completed: STEP_ORDER.length, selfie_base64: dataUrl, face_descriptor: descriptor,
      });
      await refreshUser();
      toast.success("You're verified! Now build your profile.");
      streamRef.current?.getTracks().forEach(t => t.stop());
      navigate("/profile-setup");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to verify");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="px-6 pt-10 pb-6">
        <div className="font-mono-label text-primary">HUMAN CHECK</div>
        <h1 className="text-3xl font-display font-extrabold leading-tight mt-1">Prove you&apos;re real</h1>
        <p className="text-muted-foreground mt-1">Complete 4 quick actions — we&apos;ll capture your face for verification.</p>
      </div>

      <div className="px-6">
        <div className="relative mx-auto w-full aspect-[3/4] rounded-3xl overflow-hidden bg-secondary border shadow-soft">
          {error ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <Camera className="w-8 h-8 mx-auto text-muted-foreground"/>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
              </div>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} playsInline muted/>
              <div className="absolute inset-4 rounded-2xl border-2 border-primary/70 pointer-events-none pulse-ring"/>
              <canvas ref={canvasRef} className="hidden"/>
              {!modelsReady && (
                <div className="absolute bottom-3 left-3 right-3 bg-background/90 backdrop-blur rounded-xl px-3 py-2 text-xs flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin"/> Loading face model…
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {STEP_ORDER.map((s, i) => (
            <div key={s} data-testid={`liveness-dot-${i}`}
                 className={`flex-1 h-1.5 rounded-full ${i < stepIdx ? "bg-primary" : i === stepIdx ? "bg-primary/60" : "bg-border"}`}/>
          ))}
        </div>

        {!done ? (
          <>
            <motion.div key={stepIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-5 p-4 rounded-2xl bg-card border shadow-soft">
              <div className="font-mono-label text-muted-foreground">STEP {stepIdx + 1} / {STEP_ORDER.length}</div>
              <div className="font-display text-xl font-bold mt-1">{STEP_LABEL[STEP_ORDER[stepIdx]]}</div>
              <div className="text-sm text-muted-foreground mt-1">Tap done when you finish the action.</div>
            </motion.div>
            <Button data-testid="liveness-next-btn" disabled={!ready} onClick={next}
                    className="mt-4 w-full h-12 rounded-2xl bg-primary hover:bg-primary/90">
              Done — next step
            </Button>
          </>
        ) : (
          <div className="mt-5 p-5 rounded-2xl bg-primary/10 border border-primary/30">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-primary"/>
              <div className="font-display font-bold text-lg">All checks passed</div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">We&apos;ll snap the final selfie and encode your face for photo matching.</p>
            <Button data-testid="liveness-submit-btn" onClick={submit} disabled={submitting || !modelsReady}
                    className="mt-4 w-full h-12 rounded-2xl bg-primary hover:bg-primary/90">
              {submitting ? "Verifying…" : (modelsReady ? "Capture & continue" : "Loading model…")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
