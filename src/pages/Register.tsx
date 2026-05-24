import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import api from '@/lib/api';

import { motion, AnimatePresence } from 'motion/react';
import { ShieldPlus, ArrowRight, Building2, GitBranchPlus, CheckCircle2, Users } from 'lucide-react';

export default function Register() {
  const [mode, setMode] = useState<'new' | 'join'>('new');
  const [schoolName, setSchoolName] = useState('');
  const [existingSchoolId, setExistingSchoolId] = useState('');
  const [section, setSection] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const navigate = useNavigate();

  const handleSchoolIdLookup = async (id: string) => {
    setExistingSchoolId(id.toUpperCase());
    setSchoolInfo(null);
    if (id.length >= 10) {
      try {
        const res = await api.get(`/auth/school-sections/${id.toUpperCase()}`);
        setSchoolInfo(res.data);
      } catch {
        setSchoolInfo(null);
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload: any = { section, adminName, email, password };
      if (mode === 'new') {
        payload.schoolName = schoolName;
      } else {
        payload.existingSchoolId = existingSchoolId;
      }

      const res = await api.post('/auth/register', payload);
      toast.success(
        <div className="flex flex-col gap-2">
          <span className="font-bold">{mode === 'new' ? 'School Created!' : 'Section Added!'}</span>
          <span>School ID: <strong className="text-primary font-mono text-lg">{res.data.schoolId}</strong></span>
          <span>Section: <strong className="font-mono">{res.data.section}</strong></span>
          <span className="text-xs text-muted-foreground">Use this School ID + your email to log in.</span>
        </div>,
        { duration: 12000 }
      );
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-160px)] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl"
      >
        <Card className="formal-card overflow-hidden border-white/5 bg-black/40 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
          <div className="h-2 bg-gradient-to-r from-emerald-500 via-secondary to-primary animate-gradient-x" />
          <CardHeader className="space-y-4 text-center pt-10">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-2 shadow-2xl shadow-primary/20">
              <ShieldPlus size={32} />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-4xl font-black tracking-tighter text-foreground font-heading leading-tight uppercase">Platform <span className="text-primary">Registry</span></CardTitle>
              <CardDescription className="text-primary font-mono text-xs uppercase tracking-[0.4em] font-black opacity-80">Initialize Organization</CardDescription>
            </div>
          </CardHeader>

          {/* Mode Toggle */}
          <div className="px-10 pt-2 pb-4">
            <div className="grid grid-cols-2 gap-2 bg-white/[0.03] p-1.5 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => { setMode('new'); setSchoolInfo(null); }}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                  mode === 'new' 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                <Building2 size={14} /> New School
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                  mode === 'join' 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                <GitBranchPlus size={14} /> Add Section
              </button>
            </div>
          </div>

          <form onSubmit={handleRegister}>
            <CardContent className="space-y-5 px-10">
              <AnimatePresence mode="wait">
                {mode === 'new' ? (
                  <motion.div
                    key="new-school"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-5"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="schoolName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Institution Name</Label>
                      <Input 
                        id="schoolName" 
                        placeholder="e.g. Lincoln High School" 
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        required 
                        className="bg-black/60 border-white/10 text-md py-6 focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="join-school"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="existingSchoolId" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Existing School ID</Label>
                      <Input 
                        id="existingSchoolId" 
                        placeholder="SCH-XXXXXX" 
                        value={existingSchoolId}
                        onChange={(e) => handleSchoolIdLookup(e.target.value)}
                        required 
                        className="bg-black/60 border-white/10 text-md py-6 focus:border-primary focus:ring-primary/20 rounded-xl transition-all font-mono tracking-widest uppercase"
                      />
                    </div>
                    {/* Live School Preview */}
                    <AnimatePresence>
                      {schoolInfo && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400">
                              <CheckCircle2 size={16} />
                              <span className="text-xs font-black uppercase tracking-widest">School Found</span>
                            </div>
                            <p className="text-foreground font-bold text-lg">{schoolInfo.schoolName}</p>
                            <div className="flex flex-wrap gap-2">
                              {schoolInfo.sections.map((s: any, i: number) => (
                                <span key={i} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono font-bold text-muted-foreground flex items-center gap-1.5">
                                  <Users size={10} /> {s.section}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Common Fields */}
              <div className="space-y-2">
                <Label htmlFor="section" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                  {mode === 'new' ? 'First Section/Branch' : 'New Section/Branch'}
                </Label>
                <Input 
                  id="section" 
                  placeholder="e.g. CS-A, 10th-B, ECE Dept" 
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required 
                  className="bg-black/60 border-white/10 text-md py-6 focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Section Admin Name</Label>
                <Input 
                  id="adminName" 
                  placeholder="e.g. Prof. John Doe" 
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required 
                  className="bg-black/60 border-white/10 text-md py-6 focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="admin@school.edu" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                    className="bg-black/60 border-white/10 text-md py-6 focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                    className="bg-black/60 border-white/10 text-md py-6 focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="px-10 pb-10 pt-2">
              <Button 
                className={`w-full font-bold uppercase tracking-[0.2em] py-8 rounded-xl shadow-2xl group transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  mode === 'new' 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20' 
                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                }`}
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>{mode === 'new' ? 'Creating School...' : 'Adding Section...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {mode === 'new' ? 'Create School' : 'Add Section'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <div className="mt-8 text-center flex flex-col items-center space-y-4">
          <p className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-[0.4em]">Multi-Tenant Architecture • Role-Based Access Control</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Already registered?</span>
            <Button variant="link" className="p-0 h-auto text-primary font-bold hover:no-underline hover:text-primary/80" onClick={() => navigate('/login')}>
              Return to Login
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
