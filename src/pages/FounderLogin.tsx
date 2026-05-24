import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import api from '@/lib/api';

import { motion } from 'motion/react';
import { Terminal, ShieldAlert, ArrowRight } from 'lucide-react';

export default function FounderLogin({ setIsFounderAuthenticated }: { setIsFounderAuthenticated: (v: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleFounderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/founder/login', { email, password });
      localStorage.setItem('founderToken', res.data.token);
      localStorage.setItem('founderEmail', res.data.email);
      setIsFounderAuthenticated(true);
      toast.success('Founder Console Activated successfully');
      navigate('/founder-dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Access Denied: Invalid Credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-160px)] px-4 bg-slate-950/20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <Card className="formal-card overflow-hidden border-rose-500/20 bg-black/60 shadow-[0_0_120px_rgba(239,68,68,0.15)] backdrop-blur-md">
          <div className="h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 animate-gradient-x" />
          <CardHeader className="space-y-4 text-center pt-12">
            <div className="mx-auto w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mb-2 shadow-2xl shadow-rose-500/20 border border-rose-500/30">
              <ShieldAlert size={32} />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-4xl font-black tracking-tighter text-foreground font-heading leading-tight uppercase">Founder <span className="text-rose-500">Terminal</span></CardTitle>
              <CardDescription className="text-rose-500 font-mono text-xs uppercase tracking-[0.4em] font-black opacity-80">System Master Command access</CardDescription>
            </div>
          </CardHeader>
          <form onSubmit={handleFounderLogin} className="pt-4">
            <CardContent className="space-y-6 px-10">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Founder Identifier (Email)</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="founder@smartattend.ai" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  className="bg-black/60 border-rose-500/10 text-lg py-7 focus:border-rose-500 focus:ring-rose-500/20 rounded-xl transition-all font-mono"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Cryptographic Access Code</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  className="bg-black/60 border-rose-500/10 text-lg py-7 focus:border-rose-500 focus:ring-rose-500/20 rounded-xl transition-all"
                />
              </div>
            </CardContent>
            <CardFooter className="px-10 pb-12 pt-4">
              <Button 
                className="w-full bg-rose-500 text-white hover:bg-rose-600 font-bold uppercase tracking-[0.2em] py-8 rounded-xl shadow-2xl shadow-rose-500/20 group transition-all hover:scale-[1.02] active:scale-[0.98] border border-rose-500/30" 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Authorizing Master Key...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Activate Console <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <p className="mt-8 text-center text-[10px] font-mono text-muted-foreground/30 uppercase tracking-[0.4em]">ROOT ACCESS • UNRESTRICTED GLOBAL SCOPE</p>
      </motion.div>
    </div>
  );
}
