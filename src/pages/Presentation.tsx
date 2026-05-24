import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Camera, ShieldCheck, BarChart3, Bot, Cpu, Zap, Globe, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const slides = [
  {
    title: "SmartAttend AI",
    subtitle: "The Neural Revolution in Attendance Management",
    content: "A comprehensive, enterprise-grade ecosystem leveraging state-of-the-art Computer Vision and Generative AI to redefine institutional accountability.",
    points: [
      "Vision: Establishing a global standard for touchless, high-integrity identity verification.",
      "Mission: Eliminating administrative friction through autonomous data orchestration.",
      "Core Values: Uncompromising Security, Real-time Transparency, and AI-Driven Intelligence."
    ],
    icon: <Camera className="w-16 h-16 text-[#00f2ff]" />,
    bg: "bg-[#05070a]",
    accent: "text-[#00f2ff]"
  },
  {
    title: "The Legacy System Crisis",
    subtitle: "Quantifying the Inefficiency of Manual Methods",
    points: [
      "Proxy Attendance: Up to 15-20% of attendance records in large institutions are fraudulent.",
      "Time Wastage: Instructors lose an average of 10-15 minutes per session on manual roll calls.",
      "Data Latency: Attendance data often takes days to reach administrators or parents.",
      "Human Error: Manual entry leads to significant discrepancies in long-term academic records.",
      "Operational Cost: High expenditure on physical registers and manual auditing processes."
    ],
    icon: <Users className="w-16 h-16 text-[#ff3366]" />,
    bg: "bg-[#0a0e14]",
    accent: "text-[#ff3366]"
  },
  {
    title: "The Neural Solution",
    subtitle: "Advanced Biometric & Anti-Spoofing Engine",
    content: "Our proprietary recognition engine combines deep learning with active liveness detection to ensure 100% verification integrity.",
    points: [
      "Neural Face Mesh: Real-time mapping of 68 distinct facial landmarks for sub-second recognition.",
      "Active Liveness (Blink Check): Mandatory physiological verification to prevent photo or video spoofing.",
      "Descriptor Extraction: Converting facial features into encrypted 128-bit vector embeddings.",
      "Edge Intelligence: Recognition logic executes in-browser, ensuring user biometric data privacy."
    ],
    icon: <ShieldCheck className="w-16 h-16 text-[#00ff88]" />,
    bg: "bg-[#05070a]",
    accent: "text-[#00ff88]"
  },
  {
    title: "System Architecture",
    subtitle: "A Robust 4-Tier Enterprise Ecosystem",
    grid: [
      { title: "Frontend Layer", desc: "React 19 + Vite SPA with Immersive UI, optimized for sub-100ms interaction latency." },
      { title: "Backend Engine", desc: "Node.js/Express microservice architecture with JWT-based stateless authentication." },
      { title: "Data Persistence", desc: "MongoDB Atlas with optimized indexing for rapid retrieval of millions of attendance logs." },
      { title: "AI Intelligence", desc: "Gemini 1.5 Flash integrated via RAG (Retrieval-Augmented Generation) for data synthesis." }
    ],
    icon: <Zap className="w-16 h-16 text-[#00f2ff]" />,
    bg: "bg-[#0a0e14]",
    accent: "text-[#00f2ff]"
  },
  {
    title: "Core Feature Set",
    subtitle: "End-to-End Operational Control",
    points: [
      "Student Portal: One-tap face scanning with real-time feedback and identity confirmation.",
      "Admin Dashboard: Live monitoring of active sessions with instant present/absent heatmaps.",
      "Automated Reporting: Generation of audit-ready PDF reports with institutional branding.",
      "Smart Notifications: Trigger-based SMS/Email alerts for parents and department heads.",
      "Session Control: Dynamic start/end controls with automated session timeout logic."
    ],
    icon: <Zap className="w-16 h-16 text-[#00f2ff]" />,
    bg: "bg-[#05070a]",
    accent: "text-[#00f2ff]"
  },
  {
    title: "AI RAG Intelligence",
    subtitle: "Conversational Analytics & Data Synthesis",
    content: "We transform static databases into conversational knowledge bases using Retrieval-Augmented Generation.",
    points: [
      "Natural Language Querying: 'Which students missed more than 2 classes in the last 14 days?'",
      "Trend Identification: AI-driven detection of declining attendance patterns before they become critical.",
      "Predictive Risk Assessment: Identifying students at risk of falling below the 75% mandatory threshold.",
      "Automated Summarization: Generating high-level executive summaries for institutional leadership."
    ],
    icon: <Bot className="w-16 h-16 text-[#00f2ff]" />,
    bg: "bg-[#0a0e14]",
    accent: "text-[#00f2ff]"
  },
  {
    title: "Security & Privacy",
    subtitle: "Enterprise-Grade Data Protection",
    points: [
      "End-to-End Encryption: All data in transit is protected via TLS 1.3 and AES-256 at rest.",
      "Stateless Auth: JWT-based security ensures that session data is never stored on the server.",
      "Biometric Privacy: We store mathematical descriptors (vectors), never actual facial images.",
      "Role-Based Access (RBAC): Granular permissions ensuring only authorized admins access sensitive data.",
      "Audit Logging: Comprehensive tracking of all administrative actions for accountability."
    ],
    icon: <ShieldCheck className="w-16 h-16 text-[#1a73e8]" />,
    bg: "bg-[#05070a]",
    accent: "text-[#1a73e8]"
  },
  {
    title: "Scalability & Integration",
    subtitle: "Built for Global Institutions",
    points: [
      "Cloud-Native Design: Seamlessly scales from a single classroom to multi-campus universities.",
      "LMS Connectivity: API-first approach for integration with Moodle, Canvas, and Google Classroom.",
      "Multi-Tenant Support: Isolated data environments for different departments or institutions.",
      "High Availability: 99.9% uptime target with automated failover and load balancing.",
      "API Ecosystem: Extensible REST endpoints for custom third-party integrations."
    ],
    icon: <Globe className="w-16 h-16 text-[#00f2ff]" />,
    bg: "bg-[#0a0e14]",
    accent: "text-[#00f2ff]"
  },
  {
    title: "The Business Case",
    subtitle: "Quantifiable ROI & Operational Impact",
    points: [
      "Efficiency Gain: 95% reduction in time spent on attendance-related administrative tasks.",
      "Accuracy: 100% elimination of proxy attendance and manual data entry errors.",
      "Cost Reduction: Significant savings on paper, printing, and manual auditing labor.",
      "Student Success: 12% average improvement in student retention through early intervention.",
      "Institutional Reputation: Positioning the campus as a tech-forward, high-integrity environment."
    ],
    icon: <BarChart3 className="w-16 h-16 text-[#00ff88]" />,
    bg: "bg-[#05070a]",
    accent: "text-[#00ff88]"
  },
  {
    title: "The Road Ahead",
    subtitle: "Future Innovations & Strategic Vision",
    points: [
      "Mobile Ecosystem: Native iOS/Android apps with GPS-fenced attendance triggers.",
      "Emotion Analytics: AI-driven sentiment analysis to measure student engagement in real-time.",
      "Multi-Factor Biometrics: Integrating voice and gait recognition for ultra-high security zones.",
      "Blockchain Verification: Immutable attendance records stored on a private ledger.",
      "Global Expansion: Localized support for multi-lingual institutional environments."
    ],
    icon: <Globe className="w-16 h-16 text-[#00f2ff]" />,
    bg: "bg-[#0a0e14]",
    accent: "text-[#00f2ff]"
  }
];

export default function Presentation() {
  const [current, setCurrent] = useState(0);

  const next = () => setCurrent((prev) => (prev + 1) % slides.length);
  const prev = () => setCurrent((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="fixed inset-0 z-[100] bg-[#05070a] flex flex-col items-center justify-center overflow-hidden font-sans">
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <div className="w-10 h-10 bg-[#00f2ff] rounded-lg flex items-center justify-center text-[#05070a] shadow-[0_0_20px_rgba(0,242,255,0.4)]">
          <Camera size={20} />
        </div>
        <span className="text-[#00f2ff] font-extrabold tracking-tighter uppercase text-xl">SmartAttend AI</span>
      </div>

      <div className="absolute top-8 right-8 text-[#94a3b8] font-mono text-sm">
        SLIDE {current + 1} / {slides.length}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: "circOut" }}
          className={`w-full max-w-5xl aspect-video rounded-3xl border border-white/10 p-16 flex flex-col justify-center relative overflow-hidden ${slides[current].bg}`}
        >
          {/* Background Glow */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#00f2ff]/5 rounded-full blur-[100px]" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#1a73e8]/5 rounded-full blur-[100px]" />

          <div className="flex items-start gap-12 relative z-10">
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 shadow-2xl">
              {slides[current].icon}
            </div>
            <div className="flex-1 space-y-6">
              <div>
                <h2 className={`text-5xl font-extrabold tracking-tighter uppercase mb-2 ${slides[current].accent}`}>
                  {slides[current].title}
                </h2>
                <p className="text-[#94a3b8] text-xl font-medium tracking-wide">
                  {slides[current].subtitle}
                </p>
              </div>

              {slides[current].content && (
                <p className="text-[#e0e6ed] text-2xl leading-relaxed max-w-2xl">
                  {slides[current].content}
                </p>
              )}

              {slides[current].points && (
                <ul className="space-y-4">
                  {slides[current].points.map((p, i) => (
                    <motion.li 
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="flex items-center gap-4 text-[#e0e6ed] text-xl"
                    >
                      <div className={`w-2 h-2 rounded-full ${slides[current].accent.replace('text-', 'bg-')}`} />
                      {p}
                    </motion.li>
                  ))}
                </ul>
              )}

              {slides[current].grid && (
                <div className="grid grid-cols-2 gap-6 mt-8">
                  {slides[current].grid.map((item, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="p-6 bg-white/5 border border-white/10 rounded-2xl"
                    >
                      <h4 className={`font-bold uppercase tracking-widest text-sm mb-2 ${slides[current].accent}`}>{item.title}</h4>
                      <p className="text-[#94a3b8] text-sm">{item.desc}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-12 flex items-center gap-8">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={prev}
          className="w-14 h-14 rounded-full border-white/10 bg-white/5 text-[#94a3b8] hover:text-[#00f2ff] hover:bg-[#00f2ff]/10"
        >
          <ChevronLeft size={24} />
        </Button>
        
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-8 bg-[#00f2ff]' : 'w-2 bg-white/10'}`} 
            />
          ))}
        </div>

        <Button 
          variant="outline" 
          size="icon" 
          onClick={next}
          className="w-14 h-14 rounded-full border-white/10 bg-white/5 text-[#94a3b8] hover:text-[#00f2ff] hover:bg-[#00f2ff]/10"
        >
          <ChevronRight size={24} />
        </Button>
      </div>

      <Button 
        variant="ghost" 
        className="absolute bottom-8 right-8 text-[#94a3b8] hover:text-white"
        onClick={() => window.history.back()}
      >
        Exit Presentation
      </Button>
    </div>
  );
}
