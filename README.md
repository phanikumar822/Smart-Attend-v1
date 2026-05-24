# SmartAttend.AI 🧠✨

**SmartAttend.AI** is a high-performance, biometric attendance management system built for educational institutions and corporate environments. It replaces traditional, manual registration with advanced facial recognition, liveness detection, and real-time institutional intelligence.

---

## 🚀 Key Features

### For Institutions (Admin Dashboard)
*   **Neural Intelligence Dashboard**: A command-and-control center with real-time analytics on attendance trends, roster integrity, and daily engagement graphs.
*   **Biometric Management**: Add and manage student records with digital facial signatures and historical attendance tracking.
*   **Session Control**: Initialize and terminate attendance sessions with a single click. Notifications (SMS) are automatically sent to absentees upon session closure.
*   **Neural Assistant (AI)**: An integrated Gemini-powered chatbot that provides deep insights into your data, identifies low-performance trends, and answers complex queries about your roster.
*   **Archived Records**: A historical vault of every attendance session ever conducted, including efficiency metrics and headcounts.
*   **PDF Reporting**: Generate professional, one-click attendance reports for documentation and auditing.

### For Students (Verification Portal)
*   **Vision Engine**: A front-facing biometric scanner that uses computer vision to detect and verify identity in milliseconds.
*   **Liveness Defense**: Advanced anti-spoofing technology that requires the user to perform a "Blink Test" to prevent photo-based fraud.
*   **Instant Feedback**: Clear, high-contrast visual confirmation of successful biometric synchronization.

---

## 🛠️ The Tech Stack

*   **Frontend**: React + Vite with **Tailwind CSS v4** for a cutting-edge "Neural" aesthetic.
*   **Animations**: **Motion** (f.k.a. Framer Motion) for fluid, physics-based transitions.
*   **Computer Vision**: **Face-api.js** for client-side facial detection and biometric feature extraction.
*   **AI Engine**: **Google Gemini (3.1 Flash Lite)** via `@google/genai` for intelligent data analysis.
*   **Backend**: **Express (Node.js)** handling session state, biometric storage, and PDF generation.
*   **Database**: **MongoDB** (via Mongoose) storing student signatures and attendance logs.
*   **Icons**: **Lucide React** for system-level iconography.

---

## 💻 How It Works

### Step 1: The Roster
Admin adds students to the registry. During registration, the system captures a "Neural Signature" (a mathematical descriptor of the student's face) which is securely stored in the database.

### Step 2: The Session
The instructor initializes a session from the Dashboard. This opens the "Vision Engine" on the Student Portal.

### Step 3: Verification
Students enter their Roll Number and look into the camera. The system first checks for **liveness** (asking them to blink) to ensure a real human is present. Once verified, it compares their live face to their stored "Neural Signature."

### Step 4: Logic & Logs
When the match is confirmed, attendance is marked in the database. Upon ending the session, the system calculates final percentages and generates alerts for students falling below the "75% Integrity Threshold."

---

## 🛠️ Setup & Installation

1.  **Environment Variables**: Create a `.env` file and add your `GEMINI_API_KEY`.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
4.  **Default Credentials**:
    *   **Admin Email**: `admin@test.com`
    *   **Password**: `admin123`

---

## 🎨 Design Philosophy
SmartAttend.AI follows a **"Formal-Futurist"** design language. It uses high-contrast typography, deep navy/black glassmorphism, and primary indigo accents with "outer-glow" effects to create an atmosphere of precision and technological authority.

---

*Built with ❤️ for the future of education.*
