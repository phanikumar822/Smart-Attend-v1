import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, UserCheck, UserX, TrendingUp, Play, Square, Download, MessageSquare, AlertCircle, History, Search, Filter, ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import api from '@/lib/api';
import AddStudentDialog from '@/components/AddStudentDialog';
import Chatbot from '@/components/Chatbot';

export default function AdminDashboard() {
  const [students, setStudents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({ totalStudents: 0, lowAttendance: [], dailyData: [] });
  const [session, setSession] = useState<any>({ presentStudents: [], absentStudents: [], sessionStatus: 'ended' });
  const [isLoading, setIsLoading] = useState(true);
  const [isNotifying, setIsNotifying] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'high' | 'low'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, attendanceFilter]);

  const fetchData = async () => {
    try {
      const [studentsRes, analyticsRes, sessionRes] = await Promise.all([
        api.get('/students'),
        api.get('/analytics'),
        api.get('/attendance/session')
      ]);
      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
      setAnalytics(analyticsRes.data || { totalStudents: 0, lowAttendance: [], dailyData: [] });
      setSession(sessionRes.data || { presentStudents: [], absentStudents: [], sessionStatus: 'ended' });
      setIsOnline(true);
    } catch (err) {
      console.error('Fetch error:', err);
      setIsOnline(false);
      // Don't toast on polling failures to avoid spamming the user
      if (isLoading) toast.error('Failed to initial sync with neural core');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Set up polling for live updates every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStartSession = async () => {
    try {
      await api.post('/attendance/start');
      toast.success('Attendance session started');
      fetchData();
    } catch (err) {
      toast.error('Failed to start session');
    }
  };

  const handleEndSession = async () => {
    try {
      const loadingToast = toast.loading('Calculated attendance vectors...');
      await api.post('/attendance/end');
      toast.success('Session ended and automated notifications dispatched.', { id: loadingToast });
      fetchData();
    } catch (err) {
      toast.error('Failed to terminate session');
    }
  };

  const handleNotifyAbsentees = async () => {
    setIsNotifying(true);
    const loadingToast = toast.loading('Dispatching warning emails to absentees...');
    try {
      const res = await api.post('/attendance/notify-absentees');
      if (res.data.count === 0) {
        toast.info('No absentees to notify.', { id: loadingToast });
      } else {
        toast.success(`Notifications dispatched! ${res.data.sent} sent, ${res.data.failed} failed.`, { id: loadingToast });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dispatch notifications', { id: loadingToast });
    } finally {
      setIsNotifying(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Are you sure you want to remove this student?')) return;
    try {
      // Optimistic UI updates
      setStudents(prev => prev.filter(s => s._id !== id));
      setSession(prev => ({
        ...prev,
        presentStudents: prev.presentStudents?.filter((sid: any) => (sid._id || sid) !== id) || [],
        absentStudents: prev.absentStudents?.filter((sid: any) => (sid._id || sid) !== id) || [],
      }));

      await api.delete(`/students/${id}`);
      toast.success('Student removed from neural roster');
      fetchData(); // Confirm with server truth
    } catch (err) {
      toast.error('Failed to remove student identity');
      fetchData(); // Revert on failure
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get('/reports/attendance', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'attendance_report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Failed to download PDF');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;

  const systemIntegrity = (Array.isArray(students) && students.length > 0 && typeof students.reduce === 'function')
    ? (students.reduce((acc: any, s: any) => acc + (s.attendancePercentage || 0), 0) / students.length).toFixed(1)
    : '0';

  const COLORS = ['#10b981', '#ef4444'];
  
  const currentPresentStudents = session?.presentStudents?.filter((id: any) => 
    students.some(s => s._id === (id._id || id))
  ) || [];
  const presentCount = currentPresentStudents.length;

  // Dynamic absence count: students currently in roster who are not in present list
  const activeAbsentees = students.filter(s => 
    !session?.presentStudents?.some((id: any) => (id._id || id) === s._id)
  );
  const absentCount = activeAbsentees.length;

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        s.rollNo.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (attendanceFilter === 'all') return matchesSearch;
    if (attendanceFilter === 'high') return matchesSearch && s.attendancePercentage >= 75;
    if (attendanceFilter === 'low') return matchesSearch && s.attendancePercentage < 75;
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const pieData = session ? [
    { name: 'Present', value: presentCount },
    { name: 'Absent', value: absentCount }
  ] : [];

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-end gap-6"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-4">
             <div className="w-2 h-12 bg-primary rounded-full shadow-[0_0_25px_rgba(129,140,248,0.8)]" />
             <h1 className="text-6xl font-black tracking-tighter text-foreground font-heading">
               Institutional <span className="text-primary">Intelligence</span>
             </h1>
          </div>
          <div className="flex items-center gap-3 pl-6 flex-wrap">
            <span className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[11px] font-black uppercase tracking-widest">
              {localStorage.getItem('schoolName') || 'SmartAttend Academy'}
            </span>
            <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[11px] font-black uppercase tracking-widest font-mono">
              Section: {localStorage.getItem('section') || 'A'}
            </span>
            <span className="px-2.5 py-1.5 bg-white/[0.03] text-muted-foreground border border-white/5 rounded-lg text-[10px] font-mono uppercase tracking-wider">
              ID: {localStorage.getItem('schoolId') || 'SCH-DEF123'}
            </span>
            <div className="h-1 w-1 bg-white/20 rounded-full" />
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-destructive shadow-[0_0_8px_#ef4444] animate-pulse'}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-500' : 'text-destructive'}`}>
                {isOnline ? 'Core Unified' : 'Sync Lost'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-4 p-2 rounded-2xl glass border-border shadow-soft items-center bg-card">
          {session?.sessionStatus === 'active' ? (
            <>
              <Button variant="outline" className="h-12 px-6 gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 rounded-xl transition-all shadow-xl font-black uppercase tracking-widest" onClick={handleNotifyAbsentees} disabled={isNotifying}>
                <Mail size={18} /> {isNotifying ? 'Sending...' : 'Notify Absentees'}
              </Button>
              <Button variant="destructive" className="h-12 px-8 gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl transition-all shadow-xl shadow-destructive/20 font-black uppercase tracking-widest" onClick={handleEndSession}>
                <Square size={20} className="fill-current" /> Terminate Session
              </Button>
            </>
          ) : (
            <Button className="h-12 px-8 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95" onClick={handleStartSession}>
              <Play size={20} className="fill-current" /> Initialize Session
            </Button>
          )}
          <div className="w-px h-10 bg-border mx-1" />
          <Button variant="outline" className="h-12 px-6 gap-2 border-border bg-background text-foreground hover:bg-muted rounded-xl transition-all shadow-md active:scale-95 group/dl" onClick={handleDownloadPDF}>
            <Download size={20} className="group-hover/dl:translate-y-0.5 transition-transform" />
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Active Roster", value: students.length || 0, icon: Users, color: "text-primary" },
          { label: "Verification Success", value: presentCount, icon: UserCheck, color: "text-emerald-500" },
          { label: "Anomalies (Absence)", value: absentCount, icon: UserX, color: "text-destructive" },
          { label: "System Integrity", value: `${systemIntegrity}%`, icon: TrendingUp, color: "text-secondary" }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
          >
            <Card className="formal-card border-white/[0.03] p-6 hover:translate-y-[-5px]">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">{stat.label}</p>
                <div className={`p-2 rounded-lg bg-white/[0.03] ${stat.color}`}>
                  <stat.icon size={16} />
                </div>
              </div>
              <div className="text-4xl font-bold tracking-tighter text-foreground">{stat.value}</div>
              <div className="mt-4 h-1 w-full bg-white/[0.03] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "70%" }}
                  className={`h-full bg-current ${stat.color}`}
                />
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <div className="flex justify-between items-center border-b border-white/[0.05] pb-2">
          <TabsList className="bg-transparent border-none p-0 gap-8 h-auto">
            {['overview', 'students', 'history', 'analytics', 'chatbot'].map((tab) => (
              <TabsTrigger 
                key={tab}
                value={tab} 
                className="relative bg-transparent px-4 text-foreground/60 data-[state=active]:text-primary data-[state=active]:bg-transparent text-sm font-black uppercase tracking-[0.3em] h-12 transition-all duration-300 hover:text-foreground hover:bg-muted/50 rounded-t-xl group
                           after:absolute after:bottom-[-9px] after:left-0 after:h-[3px] after:w-0 data-[state=active]:after:w-full after:bg-primary after:transition-all after:duration-500 after:shadow-[0_0_15px_theme(colors.primary)]
                           hover:after:w-[40%] hover:after:bg-primary/40"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        
        <TabsContent value="overview" className="mt-0 space-y-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="formal-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 py-6">
                <div>
                  <CardTitle className="text-2xl font-heading text-primary font-bold">Biometric Flow</CardTitle>
                  <CardDescription className="text-foreground/80 text-[10px] uppercase tracking-widest font-mono font-bold">Present vs Absent (Global)</CardDescription>
                </div>
                <div className="p-3 rounded-xl bg-primary/5 text-primary">
                   <TrendingUp size={20} />
                </div>
              </CardHeader>
              <CardContent 
                className="h-[350px] p-6 relative overflow-hidden"
                style={{ 
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', 
                  backgroundSize: '30px 30px' 
                }}
              >
                {/* Subtle overlay gradient to fade out edges */}
                <div className="absolute inset-0 bg-radial-gradient from-transparent to-card opacity-50 pointer-events-none" />
                
                <div className="relative w-full h-full z-10">
                  {session?.presentStudents && session?.absentStudents ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={10}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none" />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d1117', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#f8fafc' }}
                        itemStyle={{ color: '#f8fafc' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground font-mono uppercase tracking-[0.3em] text-[10px] animate-pulse">Awaiting session pulse...</div>
                )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="formal-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 py-6">
                <div>
                  <CardTitle className="text-2xl font-heading text-destructive font-bold uppercase">Integrity Alerts</CardTitle>
                  <CardDescription className="text-foreground/80 text-[10px] uppercase tracking-widest font-mono font-bold">Engagement below delta-75 threshold</CardDescription>
                </div>
                <div className="p-3 rounded-xl bg-destructive/5 text-destructive">
                   <AlertCircle size={20} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-primary/5 dark:bg-primary/10">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5 pl-6">Neural ID</TableHead>
                        <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5">Identified Name</TableHead>
                        <TableHead className="text-right text-primary font-black uppercase text-[10px] tracking-widest py-5 pr-6">Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {analytics?.lowAttendance?.map((s: any) => (
                      <TableRow key={s._id} className="border-border hover:bg-muted/30 transition-all group">
                        <TableCell className="text-muted-foreground font-mono text-xs pl-6">{s.rollNo}</TableCell>
                        <TableCell className="font-bold text-foreground font-heading text-lg flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                          {s.name}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                           <span className="text-destructive font-black font-mono py-1 px-3 rounded-md bg-destructive/10 text-xs border border-destructive/20 select-none">LOW INTEGRITY {(s.attendancePercentage || 0).toFixed(1)}%</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!analytics?.lowAttendance || analytics?.lowAttendance?.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-16 font-mono uppercase tracking-[0.4em] text-[10px]">All neural systems nominal</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card className="formal-card border-white/10">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
              <div className="space-y-1">
                <CardTitle className="text-primary font-heading text-2xl">Student Management</CardTitle>
                <CardDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-mono">Registry Control Terminal</CardDescription>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative group flex-1 sm:min-w-[280px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Search by name or roll number..." 
                    className="pl-9 bg-primary/5 border-white/10 focus:border-primary/30 rounded-xl h-10 text-xs font-mono"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <Select value={attendanceFilter} onValueChange={(v: any) => setAttendanceFilter(v)}>
                  <SelectTrigger className="w-[140px] bg-primary/5 border-white/10 focus:border-primary/30 rounded-xl h-10 text-xs font-black uppercase">
                    <div className="flex items-center gap-2">
                      <Filter size={12} className="text-primary" />
                      <SelectValue placeholder="Integrity" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-background border-white/10">
                    <SelectItem value="all" className="text-xs font-black uppercase">All Signals</SelectItem>
                    <SelectItem value="high" className="text-xs font-black uppercase text-emerald-500">High Integrity</SelectItem>
                    <SelectItem value="low" className="text-xs font-black uppercase text-destructive">Low Integrity</SelectItem>
                  </SelectContent>
                </Select>

                <AddStudentDialog onStudentAdded={fetchData} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-primary/5 dark:bg-primary/10">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5 pl-6">Neural Signature</TableHead>
                    <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5">Biometric Identity</TableHead>
                    <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5">Contact Vector</TableHead>
                    <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5">Digital Address</TableHead>
                    <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5">Integrity Graph</TableHead>
                    <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5">Current Status</TableHead>
                    <TableHead className="text-right text-primary font-black uppercase text-[10px] tracking-widest py-5 pr-6">Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.map((s: any) => (
                    <TableRow key={s._id} className="border-border hover:bg-muted/10 transition-colors">
                      <TableCell className="font-bold text-foreground font-heading text-lg pl-6">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">{s.rollNo}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{s.phone}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs max-w-[150px] truncate">{s.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden border border-border">
                            <div 
                              className={`h-full ${s.attendancePercentage < 75 ? 'bg-destructive' : 'bg-emerald-500'}`} 
                              style={{ width: `${s.attendancePercentage}%`, boxShadow: `0 0 10px ${s.attendancePercentage < 75 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}` }} 
                            />
                          </div>
                          <span className="text-xs font-bold font-mono text-foreground">{s.attendancePercentage.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${session?.presentStudents?.some((id: any) => (id._id || id) === s._id) ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-destructive shadow-[0_0_8px_#ef4444]'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${session?.presentStudents?.some((id: any) => (id._id || id) === s._id) ? 'text-emerald-500' : 'text-destructive'}`}>
                            {session?.presentStudents?.some((id: any) => (id._id || id) === s._id) ? 'Verified' : 'Absent'}
                            {session?.sessionStatus === 'ended' && ' (Final)'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="text-destructive font-black hover:bg-destructive/10 rounded-xl" onClick={() => handleDeleteStudent(s._id)}>Decommission</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-16 font-mono uppercase tracking-[0.4em] text-[10px]">
                        No matching neural identities found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-black/10">
                  <div className="text-[10px] uppercase font-mono font-bold text-muted-foreground tracking-widest">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} neural signatures
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg border-white/10 bg-primary/5 hover:bg-primary/10 disabled:opacity-30 transition-all"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft size={14} className="text-primary" />
                    </Button>
                    
                    <div className="flex items-center gap-1 mx-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-6 h-6 rounded-md text-[10px] font-black transition-all ${
                            currentPage === page 
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110' 
                              : 'text-muted-foreground hover:bg-white/5'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg border-white/10 bg-primary/5 hover:bg-primary/10 disabled:opacity-30 transition-all"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight size={14} className="text-primary" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="formal-card border-white/10">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-6">
              <div>
                <CardTitle className="text-primary font-heading text-2xl">Archived Records</CardTitle>
                <CardDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-mono">Historical attendance logs</CardDescription>
              </div>
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                 <History size={14} className="text-primary" />
                 <span className="text-[10px] font-black text-primary uppercase tracking-widest">Total Logs: {analytics?.dailyData?.length || 0}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-primary/5 dark:bg-primary/10">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5 pl-6">Session Date</TableHead>
                      <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5">Present Units</TableHead>
                      <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5">Absent Units</TableHead>
                      <TableHead className="text-primary font-black uppercase text-[10px] tracking-widest py-5">Efficiency</TableHead>
                      <TableHead className="text-right text-primary font-black uppercase text-[10px] tracking-widest py-5 pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics?.dailyData?.slice().reverse().map((s: any, idx: number) => {
                      const total = (s.present || 0) + (s.absent || 0);
                      const efficiency = total > 0 ? ((s.present / total) * 100).toFixed(1) : "0.0";
                      return (
                        <TableRow key={idx} className="border-border hover:bg-muted/10 transition-colors">
                          <TableCell className="font-bold text-foreground font-heading text-lg pl-6">{s.date}</TableCell>
                          <TableCell className="text-emerald-500 font-black font-mono text-sm">{s.present || 0}</TableCell>
                          <TableCell className="text-destructive font-black font-mono text-sm">{s.absent || 0}</TableCell>
                          <TableCell>
                             <div className="flex items-center gap-2">
                               <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden border border-border/50">
                                  <div className="h-full bg-primary shadow-[0_0_8px_theme(colors.primary)]" style={{ width: `${efficiency}%` }} />
                               </div>
                               <span className="text-[10px] font-bold font-mono text-foreground">{efficiency}%</span>
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                              s.status === 'active' 
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                                : 'bg-muted/50 text-muted-foreground border-border'
                            }`}>
                              {s.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!analytics?.dailyData || analytics?.dailyData?.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-16 font-mono uppercase tracking-[0.4em] text-[10px]">No historical records found in core memory</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card className="formal-card border-white/10">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-6">
              <div>
                <CardTitle className="text-primary font-heading text-2xl">Evolutionary Metrics</CardTitle>
                <CardDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-mono">Temporal progression analysis</CardDescription>
              </div>
              {session?.sessionStatus === 'active' && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Neural Live Link</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="h-[450px] p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#cbd5e1" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <YAxis stroke="#cbd5e1" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.02)'}}
                    contentStyle={{ backgroundColor: '#0a0c10', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', color: '#ffffff' }}
                  />
                  <Bar dataKey="present" fill="#818cf8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="absent" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chatbot">
          <Chatbot students={students} analytics={analytics} session={session} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
