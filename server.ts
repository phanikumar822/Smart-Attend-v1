import express from "express";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

import cors from "cors";


// Extend Express Request type definitions to resolve compilation warnings
declare global {
  namespace Express {
    interface Request {
      adminId?: string;
      schoolId?: string;
      section?: string;
      founderId?: string;
    }
  }
}

dotenv.config();

// Helper to sanitize environment variables that might contain surrounding quotes
const cleanEnvVar = (val: string | undefined): string => {
  if (!val) return "";
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
};

const SMTP_HOST = cleanEnvVar(process.env.SMTP_HOST) || "smtp.gmail.com";
const SMTP_PORT = Number(cleanEnvVar(process.env.SMTP_PORT)) || 587;
const SMTP_USER = cleanEnvVar(process.env.SMTP_USER);
const SMTP_PASS = cleanEnvVar(process.env.SMTP_PASS);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Request logger
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Initialize nodemailer transporter once with pooling for bulk stability
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // Use true for 465, false for other ports
    pool: true,
    maxConnections: 3, // Reduced to be safer
    maxMessages: 100,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const sendEmail = async (to: string, subject: string, html: string) => {
    if (!to || !to.includes('@')) {
      console.log(`[Email Dispatch] Skipping invalid email: ${to}`);
      return;
    }

    console.log(`[Email Dispatch] Attempting to send to: ${to} | Subject: ${subject}`);
    
    // Check if HTTPS Relay URL is configured (to bypass Render's SMTP port blocking on Free plan)
    const EMAIL_RELAY_URL = cleanEnvVar(process.env.EMAIL_RELAY_URL);
    if (EMAIL_RELAY_URL) {
      try {
        console.log(`[Email Dispatch] Routing via HTTPS Relay: ${EMAIL_RELAY_URL}`);
        const response = await axios.post(EMAIL_RELAY_URL, {
          to,
          subject,
          html,
          secret: cleanEnvVar(process.env.JWT_SECRET) || "supersecret"
        }, {
          timeout: 10000 // 10s timeout
        });
        
        if (response.data && response.data.success) {
          console.log(`[Email Dispatch] Success via HTTPS Relay! Recipient: ${to}`);
          return;
        } else {
          console.error(`[Email Dispatch] HTTPS Relay failed or rejected request:`, response.data);
        }
      } catch (relayErr: any) {
        console.error(`[Email Dispatch] HTTPS Relay connection failed:`, relayErr.message);
      }
      console.log(`[Email Dispatch] Falling back to standard SMTP due to relay failure...`);
    }

    try {
      if (SMTP_USER && SMTP_PASS) {
        const info = await transporter.sendMail({
          from: `"SmartAttend AI" <${SMTP_USER}>`,
          to,
          subject,
          html,
        });
        console.log(`[Email Dispatch] Success! Message ID: ${info.messageId} | Recipient: ${to}`);
      } else {
        console.log(`[Email Dispatch] SMTP credentials not fully configured. User: ${SMTP_USER ? 'Set' : 'Missing'}, Pass: ${SMTP_PASS ? 'Set' : 'Missing'}`);
      }
    } catch (err: any) {
      if (err.message.includes('535') && err.message.includes('gmail')) {
        console.error(`[CRITICAL EMAIL ERROR] Gmail Authentication Failed for ${SMTP_USER}. 
        IMPORTANT: If you are using Gmail, you MUST use an 'App Password', not your regular login password.
        Generate one at: https://myaccount.google.com/apppasswords`);
      } else {
        console.error(`[Email Dispatch] Failed for ${to}:`, err.message);
      }
    }
  };

  try {
    // MongoDB Setup
    let mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.log("No MONGODB_URI found, starting In-Memory MongoDB...");
      const mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      console.log("Using In-Memory MongoDB:", mongoUri);
    }

    await mongoose.connect(mongoUri, { family: 4 });
    console.log("Successfully connected to MongoDB");

    // Diagnostic: List authorized AI models
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const diagResponse = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const models = diagResponse.data.models?.map((m: any) => m.name.replace('models/', '')) || [];
      console.log("AUTHORIZED AI MODELS:", models.join(', ') || "NONE FOUND");
    } catch (diagErr: any) {
      console.error("DIAGNOSTIC FAILED: Could not list authorized models:", diagErr.message);
    }
  } catch (dbError) {
    console.error("CRITICAL: Database connection failed:", dbError);
  }

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      timestamp: new Date().toISOString() 
    });
  });

  // Models
  const adminSchema = new mongoose.Schema({
    schoolName: { type: String, required: true },
    section: { type: String, required: true },
    adminName: { type: String, required: true },
    schoolId: { type: String, required: true }, // NOT unique - multiple admins share the same schoolId
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  });

  const Admin = mongoose.model("Admin", adminSchema);

  // Create default admin if none exists
  const adminCount = await Admin.countDocuments();
  if (adminCount === 0) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await Admin.create({
      schoolName: "SmartAttend Academy",
      section: "A",
      adminName: "Super Admin",
      schoolId: "SCH-DEF123",
      email: "admin@test.com",
      password: hashedPassword
    });
    console.log("Default admin created: admin@test.com / admin123 (School ID: SCH-DEF123)");
  }

  // Founder Schema for system-wide dashboard management
  const founderSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "founder" }
  });

  const Founder = mongoose.model("Founder", founderSchema);

  // Seed default founder if none exists or update to match env configuration
  const founderEmail = process.env.FOUNDER_EMAIL || "founder@smartattend.ai";
  const founderPassword = process.env.FOUNDER_PASSWORD || "founder123";
  const hashedPassword = await bcrypt.hash(founderPassword, 10);
  await Founder.findOneAndUpdate(
    { role: "founder" },
    { email: founderEmail, password: hashedPassword },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Founder account configured: ${founderEmail}`);

  const studentSchema = new mongoose.Schema({
    schoolId: { type: String, required: true },
    section: { type: String, required: true },
    name: { type: String, required: true },
    rollNo: { type: String, required: true }, // Removed global uniqueness, should be scoped by school
    phone: { type: String, required: true },
    email: { type: String, required: true },
    faceDescriptor: { type: [Number], required: true }, // Stored as array of numbers
    attendancePercentage: { type: Number, default: 0 },
  });

  const attendanceSchema = new mongoose.Schema({
    schoolId: { type: String, required: true },
    section: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    presentStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    absentStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    sessionStatus: { type: String, enum: ['active', 'ended'], default: 'ended' },
    minGapHours: { type: Number, default: 1 },
    scans: [{
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
      inTime: { type: Date, default: Date.now },
      outTime: { type: Date },
      allScans: [{ type: Date, default: Date.now }]
    }]
  });

  const Student = mongoose.model("Student", studentSchema);
  const Attendance = mongoose.model("Attendance", attendanceSchema);

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
      req.adminId = (decoded as any).id;
      req.schoolId = (decoded as any).schoolId;
      req.section = (decoded as any).section;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Founder Auth Middleware
  const authenticateFounder = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
      if ((decoded as any).role !== 'founder') {
        return res.status(403).json({ error: "Forbidden: Founder access only" });
      }
      req.founderId = (decoded as any).id;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Helper to generate School ID
  const generateSchoolId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'SCH-';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  };

  // API Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { schoolName, section, adminName, email, password, existingSchoolId } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      
      let schoolId: string;
      let resolvedSchoolName = schoolName;

      if (existingSchoolId) {
        // MODE 2: Join an existing school with a new section
        const existingSchool = await Admin.findOne({ schoolId: existingSchoolId });
        if (!existingSchool) {
          return res.status(404).json({ error: "School ID not found. Please check and try again." });
        }
        // Check if this section already exists under this school
        const sectionExists = await Admin.findOne({ schoolId: existingSchoolId, section });
        if (sectionExists) {
          return res.status(409).json({ error: `Section '${section}' already exists under this school.` });
        }
        schoolId = existingSchoolId;
        resolvedSchoolName = existingSchool.schoolName; // Inherit the school name
      } else {
        // MODE 1: Create a brand new school
        let isUnique = false;
        schoolId = '';
        while (!isUnique) {
          schoolId = generateSchoolId();
          const existing = await Admin.findOne({ schoolId });
          if (!existing) isUnique = true;
        }
      }

      const admin = new Admin({ schoolName: resolvedSchoolName, section, adminName, schoolId, email, password: hashedPassword });
      await admin.save();
      res.json({ message: "Admin registered successfully", schoolId, section, schoolName: resolvedSchoolName, isNewSchool: !existingSchoolId });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: "Failed to register admin. Email might be in use." });
    }
  });

  // Get all sections for a school
  app.get("/api/auth/school-sections/:schoolId", async (req, res) => {
    try {
      const admins = await Admin.find({ schoolId: req.params.schoolId }).select('section schoolName adminName -_id');
      if (admins.length === 0) {
        return res.status(404).json({ error: "School not found" });
      }
      res.json({ schoolName: admins[0].schoolName, sections: admins.map(a => ({ section: a.section, adminName: a.adminName })) });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch sections" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { schoolId, email, password } = req.body;
      const admin = await Admin.findOne({ schoolId, email });
      if (!admin || !(await bcrypt.compare(password, admin.password))) {
        return res.status(401).json({ error: "Invalid School ID or credentials" });
      }
      const token = jwt.sign(
        { id: admin._id, schoolId: admin.schoolId, section: admin.section }, 
        process.env.JWT_SECRET || "secret"
      );
      res.json({ 
        token, 
        schoolName: admin.schoolName, 
        section: admin.section, 
        adminName: admin.adminName,
        schoolId: admin.schoolId
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Credential Recovery API Route
  app.post("/api/auth/recover", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email address is required." });
      }

      // Find the administrator associated with this email
      const admin = await Admin.findOne({ email: email.trim().toLowerCase() });
      if (!admin) {
        return res.status(404).json({ error: "No administrator account registered with this email address." });
      }

      // Generate a temporary 8-character alphanumeric access code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let tempCode = 'TEMP-';
      for (let i = 0; i < 6; i++) {
        tempCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Hash and save the temporary access code
      const hashedPassword = await bcrypt.hash(tempCode, 10);
      admin.password = hashedPassword;
      await admin.save();

      // Compose the credential recovery email
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4f46e5; margin: 0;">SmartAttend.AI</h1>
            <p style="color: #64748b; font-size: 12px; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.1em;">Institutional Credential Recovery</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;"/>
          <p style="color: #334155; font-size: 16px;">Hello <strong>${admin.adminName}</strong>,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">You are receiving this email because a credential recovery request was initialized for your administrator account.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; color: #475569; font-size: 13px;"><strong>YOUR CREDENTIALS:</strong></p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-size: 14px; width: 140px;"><strong>School ID:</strong></td>
                <td style="padding: 5px 0; color: #0f172a; font-size: 14px; font-family: monospace;"><strong>${admin.schoolId}</strong></td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-size: 14px;"><strong>Section Name:</strong></td>
                <td style="padding: 5px 0; color: #0f172a; font-size: 14px;">${admin.section}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-size: 14px;"><strong>Temp Access Code:</strong></td>
                <td style="padding: 5px 0; color: #e11d48; font-size: 14px; font-family: monospace;"><strong>${tempCode}</strong></td>
              </tr>
            </table>
          </div>
          
          <p style="color: #ef4444; font-size: 12px; font-style: italic; line-height: 1.5; margin-top: 20px;">
            * Important Note: For maximum security, please log in immediately using this temporary Access Code and update your password in your settings profile.
          </p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 25px; margin-bottom: 15px;"/>
          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
            SmartAttend.AI Security Engine. All rights reserved.
          </p>
        </div>
      `;

      // Dispatch recovery email
      if (SMTP_USER && SMTP_PASS) {
        await sendEmail(
          admin.email,
          "Credential Recovery: " + admin.schoolName + " Admin Portal",
          emailBody
        );
        res.json({ message: "Credential recovery instructions sent successfully to " + admin.email });
      } else {
        console.warn("[RECOVERY WARNING] SMTP is not configured. Returning plain text response for developer visibility.");
        res.json({ 
          message: "SMTP is offline. Verification fallback:", 
          developerFallback: { schoolId: admin.schoolId, tempCode } 
        });
      }
    } catch (err) {
      console.error('Credential recovery error:', err);
      res.status(500).json({ error: "Failed to dispatch recovery email. Please try again." });
    }
  });

  // ================= Founder API Routes =================

  // Founder Login
  app.post("/api/founder/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const founder = await Founder.findOne({ email });
      if (!founder || !(await bcrypt.compare(password, founder.password))) {
        return res.status(401).json({ error: "Invalid founder credentials" });
      }
      const token = jwt.sign(
        { id: founder._id, role: "founder" }, 
        process.env.JWT_SECRET || "secret"
      );
      res.json({ token, email: founder.email, role: "founder" });
    } catch (err) {
      console.error('Founder login error:', err);
      res.status(500).json({ error: "Founder authentication failed" });
    }
  });

  // Founder Platform-Wide Analytics Stats
  app.get("/api/founder/stats", authenticateFounder, async (req, res) => {
    try {
      const totalStudents = await Student.countDocuments();
      const totalAdmins = await Admin.countDocuments();
      
      // Calculate active schools & sections
      const schoolIds = await Admin.distinct("schoolId");
      const totalSchools = schoolIds.length;
      
      // Sections count is simply total number of distinct schoolId + section combos
      const distinctSections = await Admin.aggregate([
        { $group: { _id: { schoolId: "$schoolId", section: "$section" } } }
      ]);
      const totalSections = distinctSections.length;

      // System integrity: average attendance percentage of all students in the database
      const allStudents = await Student.find({}, "attendancePercentage");
      const totalAttendance = allStudents.reduce((acc, s) => acc + (s.attendancePercentage || 0), 0);
      const averageSystemAttendance = allStudents.length > 0 
        ? (totalAttendance / allStudents.length).toFixed(1)
        : "0";

      res.json({
        totalStudents,
        totalAdmins,
        totalSchools,
        totalSections,
        averageSystemAttendance
      });
    } catch (err) {
      console.error('Founder stats error:', err);
      res.status(500).json({ error: "Failed to fetch platform telemetry" });
    }
  });

  // List all registered schools and admins
  app.get("/api/founder/schools", authenticateFounder, async (req, res) => {
    try {
      const admins = await Admin.find({}).select("-password");
      
      // Group admins, sections and student count per school
      const schoolData: any[] = [];

      for (const admin of admins) {
        const studentCount = await Student.countDocuments({ schoolId: admin.schoolId, section: admin.section });
        
        let schoolEntry = schoolData.find(s => s.schoolId === admin.schoolId);
        if (!schoolEntry) {
          schoolEntry = {
            schoolId: admin.schoolId,
            schoolName: admin.schoolName,
            sections: []
          };
          schoolData.push(schoolEntry);
        }

        schoolEntry.sections.push({
          adminId: admin._id,
          adminName: admin.adminName,
          email: admin.email,
          sectionName: admin.section,
          studentCount
        });
      }

      res.json(schoolData);
    } catch (err) {
      console.error('Founder school list error:', err);
      res.status(500).json({ error: "Failed to fetch schools directory" });
    }
  });

  // Delete specific Admin (Section level)
  app.delete("/api/founder/admins/:id", authenticateFounder, async (req, res) => {
    try {
      const admin = await Admin.findById(req.params.id);
      if (!admin) return res.status(404).json({ error: "Administrator not found" });
      
      // Remove admin, students and attendances for this section
      await Admin.findByIdAndDelete(req.params.id);
      await Student.deleteMany({ schoolId: admin.schoolId, section: admin.section });
      await Attendance.deleteMany({ schoolId: admin.schoolId, section: admin.section });

      res.json({ message: `Section '${admin.section}' administrator removed successfully` });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete section administrator" });
    }
  });

  // Delete entire School (purges all affiliated data)
  app.delete("/api/founder/schools/:schoolId", authenticateFounder, async (req, res) => {
    try {
      const schoolId = req.params.schoolId;
      const admins = await Admin.find({ schoolId });
      if (admins.length === 0) return res.status(404).json({ error: "School not found" });

      // Purge everything
      await Admin.deleteMany({ schoolId });
      await Student.deleteMany({ schoolId });
      await Attendance.deleteMany({ schoolId });

      res.json({ message: `School '${admins[0].schoolName}' and all associated data completely purged` });
    } catch (err) {
      res.status(500).json({ error: "Failed to purge school" });
    }
  });

  // Get all students for a specific school and section
  app.get("/api/founder/students/:schoolId/:section", authenticateFounder, async (req, res) => {
    try {
      const { schoolId, section } = req.params;
      const students = await Student.find({ schoolId, section });
      res.json(students);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch student directory" });
    }
  });

  // Edit any student
  app.put("/api/founder/students/:id", authenticateFounder, async (req, res) => {
    try {
      const studentId = req.params.id;
      const { name, rollNo, email, phone } = req.body;

      // Get the student first to check their school & section
      const targetStudent = await Student.findById(studentId);
      if (!targetStudent) return res.status(404).json({ error: "Student not found" });

      if (rollNo && rollNo.trim() !== targetStudent.rollNo) {
        // Check if another student has this rollNo in the same school & section
        const existingRoll = await Student.findOne({
          _id: { $ne: studentId },
          schoolId: targetStudent.schoolId,
          section: targetStudent.section,
          rollNo: rollNo.trim()
        });
        if (existingRoll) {
          return res.status(400).json({ error: "A student with this Roll Number (Neural ID) already exists in this section." });
        }
      }

      if (email && email.trim().toLowerCase() !== targetStudent.email.toLowerCase()) {
        // Check if another student has this email in the same school & section
        const existingEmail = await Student.findOne({
          _id: { $ne: studentId },
          schoolId: targetStudent.schoolId,
          section: targetStudent.section,
          email: email.trim().toLowerCase()
        });
        if (existingEmail) {
          return res.status(400).json({ error: "A student with this Email already exists in this section." });
        }
      }

      const student = await Student.findByIdAndUpdate(
        studentId,
        { name, rollNo, email, phone },
        { new: true }
      );
      if (!student) return res.status(404).json({ error: "Student not found" });
      res.json(student);
    } catch (err) {
      res.status(500).json({ error: "Failed to update student profile" });
    }
  });

  // Delete any student
  app.delete("/api/founder/students/:id", authenticateFounder, async (req, res) => {
    try {
      const studentId = req.params.id;
      const student = await Student.findById(studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });

      await Student.findByIdAndDelete(studentId);

      // Cleanse from attendance arrays
      await Attendance.updateMany(
        { schoolId: student.schoolId, section: student.section }, 
        { 
          $pull: { 
            presentStudents: studentId,
            absentStudents: studentId 
          } 
        }
      );
      res.json({ message: "Student profile deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete student" });
    }
  });

  app.get("/api/students", authenticate, async (req, res) => {
    try {
      const students = await Student.find({ schoolId: req.schoolId, section: req.section });
      res.json(students);
    } catch (err) {
      console.error('API Error /students:', err);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  app.post("/api/students", authenticate, async (req, res) => {
    try {
      const { rollNo, email } = req.body;
      
      // Check if a student with this rollNo already exists in this school & section
      const existingRoll = await Student.findOne({ 
        schoolId: req.schoolId, 
        section: req.section, 
        rollNo: rollNo.trim() 
      });
      if (existingRoll) {
        return res.status(400).json({ error: "A student with this Roll Number (Neural ID) already exists in this section." });
      }

      // Check if email already exists in this school & section
      if (email) {
        const existingEmail = await Student.findOne({
          schoolId: req.schoolId,
          section: req.section,
          email: email.trim().toLowerCase()
        });
        if (existingEmail) {
          return res.status(400).json({ error: "A student with this Email already exists in this section." });
        }
      }

      const student = new Student({ ...req.body, schoolId: req.schoolId, section: req.section });
      await student.save();
      
      // SYNC: If there's an active session, add this new student to its absentee list immediately
      const today = new Date().toISOString().split('T')[0];
      const session = await Attendance.findOne({ date: today, sessionStatus: 'active', schoolId: req.schoolId, section: req.section });
      if (session) {
        if (!session.absentStudents.includes(student._id)) {
          session.absentStudents.push(student._id);
          await session.save();
        }
      }
      
      res.json(student);
    } catch (err) {
      console.error('API Error post /students:', err);
      res.status(500).json({ error: "Failed to create student" });
    }
  });

  app.delete("/api/students/:id", authenticate, async (req, res) => {
    try {
      const studentId = req.params.id;
      await Student.findOneAndDelete({ _id: studentId, schoolId: req.schoolId, section: req.section });
      
      // SYNC: Remove from all attendance recordings (active or ended) 
      // to ensure consistency and prevent ID pollution in counts
      await Attendance.updateMany(
        { schoolId: req.schoolId, section: req.section }, 
        { 
          $pull: { 
            presentStudents: studentId,
            absentStudents: studentId 
          } 
        }
      );
      
      res.json({ message: "Student removed" });
    } catch (err) {
      console.error('API Error delete /students:', err);
      res.status(500).json({ error: "Failed to remove student" });
    }
  });

  app.get("/api/attendance/session", authenticate, async (req, res) => {
    try {
      // Prefer currently active session, otherwise latest ended one
      let session = await Attendance.findOne({ sessionStatus: 'active', schoolId: req.schoolId, section: req.section }).sort({ date: -1 });
      if (!session) {
        session = await Attendance.findOne({ schoolId: req.schoolId, section: req.section }).sort({ date: -1 });
      }
      res.json(session);
    } catch (err) {
      console.error('API Error /attendance/session:', err);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.post("/api/attendance/start", authenticate, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { minGapHours } = req.body;
      const gapValue = minGapHours !== undefined ? Number(minGapHours) : 1;

      // Close any previous day's active sessions for this school/section to prevent orphaned active states
      await Attendance.updateMany(
        { sessionStatus: 'active', schoolId: req.schoolId, section: req.section, date: { $ne: today } },
        { $set: { sessionStatus: 'ended' } }
      );

      let session = await Attendance.findOne({ date: today, schoolId: req.schoolId, section: req.section });
      if (!session) {
        const allStudents = await Student.find({ schoolId: req.schoolId, section: req.section });
        session = new Attendance({
          schoolId: req.schoolId,
          section: req.section,
          date: today,
          presentStudents: [],
          absentStudents: allStudents.map(s => s._id),
          sessionStatus: 'active',
          minGapHours: gapValue,
          scans: []
        });
      } else {
        session.sessionStatus = 'active';
        session.minGapHours = gapValue;
      }
      await session.save();
      res.json(session);
    } catch (err) {
      console.error('API Error /attendance/start:', err);
      res.status(500).json({ error: "Failed to start session" });
    }
  });

  // Automated Email Notifications
  app.post("/api/attendance/notify-absentees", authenticate, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const session = await Attendance.findOne({ date: today, sessionStatus: 'active', schoolId: req.schoolId, section: req.section }).populate('absentStudents');
      
      if (!session) {
        return res.status(404).json({ error: "No active session found for today." });
      }

      if (!session.absentStudents || session.absentStudents.length === 0) {
        return res.json({ message: "No absentees to notify.", count: 0 });
      }

      let sentCount = 0;
      let failedCount = 0;

      // Dispatch emails using global sendEmail helper (supports HTTPS relay)
      for (const student of session.absentStudents as any[]) {
        if (!student.email) continue;
        
        try {
          const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #1e1b4b; padding: 20px; text-align: center;">
                <h2 style="color: #ffffff; margin: 0;">SmartAttend AI</h2>
                <p style="color: #94a3b8; margin: 5px 0 0 0;">Institutional Integrity System</p>
              </div>
              <div style="padding: 30px; background-color: #ffffff;">
                <p style="font-size: 16px; color: #333333;">Dear <strong>${student.name}</strong> (Roll No: ${student.rollNo}),</p>
                <p style="font-size: 16px; color: #333333; line-height: 1.5;">
                  This is an automated notification from the SmartAttend AI Biometric Core. 
                  Our system records indicate that you have been marked <strong>ABSENT</strong> for today's session (${today}).
                </p>
                <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 25px 0;">
                  <p style="color: #991b1b; margin: 0; font-weight: bold;">Current Attendance: ${student.attendancePercentage?.toFixed(1)}%</p>
                </div>
                <p style="font-size: 14px; color: #666666; line-height: 1.5;">
                  Consistent attendance is critical to maintaining your institutional integrity profile. If you believe this is an error, please contact your administrator immediately.
                </p>
              </div>
              <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e0e0e0;">
                <p style="font-size: 12px; color: #94a3b8; margin: 0;">This is an automated message generated by the SmartAttend Neural Engine. Please do not reply to this email.</p>
              </div>
            </div>
          `;

          await sendEmail(student.email, "⚠️ Urgent: Attendance Absence Notification", emailBody);
          sentCount++;
        } catch (mailErr) {
          console.error(`Failed to send email to ${student.email}:`, mailErr);
          failedCount++;
        }
      }

      res.json({ message: "Notifications dispatched", sent: sentCount, failed: failedCount });
    } catch (err) {
      console.error('API Error /attendance/notify-absentees:', err);
      res.status(500).json({ error: "Failed to process notifications" });
    }
  });

  // PDF Generation
  app.get("/api/reports/attendance", authenticate, async (req, res) => {
    try {
      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.pdf');
      
      doc.pipe(res);
      
      const students = await Student.find({ schoolId: req.schoolId, section: req.section });
      const sessions = await Attendance.find({ schoolId: req.schoolId, section: req.section }).sort({ date: -1 });
      const endedSessions = sessions.filter(s => s.sessionStatus === 'ended');
      const latestSession = sessions[0];

      // --- PAGE 1: Overall Attendance Roster ---
      doc.fontSize(24).fillColor('#1e1b4b').text('SmartAttend AI', { align: 'left' });
      doc.fontSize(10).fillColor('#64748b').text('INSTITUTIONAL INTEGRITY TERMINAL', { align: 'left' });
      doc.moveDown();
      doc.fontSize(18).fillColor('#1e1b4b').text('Official Attendance Roster', { align: 'left' });
      doc.fontSize(10).fillColor('#94a3b8').text("Report ID: " + Math.random().toString(36).substring(7).toUpperCase());
      doc.text("Generated: " + new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: true }));
      doc.moveDown(2);
      
      // Summary Box
      const startBoxY = doc.y;
      doc.rect(50, startBoxY, 512, 60).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#1e1b4b').fontSize(12);
      doc.text("Total Valid Roster: " + students.length, 70, startBoxY + 15);
      doc.text("Total Archived Sessions: " + endedSessions.length, 70, startBoxY + 35);
      doc.moveDown(3);
      
      // Student Table
      doc.fontSize(14).fillColor('#1e1b4b').text('Registry Lifecycle Integrity', { underline: true });
      doc.moveDown();
      
      students.forEach((s, i) => {
        const color = s.attendancePercentage < 75 ? '#ef4444' : '#10b981';
        const startY = doc.y;
        
        doc.fontSize(11).fillColor('#334155').text((i + 1) + ". " + s.name, 50, startY);
        doc.fontSize(10).fillColor('#64748b').text("Roll: " + s.rollNo, 220, startY);
        
        // Display timing details directly on Page 1
        let timingSummary = '';
        if (latestSession && latestSession.scans) {
          const scan = latestSession.scans.find(sc => sc.studentId.toString() === s._id.toString());
          if (scan) {
            const inTimeStr = scan.inTime ? new Date(scan.inTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--';
            const outTimeStr = scan.outTime ? new Date(scan.outTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : 'No Out';
            timingSummary = "[In: " + inTimeStr + " | Out: " + outTimeStr + "]";
          }
        }
        
        if (timingSummary) {
          doc.fontSize(9).fillColor('#64748b').text(timingSummary, 310, startY);
        }
        
        doc.fontSize(11).fillColor(color).text(s.attendancePercentage.toFixed(1) + "%", 450, startY, { align: 'right', width: 100 });
        
        doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke('#f1f5f9');
        doc.moveDown(0.5);
      });

      // --- PAGE 2: Daily Session Timings (For latest active/ended session) ---
      if (latestSession) {
        doc.addPage();
        
        doc.fontSize(20).fillColor('#1e1b4b').text('Daily Session Timing Log', { align: 'left' });
        doc.fontSize(12).fillColor('#64748b').text("Date: " + latestSession.date + " | Section: " + latestSession.section, { align: 'left' });
        doc.fontSize(9).fillColor('#94a3b8').text("Scan Cooldown Config: " + (latestSession.minGapHours || 1) + " Hour(s)");
        doc.moveDown(1.5);

        // Table Header
        const headerY = doc.y;
        doc.fontSize(10).fillColor('#1e1b4b').font('Helvetica-Bold');
        doc.text('Student Name (Roll)', 50, headerY);
        doc.text('Status', 220, headerY);
        doc.text('In-Time', 290, headerY);
        doc.text('Out-Time', 380, headerY);
        doc.text('Duration', 470, headerY);
        doc.font('Helvetica');
        
        doc.moveTo(50, headerY + 15).lineTo(550, headerY + 15).stroke('#cbd5e1');
        doc.moveDown(1.2);

        // Combine present and absent list
        const allStudentsInSession = [
          ...latestSession.presentStudents.map(sId => ({ studentId: sId.toString(), present: true })),
          ...latestSession.absentStudents.map(sId => ({ studentId: sId.toString(), present: false }))
        ];

        // Resolve student profiles from ID
        const resolvedList = [];
        allStudentsInSession.forEach(item => {
          const profile = students.find(s => s._id.toString() === item.studentId);
          if (profile) {
            resolvedList.push({ profile, present: item.present });
          }
        });

        // Sort alphabetically
        resolvedList.sort((a, b) => a.profile.name.localeCompare(b.profile.name));

        resolvedList.forEach((item) => {
          const s = item.profile;
          const isPresent = item.present;
          
          let inTimeStr = '--:--';
          let outTimeStr = '--:--';
          let durationStr = '--';
          
          const scan = latestSession.scans ? latestSession.scans.find(sc => sc.studentId.toString() === s._id.toString()) : null;
          
          if (scan) {
            if (scan.inTime) {
              inTimeStr = new Date(scan.inTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
            }
            if (scan.outTime) {
              outTimeStr = new Date(scan.outTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
              const durationMs = new Date(scan.outTime).getTime() - new Date(scan.inTime).getTime();
              const hours = durationMs / (1000 * 60 * 60);
              durationStr = hours.toFixed(2) + " hrs";
            } else {
              outTimeStr = 'No Out-Scan';
              durationStr = 'Incomplete';
            }
          } else if (isPresent) {
            inTimeStr = 'Manual';
            outTimeStr = 'Manual';
            durationStr = 'Override';
          }

          // Handle page break
          if (doc.y > 700) {
            doc.addPage();
            doc.fontSize(10).fillColor('#64748b').text("Daily Session Timing Log (" + latestSession.date + ") - Continued...", 50, 40);
            doc.moveTo(50, 55).lineTo(550, 55).stroke('#cbd5e1');
            doc.moveDown(2);
          }

          const rowY = doc.y;
          doc.fontSize(9).fillColor('#334155');
          doc.text(s.name + " (" + s.rollNo + ")", 50, rowY, { width: 160 });
          
          const statusColor = isPresent ? '#10b981' : '#ef4444';
          doc.fillColor(statusColor).font('Helvetica-Bold');
          doc.text(isPresent ? 'PRESENT' : 'ABSENT', 220, rowY);
          
          doc.fillColor('#475569').font('Helvetica');
          doc.text(inTimeStr, 290, rowY);
          doc.text(outTimeStr, 380, rowY);
          doc.text(durationStr, 470, rowY);
          
          doc.moveTo(50, rowY + 15).lineTo(550, rowY + 15).stroke('#f1f5f9');
          doc.moveDown(0.8);
        });
      }
      
      doc.end();
    } catch (err) {
      console.error('PDF Error:', err);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Mock SMS Service (Fast2SMS structure)
  const sendSMS = async (phone: string, message: string) => {
    console.log(`[SMS to ${phone}]: ${message}`);
    // Real implementation would use axios.post('https://www.fast2sms.com/dev/bulkV2', ...)
  };



  app.post("/api/notifications/bulk-email", authenticate, async (req, res) => {
    try {
      const { notifications } = req.body; 
      if (!Array.isArray(notifications)) return res.status(400).json({ error: "Invalid data" });

      // Return immediately and process in background to avoid client timeouts
      setImmediate(async () => {
        console.log(`[Notifications] Bulk dispatch for ${notifications.length} started...`);
        for (const note of notifications) {
          await sendEmail(note.email, note.subject, note.body);
          // 200ms delay between emails in bulk
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      });

      res.json({ message: "Background processing started" });
    } catch (err) {
      console.error('API Error /notifications/bulk-email:', err);
      res.status(500).json({ error: "Failed to send emails" });
    }
  });

  app.post("/api/attendance/end", authenticate, async (req, res) => {
    console.log("[Attendance] Finalizing session...");
    try {
      const session = await Attendance.findOne({ sessionStatus: 'active', schoolId: req.schoolId, section: req.section });
      
      if (session) {
        const sessionDate = session.date;
        session.sessionStatus = 'ended';

        // Cleanup: Any student with a valid scan (Check-In) is counted present
        if (session.scans && session.scans.length > 0) {
          const newPresentStudents = [];
          
          session.scans.forEach((scan) => {
            if (scan.inTime) {
              newPresentStudents.push(scan.studentId);
            }
          });
          
          // Preserve manual overrides (instructor forced present in admin dashboard)
          const scannedStudentIds = new Set(session.scans.map(sc => sc.studentId.toString()));
          session.presentStudents.forEach((studentId) => {
            if (!scannedStudentIds.has(studentId.toString())) {
              newPresentStudents.push(studentId);
            }
          });

          session.presentStudents = newPresentStudents;
        }
        
        const allStudents = await Student.find({ schoolId: req.schoolId, section: req.section });
        const presentIds = new Set(session.presentStudents.map(id => id.toString()));
        
        // Update absent list efficiently
        session.absentStudents = allStudents
          .filter(s => !presentIds.has(s._id.toString()))
          .map(s => s._id);
          
        await session.save();
        console.log(`[Attendance] Session ${sessionDate} ended. Counted ${session.presentStudents.length} present.`);
        
        // Update attendance percentages efficiently
        const allSessions = await Attendance.find({ sessionStatus: 'ended', schoolId: req.schoolId, section: req.section });
        const totalSessions = allSessions.length;
        
        // Build a map of studentId -> presenceCount
        const presenceMap: Record<string, number> = {};
        allSessions.forEach(sess => {
          sess.presentStudents.forEach((studentId: any) => {
            const idStr = studentId.toString();
            presenceMap[idStr] = (presenceMap[idStr] || 0) + 1;
          });
        });

        // Batch student updates using bulkWrite for efficiency
        const bulkOps = allStudents.map((student) => {
          const presentCount = presenceMap[student._id.toString()] || 0;
          const percentage = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;
          
          return {
            updateOne: {
              filter: { _id: student._id },
              update: { $set: { attendancePercentage: percentage } }
            }
          };
        });

        if (bulkOps.length > 0) {
          await Student.bulkWrite(bulkOps);
        }

        // Notify absentees (non-blocking SMS and Email)
        // We use setImmediate and a staggered approach to avoid rate limiting or socket closure
        setImmediate(async () => {
          console.log(`[Notifications] Starting background notification dispatch for ${allStudents.length} students...`);
          
          let index = 0;
          for (const student of allStudents) {
            const isPresent = presentIds.has(student._id.toString());
            if (!isPresent) {
              const currentCount = presenceMap[student._id.toString()] || 0;
              const currentPercentage = totalSessions > 0 ? (currentCount / totalSessions) * 100 : 0;
              
              // Add a small delay between every few emails to be extra safe
              if (index % 5 === 0 && index > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }

              // Send SMS (Fire and forget, internally logged)
              sendSMS(student.phone, `Your child ${student.name} (${student.rollNo}) was absent on ${sessionDate}. Attendance: ${currentPercentage.toFixed(1)}%`);
  
              // Send Email
              const emailBody = `Hello ${student.name},<br/><br/>
              You were marked absent today, ${sessionDate}.<br/>
              Your current attendance is ${currentPercentage.toFixed(1)}%. Please maintain regular attendance.`;
              
              sendEmail(
                student.email, 
                `Absence Notice: ${student.name} | ${sessionDate}`, 
                emailBody
              );
            }
            index++;
          }
        });
      }
      res.json({ message: "Session ended. Analytics update triggered." });
    } catch (err) {
      console.error('API Error /attendance/end:', err);
      res.status(500).json({ error: "Failed to end session" });
    }
  });

  app.post("/api/attendance/mark", authenticate, async (req, res) => {
    try {
      const { rollNo } = req.body;
      const today = new Date().toISOString().split('T')[0];
      const session = await Attendance.findOne({ date: today, sessionStatus: 'active', schoolId: req.schoolId, section: req.section });
      if (!session) return res.status(400).json({ error: "No active session" });

      const student = await Student.findOne({ rollNo, schoolId: req.schoolId, section: req.section });
      if (!student) return res.status(404).json({ error: "Student not found" });

      if (!session.scans) {
        (session as any).scans = [];
      }

      let scanRecord = session.scans.find(s => s.studentId.toString() === student._id.toString());
      const now = new Date();

      if (!scanRecord) {
        // First scan (Check-In)
        const isSingleScanMode = session.minGapHours <= 0.01;
        
        const newScan = {
          studentId: student._id,
          inTime: now,
          allScans: [now],
          outTime: undefined
        };
        
        if (isSingleScanMode) {
          newScan.outTime = now;
        }

        session.scans.push(newScan);

        // Always add to presentStudents immediately on Check-In so they show as present in real-time
        if (!session.presentStudents.some(id => id.toString() === student._id.toString())) {
          session.presentStudents.push(student._id);
        }
        session.absentStudents = session.absentStudents.filter(id => id.toString() !== student._id.toString());

        await session.save();

        if (isSingleScanMode) {
          return res.json({ 
            message: "Attendance marked successfully for " + student.name + " at " + now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + "! Marked PRESENT.", 
            type: "out", 
            student, 
            inTime: now,
            outTime: now
          });
        }

        // Strict Two-Scan rule: Do not mark as present yet. Keep them in absentStudents.
        return res.json({ 
          message: "Checked In successfully at " + now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + ". Check-Out required to be marked present.", 
          type: "in", 
          student, 
          inTime: now 
        });
      } else {
        // Subsequent scan (Check-Out)
        const lastScan = scanRecord.allScans[scanRecord.allScans.length - 1];
        const diffMs = now.getTime() - new Date(lastScan).getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const minGap = session.minGapHours || 1;

        if (diffHours < minGap) {
          const remainingMinutes = Math.ceil((minGap - diffHours) * 60);
          return res.status(400).json({ 
            error: "Already checked in recently. Cooldown active. Please wait " + remainingMinutes + " minute(s) to check out." 
          });
        }

        // Complete Check-Out
        scanRecord.outTime = now;
        scanRecord.allScans.push(now);

        // Move to presentStudents roster
        if (!session.presentStudents.some(id => id.toString() === student._id.toString())) {
          session.presentStudents.push(student._id);
        }
        session.absentStudents = session.absentStudents.filter(id => id.toString() !== student._id.toString());
        
        await session.save();
        return res.json({ 
          message: "Checked Out successfully at " + now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + "! Marked PRESENT.", 
          type: "out", 
          student, 
          inTime: scanRecord.inTime, 
          outTime: now 
        });
      }
    } catch (err) {
      console.error('API Error /attendance/mark:', err);
      res.status(500).json({ error: "Failed to mark attendance" });
    }
  });

  app.get("/api/analytics", authenticate, async (req, res) => {
    try {
      const students = await Student.find({ schoolId: req.schoolId, section: req.section });
      const sessions = await Attendance.find({ schoolId: req.schoolId, section: req.section }).sort({ date: 1 });
      
      const dailyData = sessions.map(s => {
        const isCurrentlyActive = s.sessionStatus === 'active';
        // For active sessions, calculate absentees relative to the CURRENT student count
        // For ended sessions, we trust the database snapshot taken at 'end'
        const present = s.presentStudents.length;
        const absent = isCurrentlyActive ? Math.max(0, students.length - present) : s.absentStudents.length;
        
        return {
          date: s.date,
          present,
          absent,
          status: s.sessionStatus
        };
      });

      res.json({
        totalStudents: students.length,
        lowAttendance: students.filter(s => s.attendancePercentage < 75),
        dailyData
      });
    } catch (err) {
      console.error('API Error /analytics:', err);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/models", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      res.json(response.data);
    } catch (err: any) {
      res.status(500).json({ error: err.response?.data || err.message });
    }
  });

  // API Key Rotation State
  let currentKeyIndex = 0;

  app.post("/api/chat", authenticate, async (req, res) => {
    console.log("Chat request received:", req.body.message);
    try {
      const { message, context } = req.body;
      
      const apiKeys = (process.env.GEMINI_API_KEY || "").split(',').map(k => k.trim()).filter(k => k);
      if (apiKeys.length === 0) {
        return res.status(500).json({ error: "Gemini API Key not configured" });
      }

      const prompt = `System Instruction: You are the neural interface for SmartAttend AI. Provide 100% accurate responses based on the provided context.\n\nCONTEXTUAL DATA:\n${context}\n\nUSER INQUIRY: ${message}`;

      // List of versions and models to try
      const versions = ["v1beta", "v1"];
      const modelNames = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-pro-latest"];
      let lastError = null;

      // Loop through available API keys (starting at current round-robin index)
      for (let i = 0; i < apiKeys.length; i++) {
        const keyIndexToTry = (currentKeyIndex + i) % apiKeys.length;
        const apiKey = apiKeys[keyIndexToTry];
        console.log(`[Attempt ${i+1}/${apiKeys.length}] Using API Key starting with: ${apiKey.substring(0, 8)}...`);

        for (const ver of versions) {
          for (const modelName of modelNames) {
            try {
              console.log(`  -> Attempting AI: ${ver} / ${modelName}`);
              const aiResponse = await axios.post(
                `https://generativelanguage.googleapis.com/${ver}/models/${modelName}:generateContent?key=${apiKey}`,
                { contents: [{ parts: [{ text: prompt }] }] },
                { timeout: 15000 }
              );

              if (aiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                console.log(`AI Success with: ${ver}/${modelName}`);
                // Advance the round-robin index for the next entirely new request
                currentKeyIndex = (keyIndexToTry + 1) % apiKeys.length;
                return res.json({ text: aiResponse.data.candidates[0].content.parts[0].text });
              }
            } catch (err: any) {
              lastError = err.response?.data || err.message;
              console.warn(`  -> Failed ${ver}/${modelName}:`, lastError?.error?.message || lastError);
            }
          }
        }
        console.log(`All models failed for API Key ${keyIndexToTry + 1}. Failing over to next key...`);
      }

      throw new Error(`All models failed across all API keys. Last error: ${JSON.stringify(lastError)}`);
    } catch (err: any) {
      console.error('FINAL AI ERROR:', err.message);
      res.status(500).json({ error: "The AI brain is currently initializing. Please try again in 1 minute." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Verify transporter after server is up
    if (SMTP_USER && SMTP_PASS) {
      transporter.verify((error) => {
        if (error) {
          console.error("[Email Dispatch] SMTP Verification Failed:", error.message);
        } else {
          console.log("[Email Dispatch] SMTP Server Connection Verified");
        }
      });
    }
  });
}

startServer();
