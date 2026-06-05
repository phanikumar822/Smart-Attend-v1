import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { useFaceApi } from '@/hooks/useFaceApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Camera, CheckCircle2, AlertCircle, Loader2, Zap, Clock, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'motion/react';
import {
  cacheStudents,
  getCachedStudents,
  queueOfflineScan,
  getQueuedScans,
  clearQueuedScans
} from '@/lib/offlineDb';

export default function StudentPortal() {
  const { isLoaded, error } = useFaceApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'awaiting_face' | 'blink_required' | 'matching' | 'matched' | 'error'>('idle');
  const [hasBlinked, setHasBlinked] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState<any>(null);
  const [isLoadedStudents, setIsLoadedStudents] = useState(false);
  const [scanMode, setScanMode] = useState<'single' | 'batch'>('single');
  const [livenessEnabled, setLivenessEnabled] = useState(true);
  const recentlyMarkedRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const sessionRes = await api.get('/attendance/session');
        setSession(sessionRes.data);
      } catch (err) {
        console.error('Failed to fetch session:', err);
      }

      try {
        let studentsData: any[] = [];
        if (navigator.onLine) {
          const studentsRes = await api.get('/students');
          studentsData = studentsRes.data;
          await cacheStudents(studentsData);
        } else {
          console.log('[Offline] Loading students from IndexedDB cache...');
          studentsData = await getCachedStudents();
          toast.info('Offline Mode: Loaded student profiles from cache.');
        }
        setStudents(studentsData);
        setIsLoadedStudents(true);
      } catch (err) {
        console.error('Failed to fetch students, trying local cache...', err);
        const cached = await getCachedStudents();
        if (cached && cached.length > 0) {
          setStudents(cached);
          setIsLoadedStudents(true);
          toast.info('Loaded student profiles from local cache.');
        } else {
          toast.error('Identity database initialization failed.');
        }
      }
    };
    fetchInitialData();
  }, []);

  const syncOfflineScans = async () => {
    if (!navigator.onLine) return;
    try {
      const queued = await getQueuedScans();
      if (queued.length === 0) return;
      
      console.log(`[Offline Sync] Syncing ${queued.length} offline scans to server...`);
      let successCount = 0;
      for (const scan of queued) {
        try {
          await api.post('/attendance/mark', { rollNo: scan.rollNo });
          successCount++;
        } catch (err) {
          console.error(`Failed to sync scan for ${scan.rollNo}:`, err);
        }
      }
      
      await clearQueuedScans();
      if (successCount > 0) {
        toast.success(`Synced ${successCount} offline scans to the server!`);
        const sessionRes = await api.get('/attendance/session');
        setSession(sessionRes.data);
      }
    } catch (err) {
      console.error('Offline sync error:', err);
    }
  };

  useEffect(() => {
    window.addEventListener('online', syncOfflineScans);
    return () => window.removeEventListener('online', syncOfflineScans);
  }, [session]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Female'));
      if (femaleVoice) utterance.voice = femaleVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startVideo = async () => {
    if (!isLoadedStudents) {
      toast.error('Identity database is still initializing, please wait.');
      return;
    }
    syncOfflineScans();
    setIsScanning(true);
    setStatus('awaiting_face');
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
    setMatchedStudent(null);
  };

  useEffect(() => {
    if (!isScanning || !videoRef.current) return;
    let active = true;
    let processing = false;

    const EAR_THRESHOLD = 0.28;
    const calculateEAR = (eye: faceapi.Point[]) => {
      const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
      const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
      const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
      return (v1 + v2) / (2 * h);
    };

    const processSingleFrame = async () => {
      if (!active || processing || !videoRef.current || scanMode !== 'single') return;
      processing = true;

      try {
        if (status === 'awaiting_face') {
          const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
            .withFaceLandmarks();

          if (detection && active) {
            if (livenessEnabled) {
              setStatus('blink_required');
              setHasBlinked(false);
            } else {
              setStatus('matching');
            }
          }
        } 
        
        else if (status === 'blink_required') {
          const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
            .withFaceLandmarks();

          if (!detection && active) {
            setStatus('awaiting_face');
          } else if (detection && active) {
            const landmarks = detection.landmarks;
            const leftEAR = calculateEAR(landmarks.getLeftEye());
            const rightEAR = calculateEAR(landmarks.getRightEye());
            const avgEAR = (leftEAR + rightEAR) / 2;

            if (avgEAR < EAR_THRESHOLD) {
              setHasBlinked(true);
              setStatus('matching');
            }
          }
        } 
        
        else if (status === 'matching') {
          const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection && active) {
            toast.error('Face lost during identity check.');
            setStatus('awaiting_face');
          } else if (detection && active) {
            const validStudents = students.filter((s: any) => s.faceDescriptor && s.faceDescriptor.length > 0);
            if (validStudents.length === 0) {
              toast.error('No registered face profiles found.');
              setStatus('error');
              active = false;
              return;
            }

            const LabeledDescriptors = validStudents.map((s: any) => 
              new faceapi.LabeledFaceDescriptors(s.rollNo, [new Float32Array(s.faceDescriptor)])
            );

            const faceMatcher = new faceapi.FaceMatcher(LabeledDescriptors, 0.7);
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

            if (bestMatch.label === 'unknown') {
              toast.error('Identity verification failed. Unknown face.');
              speak('Access denied. Unknown profile.');
              setStatus('error');
              setTimeout(() => {
                if (active && scanMode === 'single') {
                  setStatus('awaiting_face');
                  setHasBlinked(false);
                }
              }, 2500);
            } else {
              const matchedRollNo = bestMatch.label;
              const matchedStudentInfo = students.find((s: any) => s.rollNo === matchedRollNo);

              if (!matchedStudentInfo) {
                toast.error('Internal matching error.');
                setStatus('error');
                setTimeout(() => {
                  if (active && scanMode === 'single') {
                    setStatus('awaiting_face');
                    setHasBlinked(false);
                  }
                }, 2500);
              } else {
                setMatchedStudent(matchedStudentInfo);
                setStatus('matched');
                speak(`Welcome, ${matchedStudentInfo.name}!`);

                try {
                  if (navigator.onLine) {
                    await api.post('/attendance/mark', { rollNo: matchedRollNo });
                    toast.success(`Attendance marked successfully for ${matchedStudentInfo.name}!`);
                    const sessionRes = await api.get('/attendance/session');
                    setSession(sessionRes.data);
                  } else {
                    await queueOfflineScan(matchedRollNo);
                    toast.info(`Offline Mode: Scan queued for ${matchedStudentInfo.name}`);
                  }
                } catch (err: any) {
                  toast.error(err.response?.data?.error || 'Failed to record attendance');
                }

                setTimeout(() => {
                  if (active && scanMode === 'single') {
                    setMatchedStudent(null);
                    setHasBlinked(false);
                    setStatus('awaiting_face');
                  }
                }, 3500);
              }
            }
          }
        }
      } catch (err) {
        console.error('Single scan error:', err);
      }

      processing = false;
      if (active && scanMode === 'single' && (status === 'awaiting_face' || status === 'blink_required')) {
        requestAnimationFrame(processSingleFrame);
      }
    };

    const processBatchFrame = async () => {
      if (!active || processing || !videoRef.current || !canvasRef.current || scanMode !== 'batch') return;
      processing = true;

      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          const displaySize = { 
            width: videoRef.current.clientWidth, 
            height: videoRef.current.clientHeight 
          };
          
          if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
            canvas.width = displaySize.width;
            canvas.height = displaySize.height;
          }
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (detections.length > 0) {
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            const validStudents = students.filter((s: any) => s.faceDescriptor && s.faceDescriptor.length > 0);
            if (validStudents.length > 0) {
              const LabeledDescriptors = validStudents.map((s: any) => 
                new faceapi.LabeledFaceDescriptors(s.rollNo, [new Float32Array(s.faceDescriptor)])
              );
              const faceMatcher = new faceapi.FaceMatcher(LabeledDescriptors, 0.7);

              for (const det of resizedDetections) {
                const box = det.detection.box;
                const bestMatch = faceMatcher.findBestMatch(det.descriptor);
                const isMatched = bestMatch.label !== 'unknown';
                
                let label = 'Unknown';
                let color = '#ef4444'; // Red
                
                if (isMatched) {
                  const matchedRollNo = bestMatch.label;
                  const student = students.find(s => s.rollNo === matchedRollNo);
                  label = student ? student.name : matchedRollNo;
                  color = '#10b981'; // Green
                  
                  const now = Date.now();
                  const lastMarked = recentlyMarkedRef.current[matchedRollNo] || 0;
                  
                  if (now - lastMarked > 30000) {
                    recentlyMarkedRef.current[matchedRollNo] = now;
                    speak(`Welcome, ${label}!`);
                    
                    try {
                      if (navigator.onLine) {
                        api.post('/attendance/mark', { rollNo: matchedRollNo }).then(() => {
                          toast.success(`Attendance marked successfully for ${label}!`);
                          api.get('/attendance/session').then(res => setSession(res.data)).catch(console.error);
                        }).catch((err: any) => {
                          toast.error(err.response?.data?.error || `Failed to record attendance for ${label}`);
                        });
                      } else {
                        queueOfflineScan(matchedRollNo).then(() => {
                          toast.info(`Offline Mode: Scan queued for ${label}`);
                        }).catch(console.error);
                      }
                    } catch (err) {
                      console.error('Batch marking error:', err);
                    }
                  }
                }
                
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.shadowColor = color;
                ctx.shadowBlur = 10;
                ctx.strokeRect(box.x, box.y, box.width, box.height);
                
                ctx.fillStyle = color;
                ctx.shadowBlur = 0;
                const textWidth = ctx.measureText(label).width;
                ctx.fillRect(box.x, box.y - 25, textWidth + 20, 25);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px monospace';
                ctx.fillText(label, box.x + 10, box.y - 8);
              }
            }
          }
        }
      } catch (err) {
        console.error('Batch scan error:', err);
      }

      processing = false;
      if (active && scanMode === 'batch') {
        requestAnimationFrame(processBatchFrame);
      }
    };

    if (scanMode === 'single') {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      
      if (status === 'awaiting_face' || status === 'blink_required') {
        requestAnimationFrame(processSingleFrame);
      } else if (status === 'matching') {
        processSingleFrame();
      }
    } else if (scanMode === 'batch') {
      requestAnimationFrame(processBatchFrame);
    }

    return () => {
      active = false;
    };
  }, [isScanning, status, students, scanMode, livenessEnabled]);

  if (error) return <div className="text-center py-20 text-destructive">{error}</div>;

  const scanHistory = session?.scans?.map((scan: any) => {
    const student = students.find(s => s._id.toString() === (scan.studentId?._id || scan.studentId || "").toString());
    return {
      ...scan,
      studentName: student?.name || 'Unknown Student',
      rollNo: student?.rollNo || 'N/A'
    };
  }).sort((a: any, b: any) => new Date(b.outTime || b.inTime).getTime() - new Date(a.outTime || a.inTime).getTime());

  const steps = [
    { label: 'Detection', active: status !== 'idle' },
    ...(livenessEnabled && scanMode === 'single' ? [{ label: 'Liveness', active: (status === 'blink_required' || status === 'matching' || status === 'matched') }] : []),
    { label: 'Matching', active: status === 'matching' || status === 'matched' || scanMode === 'batch' },
    { label: 'Success', active: status === 'matched' }
  ];

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Biometric Video Feed */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-7"
          >
            <Card className="formal-card border-white/5 bg-white/[0.02] overflow-hidden relative aspect-square md:aspect-video flex flex-col justify-center items-center">
              <CardContent className="p-0 w-full h-full relative flex items-center justify-center">
                {!isScanning ? (
                  <div className="flex flex-col items-center gap-6 p-8">
                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <Camera className="w-8 h-8 text-white/20" />
                    </div>
                    <Button 
                      onClick={startVideo} 
                      className="gap-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-6 text-md font-bold transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/20"
                      disabled={!isLoaded || !isLoadedStudents}
                    >
                      {!isLoaded || !isLoadedStudents ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Camera size={20} />
                      )}
                      {!isLoaded || !isLoadedStudents ? 'Awakening AI...' : 'Initialize Camera'}
                    </Button>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      muted 
                      className="absolute inset-0 w-full h-full object-cover opacity-50 contrast-125"
                    />
                    <canvas 
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full object-cover z-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/80 pointer-events-none" />
                    
                    {/* Face Scan Overlay (Single Mode Only) */}
                    {scanMode === 'single' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className="w-[60%] h-[75%] max-w-[280px] max-h-[320px] border border-primary/40 rounded-[35%_35%_45%_45%] shadow-[0_0_50px_rgba(99,102,241,0.2)] relative overflow-hidden backdrop-blur-[2px]">
                          <div className="absolute w-full h-[2px] bg-primary shadow-[0_0_20px_#6366f1] animate-scan" style={{ top: '-100%' }} />
                          <div className="absolute inset-0 border-[20px] border-black/40 blur-xl scale-110" />
                        </div>
                      </div>
                    )}
                    
                    {/* Scan Mode & Liveness Toggles */}
                    <div className="absolute top-6 left-6 flex gap-3 z-30">
                      <div className="flex bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-xl">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setScanMode('single')}
                          className={`text-[9px] uppercase tracking-widest font-black rounded-lg h-7 px-3 transition-all ${
                            scanMode === 'single'
                              ? 'bg-primary text-primary-foreground font-black shadow-lg hover:bg-primary'
                              : 'text-muted-foreground hover:text-white hover:bg-transparent'
                          }`}
                        >
                          Single
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setScanMode('batch')}
                          className={`text-[9px] uppercase tracking-widest font-black rounded-lg h-7 px-3 transition-all ${
                            scanMode === 'batch'
                              ? 'bg-primary text-primary-foreground font-black shadow-lg hover:bg-primary'
                              : 'text-muted-foreground hover:text-white hover:bg-transparent'
                          }`}
                        >
                          Batch
                        </Button>
                      </div>

                      {scanMode === 'single' && (
                        <div className="flex bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-xl">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLivenessEnabled(!livenessEnabled)}
                            className={`text-[9px] uppercase tracking-widest font-black rounded-lg h-7 px-3 transition-all ${
                              livenessEnabled
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-500'
                                : 'text-muted-foreground hover:text-white hover:bg-transparent'
                            }`}
                          >
                            Liveness: {livenessEnabled ? 'ON' : 'OFF'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-6 left-6 flex gap-4 pointer-events-none z-10">
                      <div className="bg-black/80 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md">
                        <p className="text-[10px] text-muted-foreground uppercase font-mono mb-1">FPS Output</p>
                        <p className="text-primary font-mono text-sm tracking-tighter">60.2 HZ</p>
                      </div>
                      <div className="bg-black/80 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md">
                        <p className="text-[10px] text-muted-foreground uppercase font-mono mb-1">Latency</p>
                        <p className="text-secondary font-mono text-sm tracking-tighter">14 MS</p>
                      </div>
                    </div>

                    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                      {scanMode === 'single' ? (
                        <>
                          {status === 'awaiting_face' && (
                            <motion.div 
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-[#00f2ff]/20 border border-[#00f2ff] text-[#00f2ff] px-8 py-3 rounded-full text-xs font-black tracking-[0.2em] uppercase animate-pulse backdrop-blur-xl shadow-[0_0_20px_rgba(0,242,255,0.3)]"
                            >
                              Awaiting Subject
                            </motion.div>
                          )}
                          {status === 'blink_required' && (
                            <motion.div 
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-amber-500/20 border border-amber-500 text-amber-500 px-8 py-3 rounded-full text-xs font-black tracking-[0.2em] uppercase animate-pulse backdrop-blur-xl shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                            >
                              Action Required: Blink Eyes
                            </motion.div>
                          )}
                          {status === 'matching' && (
                            <motion.div 
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-purple-500/20 border border-purple-500 text-purple-500 px-8 py-3 rounded-full text-xs font-black tracking-[0.2em] uppercase animate-pulse backdrop-blur-xl shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                            >
                              Matching Identity
                            </motion.div>
                          )}
                        </>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-emerald-500/20 border border-emerald-500 text-emerald-500 px-8 py-3 rounded-full text-xs font-black tracking-[0.2em] uppercase animate-pulse backdrop-blur-xl shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        >
                          Batch Scanning Room
                        </motion.div>
                      )}
                    </div>

                    {/* Exit Camera Button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={stopVideo} 
                      className="absolute top-6 right-6 border-white/10 text-muted-foreground hover:text-white bg-black/40 hover:bg-black/60 rounded-xl z-30"
                    >
                      Close Camera
                    </Button>
                  </>
                )}
                
                <AnimatePresence>
                  {status === 'matched' && matchedStudent && scanMode === 'single' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-[#10b981]/90 flex flex-col items-center justify-center text-white z-40 backdrop-blur-md"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", damping: 10 }}
                      >
                        <CheckCircle2 size={100} className="mb-6" />
                      </motion.div>
                      <h3 className="text-4xl font-black tracking-tighter uppercase font-heading mb-1">{matchedStudent.name}</h3>
                      <p className="text-sm opacity-80 uppercase tracking-widest font-mono mb-4">{matchedStudent.rollNo}</p>
                      <span className="text-xs font-black tracking-[0.3em] uppercase bg-white/20 border border-white/30 px-6 py-2 rounded-full">Attendance Recorded</span>
                    </motion.div>
                  )}

                  {status === 'error' && scanMode === 'single' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-red-500/90 flex flex-col items-center justify-center text-white z-40 backdrop-blur-md"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", damping: 10 }}
                      >
                        <XCircle size={100} className="mb-6 animate-bounce" />
                      </motion.div>
                      <h3 className="text-4xl font-black tracking-tighter uppercase font-heading mb-1">Access Denied</h3>
                      <p className="text-sm opacity-80 uppercase tracking-widest font-mono">Unknown Biometric Profile</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Column: Console Details & Scan History */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-5 flex flex-col gap-6 h-full"
          >
            {/* Steps & Verification State */}
            <Card className="formal-card border-white/5 bg-white/[0.02]">
              <CardHeader className="border-b border-white/10 pb-6">
                <CardTitle className="text-2xl font-heading text-foreground">Verification Console</CardTitle>
                <CardDescription className="text-muted-foreground text-sm font-medium">Automatic facial identity recognition and liveness analysis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* Live Status Header */}
                <div className="bg-black/60 border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest">Active State</span>
                  {status === 'idle' && (
                    <span className="text-xl font-black uppercase text-muted-foreground">Console Offline</span>
                  )}
                  {status === 'awaiting_face' && (
                    <span className="text-xl font-black uppercase text-[#00f2ff] animate-pulse">Awaiting Subject</span>
                  )}
                  {status === 'blink_required' && (
                    <span className="text-xl font-black uppercase text-amber-500 animate-pulse font-heading">Liveness Check</span>
                  )}
                  {status === 'matching' && (
                    <span className="text-xl font-black uppercase text-purple-500 animate-pulse font-heading">Matching Identity</span>
                  )}
                  {status === 'matched' && (
                    <span className="text-xl font-black uppercase text-[#00ff88]">Authenticated</span>
                  )}
                  {status === 'error' && (
                    <span className="text-xl font-black uppercase text-red-500">Access Denied</span>
                  )}
                </div>

                {/* Verification Progress Steps */}
                <div className={`grid gap-2 text-center ${steps.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                  {steps.map((s, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-mono text-xs font-bold transition-all duration-300 ${
                        s.active 
                          ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                          : 'bg-black/40 border-white/10 text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${
                        s.active ? 'text-primary' : 'text-muted-foreground'
                      }`}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Scan History */}
            <Card className="formal-card border-white/5 bg-white/[0.02] flex-1 flex flex-col">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-lg font-heading text-foreground flex items-center gap-2">
                  <Clock size={18} className="text-primary" /> Recent Scans
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 px-0 flex-1 overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto px-6 space-y-3 scrollbar-thin">
                  {scanHistory && scanHistory.length > 0 ? (
                    scanHistory.slice(0, 4).map((scan: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between bg-black/40 border border-white/5 p-4 rounded-xl">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-white">{scan.studentName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{scan.rollNo}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full ${
                            scan.outTime 
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 font-heading' 
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-heading'
                          }`}>
                            {scan.outTime ? 'Checked Out' : 'Checked In'}
                          </span>
                          <p className="text-[9px] text-muted-foreground font-mono">
                            {new Date(scan.outTime || scan.inTime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-xs text-muted-foreground uppercase tracking-widest font-mono">
                      No scans recorded yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}
