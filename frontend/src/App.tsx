import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './lib/queryClient';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Route Protection Components
import { ProtectedRoute, PublicRoute, InterviewRoute } from './components/auth/RouteProtection';

// Components
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import CVUpload from './pages/CVUpload';
import Results from './pages/Results';
import CVAnalysis from './pages/CVAnalysis';

// New Pages (placeholders for now)
import Jobs from './pages/Jobs';
import JobDetails from './pages/JobDetails';
import CreateJob from './pages/CreateJob';
import InterviewStart from './pages/InterviewStart';
import ThankYouPage from './pages/ThankYouPage';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
        <Router>
          <div className="flex flex-col min-h-screen bg-gray-50">
            <Routes>
              {/* Public Routes */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              
              {/* Interview Routes (Public Access) */}
              <Route 
                path="/interview/start" 
                element={
                  <InterviewRoute>
                    <InterviewStart />
                  </InterviewRoute>
                } 
              />
              
              <Route 
                path="/interview/thank-you/:sessionId" 
                element={
                  <InterviewRoute>
                    <ThankYouPage />
                  </InterviewRoute>
                } 
              />
              
              {/* Protected Routes (HR Authentication Required) */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <div className="min-h-screen">
                    <Navbar />
                    <main className="pt-16">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/home" element={<Dashboard />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/jobs" element={<Jobs />} />
                        <Route path="/jobs/create" element={<CreateJob />} />
                        <Route path="/jobs/:jobId" element={<JobDetails />} />
                        <Route path="/jobs/:jobId/upload-cv" element={<CVUpload />} />
                        <Route path="/cv/analysis/:candidateId" element={<CVAnalysis />} />
                        <Route path="/results/:sessionId" element={<Results />} />
                        <Route path="/settings" element={<Settings />} />
                      </Routes>
                    </main>
                  </div>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
          
          {/* Toast Notifications */}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10B981',
                },
              },
              error: {
                style: {
                  background: '#EF4444',
                },
              },
            }}
          />
        </Router>
        </AuthProvider>
      </LanguageProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;