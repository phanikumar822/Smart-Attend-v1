import { useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export function useFaceApi() {
  const [isLoaded, setIsLoaded] = useState(modelsLoaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (modelsLoaded) {
      setIsLoaded(true);
      return;
    }

    const loadModels = async () => {
      if (loadingPromise) {
        await loadingPromise;
        setIsLoaded(true);
        return;
      }

      loadingPromise = (async () => {
        try {
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]);
          modelsLoaded = true;
        } catch (err) {
          console.error('Error loading face-api models:', err);
          throw new Error('Failed to load face recognition models. Please check your internet connection.');
        } finally {
          loadingPromise = null;
        }
      })();

      try {
        await loadingPromise;
        setIsLoaded(true);
      } catch (err: any) {
        setError(err.message);
      }
    };

    loadModels();
  }, []);

  return { isLoaded, error };
}
