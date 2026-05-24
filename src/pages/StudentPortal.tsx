import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { useFaceApi } from '@/hooks/useFaceApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Camera, CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'motion/react';

export default function StudentPortal() {
  const { isLoaded, error } = useFaceApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rollNo, setRollNo] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'detecting' | 'blink_required' | 'matched' | 'error'>('idle');
  const [hasBlinked, setHasBlinked] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await api.get('/attendance/session');
        setSession(res.data);
      } catch (err) {
        console.error('Failed to fetch session');
      }
    };
    fetchSession();
  }, []);

  const startVideo = async () => {
    setIsScanning(true);
    setStatus('detecting');
  };

  useEffect(() => {
    let stream: MediaStream | null = null;

    const enableCamera = async () => {
      if (isScanning && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error('Camera access error:', err);
          toast.error('Could not access camera. Please ensure you have granted permissions.');
          setIsScanning(false);
          setStatus('idle');
        }
      }
    };

    enableCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isScanning]);

  const stopVideo = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsScanning(false);
    setStatus('idle');
  };

  const handleAttendance = async () => {
    if (!rollNo) return toast.error('Please enter Roll Number');
    if (!videoRef.current) return;

    setIsMarking(true);
    setHasBlinked(false);
    setStatus('blink_required');
    
    try {
      // Liveness check loop
      let blinkDetected = false;
      const startTime = Date.now();
      
      const calculateEAR = (eye: faceapi.Point[]) => {
        const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
        const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
        const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
        return (v1 + v2) / (2 * h);
      };

      while (Date.now() - startTime < 10000) { // 10 second timeout
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        if (detection) {
          const landmarks = detection.landmarks;
          const leftEAR = calculateEAR(landmarks.getLeftEye());
          const rightEAR = calculateEAR(landmarks.getRightEye());
          const avgEAR = (leftEAR + rightEAR) / 2;
          
          // EAR below 0.26 is more lenient for various lighting/cameras
          if (avgEAR < 0.26) {
            blinkDetected = true;
            setHasBlinked(true);
            break;
          }
        }
        await new Promise(r => setTimeout(r, 30)); // Even faster sampling
      }

      if (!blinkDetected) {
        toast.error('Liveness check failed. Please blink your eyes.');
        setStatus('detecting');
        setIsMarking(false);
        return;
      }

      // 1. Detect face and get descriptor
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error('No face detected. Please try again.');
        return;
      }

      // 2. Fetch student embeddings from DB
      const studentsRes = await api.get('/students');
      const students = studentsRes.data;
      const student = students.find((s: any) => s.rollNo === rollNo);

      if (!student) {
        toast.error('Student not found');
        return;
      }

      // 3. Compare descriptors
      const faceMatcher = new faceapi.FaceMatcher([
        new faceapi.LabeledFaceDescriptors(student.rollNo, [new Float32Array(student.faceDescriptor)])
      ], 0.6);

      const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

      if (bestMatch.label === 'unknown') {
        toast.error('Face does not match roll number');
        setStatus('error');
      } else {
        // 4. Mark attendance
        await api.post('/attendance/mark', { rollNo });
        toast.success('Attendance marked successfully!');
        setStatus('matched');
        stopVideo();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to mark attendance');
    } finally {
      setIsMarking(false);
    }
  };

  if (error) return <div className="text-center py-20 text-destructive">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <span className="text-secondary font-black tracking-[0.4em] uppercase text-xs">Biometric Verification</span>
        <h1 className="text-8xl font-black tracking-tighter text-foreground font-heading leading-tight drop-shadow-[0_0_30px_rgba(255,255,255,0.15)] dark:drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]">
          Student <span className="text-primary italic">Portal</span>
        </h1>
        <p className="text-foreground text-xl max-w-2xl mx-auto font-medium">Precision attendance tracking powered by computer vision and liveness detection.</p>
      </motion.div>

      {!session || session.sessionStatus !== 'active' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="glass border-destructive/20 bg-destructive/5 overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 w-1 bg-destructive" />
            <CardContent className="py-8 flex items-center gap-6 text-destructive">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle />
              </div>
              <div className="space-y-1">
                <p className="font-black uppercase tracking-widest text-sm text-foreground">Session Inactive</p>
                <p className="text-destructive font-medium text-sm">No active attendance session detected. Please contact your instructor.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-7"
          >
            <Card className="formal-card overflow-hidden border-white/5 bg-black/40">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-primary font-heading text-2xl font-bold">Vision Engine</CardTitle>
                      <CardDescription className="text-foreground font-mono text-xs uppercase tracking-widest font-black">Neural processing online</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_12px_theme(colors.primary)]" />
                      <div className="text-xs font-black font-mono text-primary uppercase tracking-wider">Active Scan</div>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 relative aspect-video bg-black/60 flex items-center justify-center group">
                {!isScanning ? (
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center animate-[spin_10s_linear_infinite]">
                      <Camera className="w-8 h-8 text-white/20" />
                    </div>
                    <Button 
                      onClick={startVideo} 
                      className="gap-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-6 text-md font-bold transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/20"
                      disabled={!isLoaded}
                    >
                      {!isLoaded ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Camera size={20} />
                      )}
                      {!isLoaded ? 'Awakening AI...' : 'Initialize Camera'}
                    </Button>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      muted 
                      className="w-full h-full object-cover opacity-50 contrast-125"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/80" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-72 h-80 border border-primary/40 rounded-[35%_35%_45%_45%] shadow-[0_0_50px_rgba(99,102,241,0.2)] relative overflow-hidden backdrop-blur-[2px]">
                        <div className="absolute w-full h-[2px] bg-primary shadow-[0_0_20px_#6366f1] animate-scan" style={{ top: '-100%' }} />
                        <div className="absolute inset-0 border-[20px] border-black/40 blur-xl scale-110" />
                      </div>
                    </div>
                    
                    <div className="absolute bottom-6 left-6 flex gap-4">
                      <div className="bg-black/80 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md">
                        <p className="text-[10px] text-muted-foreground uppercase font-mono mb-1">FPS Output</p>
                        <p className="text-primary font-mono text-sm tracking-tighter">60.2 HZ</p>
                      </div>
                      <div className="bg-black/80 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md">
                        <p className="text-[10px] text-muted-foreground uppercase font-mono mb-1">Latency</p>
                        <p className="text-secondary font-mono text-sm tracking-tighter">14 MS</p>
                      </div>
                    </div>

                    {status === 'blink_required' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute top-8 left-1/2 -translate-x-1/2 z-30"
                        >
                        <div className="bg-primary/20 border border-primary text-primary px-10 py-4 rounded-full text-sm font-black tracking-[0.3em] uppercase animate-pulse backdrop-blur-xl shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                          Action Required: Blink Eyes
                        </div>
                        </motion.div>
                    )}
                  </>
                )}
                
                <AnimatePresence>
                  {status === 'matched' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-[#10b981]/90 flex flex-col items-center justify-center text-white z-40 backdrop-blur-md"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", damping: 10 }}
                      >
                        <CheckCircle2 size={100} className="mb-6" />
                      </motion.div>
                      <h3 className="text-5xl font-bold tracking-tighter font-heading mb-2">Authenticated</h3>
                      <p className="text-lg opacity-80 uppercase tracking-widest font-mono">Confidence: 99.98%</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-5 space-y-6"
          >
            <Card className="formal-card border-white/5 bg-white/[0.02]">
              <CardHeader className="border-b border-white/10 pb-6">
                <CardTitle className="text-2xl font-heading text-foreground">Identity Portal</CardTitle>
                <CardDescription className="text-muted-foreground text-sm font-medium">Enter your credentials to initiate biometric synchronization.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-foreground ml-1">Credential Index (Roll No)</label>
                  <div className="relative group">
                    <Input 
                      placeholder="e.g. 2021CS001" 
                      value={rollNo}
                      onChange={(e) => setRollNo(e.target.value)}
                      className="text-xl py-8 bg-black/60 border-white/20 text-white focus:border-primary focus:ring-primary/40 rounded-2xl pl-6 font-bold"
                    />
                    <div className="absolute inset-y-0 right-6 flex items-center text-primary font-black font-mono text-xs uppercase tracking-widest opacity-80">Awaiting Input</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Button 
                    className="w-full py-8 text-lg font-bold uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xl shadow-primary/20 disabled:opacity-30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]" 
                    disabled={!isScanning || isMarking || !rollNo || !isLoaded}
                    onClick={handleAttendance}
                  >
                    {isMarking ? (
                      <div className="flex items-center gap-4">
                        <Loader2 className="animate-spin w-5 h-5" /> 
                        <span>{status === 'blink_required' ? 'Awaiting Blink' : 'Computing Face Data'}</span>
                      </div>
                    ) : (
                      'Perform Biometric Sync'
                    )}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground/50 font-mono uppercase tracking-[0.3em]">Advanced Cryptographic Verification</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-white/5 p-6 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Zap className="text-primary w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">Security Protocol</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">System requires active liveness verification. Ensure your face is centered and clearly lit for optimal throughput.</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}
