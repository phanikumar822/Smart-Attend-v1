import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { useFaceApi } from '@/hooks/useFaceApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Camera, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

export default function AddStudentDialog({ onStudentAdded }: { onStudentAdded: () => void }) {
  const { isLoaded, error: faceApiError } = useFaceApi();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    setIsCapturing(true);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;

    const enableCamera = async () => {
      if (isCapturing && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error('Camera access error:', err);
          toast.error('Could not access camera. Please ensure you have granted permissions.');
          setIsCapturing(false);
        }
      }
    };

    enableCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCapturing]);

  const captureFace = async () => {
    if (!videoRef.current) return;
    
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error('No face detected. Please try again.');
        return;
      }

      setFaceDescriptor(Array.from(detection.descriptor));
      toast.success('Face captured successfully!');
      
      // Stop camera
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setIsCapturing(false);
    } catch (err) {
      toast.error('Error capturing face');
    }
  };

  const handleSave = async () => {
    if (!name || !rollNo || !phone || !email || !faceDescriptor) {
      return toast.error('Please fill all fields and capture face');
    }

    setIsSaving(true);
    try {
      await api.post('/students', { name, rollNo, phone, email, faceDescriptor });
      toast.success('Student added successfully');
      setOpen(false);
      onStudentAdded();
      // Reset form
      setName(''); setRollNo(''); setPhone(''); setEmail(''); setFaceDescriptor(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add student');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button {...props} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest shadow-xl shadow-primary/30 h-10 px-6 rounded-xl transition-all hover:scale-105 active:scale-95">
            <UserPlus size={18} /> Add Student
          </Button>
        )}
      />
      <DialogContent className="sm:max-w-[425px] bg-[#0f141c] border-white/10 text-[#e0e6ed]">
        <DialogHeader>
          <DialogTitle className="text-[#00f2ff] uppercase tracking-tighter font-extrabold">Add New Student</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">Full Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="John Doe" 
              className="bg-black/50 border-white/10 text-[#e0e6ed] focus:border-[#00f2ff] focus:ring-[#00f2ff]/20"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rollNo" className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">Roll Number</Label>
            <Input 
              id="rollNo" 
              value={rollNo} 
              onChange={(e) => setRollNo(e.target.value)} 
              placeholder="2021CS001" 
              className="bg-black/50 border-white/10 text-[#e0e6ed] focus:border-[#00f2ff] focus:ring-[#00f2ff]/20"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">Phone Number</Label>
            <Input 
              id="phone" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              placeholder="+91 9876543210" 
              className="bg-black/50 border-white/10 text-[#e0e6ed] focus:border-[#00f2ff] focus:ring-[#00f2ff]/20"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">Email Address</Label>
            <Input 
              id="email" 
              type="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="student@example.com" 
              className="bg-black/50 border-white/10 text-[#e0e6ed] focus:border-[#00f2ff] focus:ring-[#00f2ff]/20"
            />
          </div>
          
          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">Face Capture</Label>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
              {isCapturing ? (
                <>
                  <video ref={videoRef} autoPlay muted className="w-full h-full object-cover opacity-70" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-32 h-40 border border-[#00f2ff]/50 rounded-[50%_50%_40%_40%] shadow-[0_0_15px_rgba(0,242,255,0.2)]" />
                  </div>
                  <Button 
                    size="sm" 
                    className="absolute bottom-2 right-2 bg-[#00f2ff] text-[#05070a] hover:bg-[#00f2ff]/90" 
                    onClick={captureFace}
                  >
                    Capture
                  </Button>
                </>
              ) : faceDescriptor ? (
                <div className="flex flex-col items-center gap-2 text-[#00ff88]">
                  <CheckCircle2 size={48} />
                  <span className="text-xs font-mono uppercase tracking-widest">Face Registered</span>
                  <Button variant="ghost" size="sm" onClick={startCamera} className="text-[#94a3b8] hover:text-[#00f2ff]">Retake</Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Button 
                    variant="outline" 
                    className="gap-2 border-white/10 text-[#94a3b8] hover:bg-white/5" 
                    onClick={startCamera} 
                    disabled={!isLoaded}
                  >
                    {!isLoaded ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Camera size={18} />
                    )}
                    {!isLoaded ? 'Initializing AI...' : 'Start Camera'}
                  </Button>
                  {faceApiError && (
                    <p className="text-[10px] text-red-500 font-mono uppercase text-center px-4">
                      {faceApiError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !faceDescriptor}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest py-7 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            {isSaving ? <Loader2 className="animate-spin" /> : 'Secure Student Record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
