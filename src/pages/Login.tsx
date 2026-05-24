import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import api from '@/lib/api';

import { motion } from 'motion/react';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function Login({ setIsAuthenticated }: { setIsAuthenticated: (v: boolean) => void }) {
  const [schoolId, setSchoolId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { schoolId, email, password });
      localStorage.setItem('adminToken', res.data.token);
      localStorage.setItem('schoolName', res.data.schoolName);
      localStorage.setItem('section', res.data.section);
      localStorage.setItem('adminName', res.data.adminName);
      localStorage.setItem('schoolId', res.data.schoolId);
      setIsAuthenticated(true);
      toast.success('Access Granted');
      navigate('/admin');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Authentication Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-160px)] px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <Card className="formal-card overflow-hidden border-white/5 bg-black/40 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
          <div className="h-2 bg-gradient-to-r from-primary via-secondary to-primary animate-gradient-x" />
          <CardHeader className="space-y-4 text-center pt-12">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-2 shadow-2xl shadow-primary/20">
              <ShieldCheck size={32} />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-5xl font-black tracking-tighter text-foreground font-heading leading-tight uppercase">Secure <span className="text-primary">Gateway</span></CardTitle>
              <CardDescription className="text-primary font-mono text-xs uppercase tracking-[0.4em] font-black opacity-80">Institutional Access Terminal</CardDescription>
            </div>
          </CardHeader>
          <form onSubmit={handleLogin} className="pt-4">
            <CardContent className="space-y-6 px-10">
              <div className="space-y-3">
                <Label htmlFor="schoolId" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">School ID</Label>
                <Input 
                  id="schoolId" 
                  type="text" 
                  placeholder="SCH-XXXXXX" 
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value.toUpperCase())}
                  required 
                  className="bg-black/60 border-white/10 text-lg py-7 focus:border-primary focus:ring-primary/20 rounded-xl transition-all font-mono tracking-widest uppercase"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Administrator ID (Email)</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@institution.edu" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  className="bg-black/60 border-white/10 text-lg py-7 focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center ml-1">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access Code</Label>
                  <button type="button" className="text-[10px] uppercase tracking-widest text-primary/80 hover:text-primary transition-colors font-bold">Credential Recovery</button>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  className="bg-black/60 border-white/10 text-lg py-7 focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
                />
              </div>
            </CardContent>
            <CardFooter className="px-10 pb-12 pt-4">
              <Button 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-[0.2em] py-8 rounded-xl shadow-2xl shadow-primary/20 group transition-all hover:scale-[1.02] active:scale-[0.98]" 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Verifying Identity...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Initialize Access <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <div className="mt-8 text-center flex flex-col items-center space-y-4">
          <p className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-[0.4em]">Proprietary AI Security Protocol • TLS 1.3 Encryption</p>
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>New Organization?</span>
              <Button variant="link" className="p-0 h-auto text-primary font-bold hover:no-underline hover:text-primary/80" onClick={() => navigate('/register')}>
                Register Platform
              </Button>
            </div>
            <div className="w-12 h-[1px] bg-muted-foreground/10 my-1" />
            <Button 
              variant="ghost" 
              className="text-[10px] text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/5 font-mono uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-lg border border-transparent hover:border-rose-500/20 transition-all duration-300"
              onClick={() => navigate('/founder-console')}
            >
              [ROOT GATEWAY]
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
