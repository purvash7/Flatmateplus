// Face verification helper using @vladmandic/face-api (loads models from CDN)
import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "https://vladmandic.github.io/face-api/model/";
let loading = null;
let loaded = false;

export async function loadModels() {
  if (loaded) return true;
  if (loading) return loading;
  loading = (async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      loaded = true;
      return true;
    } catch (e) {
      console.error("face-api load failed", e);
      loaded = false;
      loading = null;
      return false;
    }
  })();
  return loading;
}

const OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

export async function detectDescriptorFromVideo(video) {
  const ok = await loadModels();
  if (!ok) return null;
  const det = await faceapi.detectSingleFace(video, OPTS).withFaceLandmarks().withFaceDescriptor();
  return det?.descriptor ? Array.from(det.descriptor) : null;
}

export async function detectDescriptorFromImage(imgOrFile) {
  const ok = await loadModels();
  if (!ok) return { descriptor: null, count: 0 };
  let img = imgOrFile;
  if (imgOrFile instanceof Blob) {
    img = await faceapi.bufferToImage(imgOrFile);
  }
  const all = await faceapi.detectAllFaces(img, OPTS).withFaceLandmarks().withFaceDescriptors();
  if (all.length === 0) return { descriptor: null, count: 0 };
  if (all.length > 1) return { descriptor: null, count: all.length };
  return { descriptor: Array.from(all[0].descriptor), count: 1 };
}

export function euclidean(a, b) {
  if (!a || !b || a.length !== b.length) return 999;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}
