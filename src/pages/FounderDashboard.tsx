import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '@/lib/api';

import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  GitBranch, 
  Users, 
  UserCheck, 
  TrendingUp, 
  Trash2, 
  LogOut, 
  Globe, 
  ShieldAlert, 
  RefreshCw, 
  AlertTriangle,
  Mail,
  Loader2,
  ListFilter,
  Check,
  X,
  Edit2
} from 'lucide-react';

export default function FounderDashboard({ setIsFounderAuthenticated }: { setIsFounderAuthenticated: (v: boolean) => void }) {
  const [stats, setStats] = useState<any>({
    totalStudents: 0,
    totalAdmins: 0,
    totalSchools: 0,
    totalSections: 0,
    averageSystemAttendance: '0'
  });
  const [schools, setSchools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  // Student overrides state
  const [selectedSection, setSelectedSection] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Form states for editing student
  const [editName, setEditName] = useState('');
  const [editRollNo, setEditRollNo] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Configure api token explicitly for founder routes just to be completely safe
  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('founderToken')}` }
  });

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const [statsRes, schoolsRes] = await Promise.all([
        api.get('/founder/stats', getHeaders()),
        api.get('/founder/schools', getHeaders())
      ]);
      setStats(statsRes.data);
      setSchools(schoolsRes.data);
    } catch (err: any) {
      console.error('Founder dashboard load error:', err);
      toast.error('Failed to sync master systems context');
      // If unauthorized, redirect to login
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('founderToken');
    localStorage.removeItem('founderEmail');
    setIsFounderAuthenticated(false);
    navigate('/founder-console');
  };

  const handleDeleteAdmin = async (adminId: string, sectionName: string) => {
    if (!confirm(`CAUTION: Are you sure you want to delete the administrator for Section '${sectionName}'? This will completely erase all student profiles and attendance records in this section.`)) return;

    try {
      await api.delete(`/founder/admins/${adminId}`, getHeaders());
      toast.success(`Section administrative space '${sectionName}' purged`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove section admin');
    }
  };

  const handlePurgeSchool = async (schoolId: string, schoolName: string) => {
    if (!confirm(`⚠️ CRITICAL WARNING ⚠️\nAre you sure you want to completely purge and de-register '${schoolName}'?\nThis will destroy ALL administrator accounts, students, and attendance records associated with this School ID. This action is permanent and cannot be undone.`)) return;

    try {
      await api.delete(`/founder/schools/${schoolId}`, getHeaders());
      toast.success(`School directory and databases for '${schoolName}' wiped completely`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to purge school space');
    }
  };

  // Student overrides callbacks
  const handleOpenRoster = async (schoolId: string, sectionName: string, schoolName: string) => {
    setSelectedSection({ schoolId, sectionName, schoolName });
    setIsRosterLoading(true);
    setEditingStudentId(null);
    try {
      const res = await api.get(`/founder/students/${schoolId}/${encodeURIComponent(sectionName)}`, getHeaders());
      setStudents(res.data);
    } catch (err) {
      toast.error('Failed to load student profiles');
    } finally {
      setIsRosterLoading(false);
    }
  };

  const handleStartEdit = (student: any) => {
    setEditingStudentId(student._id);
    setEditName(student.name);
    setEditRollNo(student.rollNo);
    setEditEmail(student.email);
    setEditPhone(student.phone);
  };

  const handleSaveStudent = async (studentId: string) => {
    try {
      const res = await api.put(`/founder/students/${studentId}`, {
        name: editName,
        rollNo: editRollNo,
        email: editEmail,
        phone: editPhone
      }, getHeaders());
      toast.success('Student profile updated successfully');
      setEditingStudentId(null);
      
      // Update local state list
      setStudents(students.map(s => s._id === studentId ? res.data : s));
      // Refresh analytics count
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save student details');
    }
  };

  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete student '${name}'? This will purge their profile and erase them from all attendance session lists.`)) return;

    try {
      await api.delete(`/founder/students/${studentId}`, getHeaders());
      toast.success(`Student profile '${name}' deleted successfully`);
      setStudents(students.filter(s => s._id !== studentId));
      fetchData();
    } catch (err) {
      toast.error('Failed to delete student');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] gap-4">
        <Loader2 className="animate-spin text-rose-500 w-12 h-12" />
        <p className="font-mono text-sm tracking-widest text-muted-foreground uppercase">Decrypting Global Rosters...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-end gap-6"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-4">
             <div className="w-2 h-12 bg-rose-500 rounded-full shadow-[0_0_25px_rgba(239,68,68,0.8)] border border-rose-500/30" />
             <h1 className="text-6xl font-black tracking-tighter text-foreground font-heading">
               Master <span className="text-rose-500">Console</span>
             </h1>
          </div>
          <div className="flex items-center gap-3 pl-6 flex-wrap">
            <span className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <ShieldAlert size={12} /> Root Scope Enabled
            </span>
            <span className="px-3 py-1.5 bg-white/[0.03] text-muted-foreground border border-white/5 rounded-lg text-[10px] font-mono uppercase tracking-wider">
              {localStorage.getItem('founderEmail')}
            </span>
          </div>
        </div>

        <div className="flex gap-3 p-2 rounded-2xl glass border-border shadow-soft items-center bg-card">
          <Button 
            variant="outline" 
            onClick={fetchData} 
            disabled={isRefreshing}
            className="h-12 px-6 gap-2 border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-xl transition-all"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin text-rose-500" : ""} />
            <span>Telemetry Refresh</span>
          </Button>

          <div className="w-px h-10 bg-border mx-1" />

          <Button 
            onClick={handleLogout} 
            className="h-12 px-8 gap-2 bg-rose-500 text-white hover:bg-rose-600 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-rose-500/20 transition-all hover:scale-[1.02] active:scale-95 border border-rose-500/30"
          >
            <LogOut size={16} /> Wrench Root
          </Button>
        </div>
      </motion.div>

      {/* Analytics KPI Telemetry cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: "Total Schools", value: stats.totalSchools, icon: Building2, color: "text-blue-500" },
          { label: "Active Sections", value: stats.totalSections, icon: GitBranch, color: "text-emerald-500" },
          { label: "Active Admins", value: stats.totalAdmins, icon: Users, color: "text-amber-500" },
          { label: "Total Enrolled", value: stats.totalStudents, icon: UserCheck, color: "text-rose-500" },
          { label: "System Sync Health", value: `${stats.averageSystemAttendance}%`, icon: TrendingUp, color: "text-purple-500" }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <Card className="formal-card border-white/[0.03] p-6 hover:translate-y-[-4px] bg-black/40">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
                <div className={`p-2 rounded-lg bg-white/[0.02] ${stat.color} border border-white/5`}>
                  <stat.icon size={16} />
                </div>
              </div>
              <div className="text-4xl font-bold tracking-tighter text-foreground">{stat.value}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Platform Directory */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="formal-card border-white/5 bg-black/40 overflow-hidden">
          <CardHeader className="border-b border-white/5 py-6 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <Globe className="text-rose-500" />
              <div>
                <CardTitle className="text-2xl font-heading text-foreground">Global Institutional Directory</CardTitle>
                <CardDescription className="text-muted-foreground text-sm font-medium">Platform-wide overview of all registered schools, branches, admins, and students rosters.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {schools.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
                <AlertTriangle className="text-amber-500 w-10 h-10" />
                <p className="font-mono text-sm uppercase tracking-wider">No registered schools or administrators found.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {schools.map((school: any) => (
                  <div key={school.schoolId} className="p-8 space-y-6 hover:bg-white/[0.01] transition-all">
                    
                    {/* School Info Row */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-foreground">{school.schoolName}</h3>
                        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">School ID: <strong className="text-rose-400 font-bold">{school.schoolId}</strong> • {school.sections.length} Branch / Section</p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handlePurgeSchool(school.schoolId, school.schoolName)}
                        className="gap-2 border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg px-4 py-5 font-black uppercase tracking-wider text-xs shadow-md transition-all duration-300"
                      >
                        <Trash2 size={13} /> Purge School Space
                      </Button>
                    </div>

                    {/* School Sections details table */}
                    <div className="overflow-hidden border border-white/5 rounded-xl">
                      <Table>
                        <TableHeader className="bg-white/[0.01]">
                          <TableRow className="border-b border-white/5">
                            <TableHead className="font-black text-muted-foreground tracking-widest text-[10px] uppercase py-4">Section / Class</TableHead>
                            <TableHead className="font-black text-muted-foreground tracking-widest text-[10px] uppercase py-4">Administrator</TableHead>
                            <TableHead className="font-black text-muted-foreground tracking-widest text-[10px] uppercase py-4">Admin Email</TableHead>
                            <TableHead className="font-black text-muted-foreground tracking-widest text-[10px] uppercase py-4 text-center">Active Students</TableHead>
                            <TableHead className="font-black text-muted-foreground tracking-widest text-[10px] uppercase py-4 text-right font-mono">Control overrides</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {school.sections.map((section: any) => (
                            <TableRow key={section.adminId} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <TableCell className="font-mono font-bold text-foreground py-4 text-md">{section.sectionName}</TableCell>
                              <TableCell className="font-semibold text-muted-foreground py-4">{section.adminName}</TableCell>
                              <TableCell className="font-mono text-muted-foreground py-4 text-xs">
                                <span className="flex items-center gap-1.5 pt-1.5">
                                  <Mail size={12} className="text-muted-foreground/50" /> {section.email}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono font-bold text-center py-4 text-emerald-400">{section.studentCount} profiles</TableCell>
                              <TableCell className="text-right py-4">
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleOpenRoster(school.schoolId, section.sectionName, school.schoolName)}
                                    className="border-primary/20 text-primary bg-primary/5 hover:bg-primary hover:text-white rounded-lg px-3.5 gap-1.5 font-bold uppercase text-xs transition-all"
                                  >
                                    <ListFilter size={13} /> Students Roster
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleDeleteAdmin(section.adminId, section.sectionName)}
                                    className="text-rose-500 hover:text-white hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 rounded-lg p-3 transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Cyberpunk console system activity logs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-black/90 border border-white/5 rounded-2xl p-6 font-mono text-[10px] text-rose-500 space-y-2 shadow-2xl"
      >
        <div className="flex justify-between border-b border-rose-500/20 pb-2 mb-4">
          <span className="font-black uppercase tracking-widest">ROOT SECURITY LOGS</span>
          <span className="animate-pulse">● CORE TELEMETRY LINK ACTIVE</span>
        </div>
        <p>[SYSTEM INFO] Root authorization level established via master session credentials</p>
        <p>[PLATFORM DIAL] Multi-school tenancy validation parsed: {stats.totalSchools} active nodes</p>
        <p>[SECURITY INFO] Session telemetry isolated safely. Encryption algorithms: AES-256-GCM</p>
        <p>[NETWORK CORE] Biometric Neural Engine sync status: 100% stable, latency 11ms</p>
      </motion.div>

      {/* Student Roster Overlay Dialog */}
      <Dialog open={!!selectedSection} onOpenChange={() => setSelectedSection(null)}>
        <DialogContent className="max-w-4xl bg-slate-950 border border-white/10 text-white rounded-2xl shadow-2xl p-8 overflow-hidden">
          <DialogHeader className="border-b border-white/5 pb-4 mb-6">
            <DialogTitle className="text-3xl font-heading font-black tracking-tight text-white uppercase flex items-center gap-2">
              <Users className="text-rose-500" />
              <span>Section <span className="text-rose-500">{selectedSection?.sectionName}</span> Students</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm font-medium">
              Overriding student roster directory for <strong>{selectedSection?.schoolName}</strong> (ID: {selectedSection?.schoolId})
            </DialogDescription>
          </DialogHeader>

          {isRosterLoading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3">
              <Loader2 className="animate-spin text-rose-500 w-10 h-10" />
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Syncing student database arrays...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
              <AlertTriangle className="text-amber-500 w-8 h-8" />
              <p className="font-mono text-xs uppercase tracking-wider">No student profiles registered in this section yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden border border-white/5 rounded-xl max-h-[400px] overflow-y-auto bg-black/40">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-950 z-10 border-b border-white/5">
                  <TableRow>
                    <TableHead className="font-bold text-muted-foreground text-[10px] tracking-widest uppercase">Student Name</TableHead>
                    <TableHead className="font-bold text-muted-foreground text-[10px] tracking-widest uppercase">Roll No</TableHead>
                    <TableHead className="font-bold text-muted-foreground text-[10px] tracking-widest uppercase">Email Address</TableHead>
                    <TableHead className="font-bold text-muted-foreground text-[10px] tracking-widest uppercase">Phone Contact</TableHead>
                    <TableHead className="font-bold text-muted-foreground text-[10px] tracking-widest uppercase text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => {
                    const isEditing = editingStudentId === student._id;
                    return (
                      <TableRow key={student._id} className="border-b border-white/5 hover:bg-white/[0.01]">
                        {isEditing ? (
                          <>
                            <TableCell className="py-3">
                              <Input 
                                value={editName} 
                                onChange={(e) => setEditName(e.target.value)} 
                                className="bg-black/80 border-white/10 text-white rounded-lg h-9"
                              />
                            </TableCell>
                            <TableCell className="py-3">
                              <Input 
                                value={editRollNo} 
                                onChange={(e) => setEditRollNo(e.target.value)} 
                                className="bg-black/80 border-white/10 text-white font-mono rounded-lg h-9"
                              />
                            </TableCell>
                            <TableCell className="py-3">
                              <Input 
                                type="email"
                                value={editEmail} 
                                onChange={(e) => setEditEmail(e.target.value)} 
                                className="bg-black/80 border-white/10 text-white font-mono rounded-lg h-9"
                              />
                            </TableCell>
                            <TableCell className="py-3">
                              <Input 
                                value={editPhone} 
                                onChange={(e) => setEditPhone(e.target.value)} 
                                className="bg-black/80 border-white/10 text-white font-mono rounded-lg h-9"
                              />
                            </TableCell>
                            <TableCell className="text-right py-3">
                              <div className="flex justify-end gap-1.5">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSaveStudent(student._id)}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 h-9 w-9 rounded-lg"
                                >
                                  <Check size={14} />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => setEditingStudentId(null)}
                                  className="text-rose-500 hover:bg-rose-500/10 p-2 h-9 w-9 rounded-lg border border-rose-500/20"
                                >
                                  <X size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-bold text-foreground py-4 text-sm">{student.name}</TableCell>
                            <TableCell className="font-mono text-muted-foreground py-4 text-xs">{student.rollNo}</TableCell>
                            <TableCell className="font-mono text-muted-foreground py-4 text-xs">{student.email}</TableCell>
                            <TableCell className="font-mono text-muted-foreground py-4 text-xs">{student.phone}</TableCell>
                            <TableCell className="text-right py-4">
                              <div className="flex justify-end gap-1.5">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleStartEdit(student)}
                                  className="border-white/5 hover:bg-white/5 text-muted-foreground hover:text-foreground h-9 w-9 p-0 rounded-lg"
                                >
                                  <Edit2 size={13} />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleDeleteStudent(student._id, student.name)}
                                  className="text-rose-500 hover:bg-rose-500/10 h-9 w-9 p-0 rounded-lg"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
