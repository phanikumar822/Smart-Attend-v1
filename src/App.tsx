import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentPortal from './pages/StudentPortal';
import AdminDashboard from './pages/AdminDashboard';
import Presentation from './pages/Presentation';
import FounderLogin from './pages/FounderLogin';
import FounderDashboard from './pages/FounderDashboard';
import Navbar from './components/Navbar';
import { Toaster } from './components/ui/sonner';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('adminToken'));
  const [isFounderAuthenticated, setIsFounderAuthenticated] = useState(!!localStorage.getItem('founderToken'));

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('adminToken'));
      setIsFounderAuthenticated(!!localStorage.getItem('founderToken'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-background font-sans transition-colors duration-500">
        <Navbar isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} />
        <main className="container mx-auto px-4 py-12">
          <Routes>
            <Route 
              path="/" 
              element={
                isFounderAuthenticated ? <Navigate to="/founder-dashboard" /> :
                isAuthenticated ? <Navigate to="/admin" /> :
                <Navigate to="/login" />
              } 
            />
            <Route path="/student" element={<StudentPortal />} />
            <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/presentation" element={<Presentation />} />
            
            {/* Private Founder Console */}
            <Route 
              path="/founder-console" 
              element={<FounderLogin setIsFounderAuthenticated={setIsFounderAuthenticated} />} 
            />
            <Route 
              path="/founder-dashboard/*" 
              element={isFounderAuthenticated ? <FounderDashboard setIsFounderAuthenticated={setIsFounderAuthenticated} /> : <Navigate to="/founder-console" />} 
            />

            <Route 
              path="/admin/*" 
              element={isAuthenticated ? <AdminDashboard /> : <Navigate to="/login" />} 
            />
          </Routes>
        </main>
        <Toaster />
      </div>
    </Router>
  );
}
