import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { LogOut, LayoutDashboard, Camera, Zap } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export default function Navbar({ isAuthenticated, setIsAuthenticated }: { isAuthenticated: boolean, setIsAuthenticated: (v: boolean) => void }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('schoolName');
    localStorage.removeItem('section');
    localStorage.removeItem('adminName');
    localStorage.removeItem('schoolId');
    setIsAuthenticated(false);
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-[100] bg-[#020617] text-white border-b border-white/10 shadow-2xl">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="w-12 h-12 bg-primary flex items-center justify-center text-primary-foreground rounded-2xl shadow-xl shadow-primary/30 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
              <Camera size={26} />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#020617] animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-2xl font-black tracking-tighter text-white leading-none">
              SmartAttend<span className="text-primary italic">.AI</span>
            </span>
            <div className="flex items-center gap-1.5 pt-1">
               <span className="px-2 py-0.5 bg-primary/20 text-primary-foreground rounded-sm text-[8px] font-black uppercase tracking-widest border border-primary/30">Neural Engine</span>
               <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-sm text-[8px] font-black uppercase tracking-widest border border-emerald-500/30">Stable v4.2</span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/5 p-1.5 rounded-2xl border border-white/10">
            <Link to="/presentation">
              <Button variant="ghost" size="sm" className="gap-2 text-white font-black hover:bg-white/10 rounded-xl px-4 transition-all group/pitch">
                <Zap size={14} className="text-secondary fill-secondary/20 group-hover:scale-110 transition-transform" />
                <span>Pitch</span>
              </Button>
            </Link>
            
            <div className="h-4 w-px bg-white/10 mx-1" />
            
            <Link to="/student">
              <Button variant="ghost" size="sm" className="gap-2 text-white font-black hover:bg-white/10 rounded-xl px-4 transition-all">
                <Camera size={14} className="text-primary" />
                <span>Student Portal</span>
              </Button>
            </Link>

            {isAuthenticated && (
              <>
                <div className="h-4 w-px bg-white/10 mx-1" />
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="gap-2 text-white font-black hover:bg-white/10 rounded-xl px-4 transition-all">
                    <LayoutDashboard size={14} className="text-emerald-400" />
                    <span>Dashboard</span>
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-6 ml-6">
            <div className="hidden lg:flex flex-col items-end">
              {isAuthenticated ? (
                <>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-1.5 shadow-sm">
                    {localStorage.getItem('schoolName')}
                  </span>
                  <span className="text-[9px] font-mono text-white/40 uppercase tracking-tighter">
                    Sec: {localStorage.getItem('section')} • ID: {localStorage.getItem('schoolId')}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1.5 shadow-sm">
                     <span className="relative flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                     </span>
                     Biometric Core Online
                  </span>
                  <span className="text-[9px] font-mono text-white/40 uppercase tracking-tighter">Sync: 100% Latency: 12ms</span>
                </>
              )}
            </div>
            
            <div className="h-8 w-px bg-white/10" />
            
            <ThemeToggle />
            
            {isAuthenticated ? (
              <Button variant="default" size="sm" onClick={handleLogout} className="gap-2 bg-white text-black font-black hover:bg-white/90 transition-all rounded-xl px-6 group/logout h-10 shadow-lg">
                <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
                Logout
              </Button>
            ) : (
              <Link to="/login">
                <Button variant="default" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/40 rounded-xl px-8 h-10 font-black tracking-wide border border-primary/20">
                  Admin Console
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
