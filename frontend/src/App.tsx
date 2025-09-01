import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';

// Components
import Navbar from './components/Navbar';
import Home from './pages/Home';
import CVUpload from './pages/CVUpload';
import Interview from './pages/Interview';
import Dashboard from './pages/Dashboard';
import Results from './pages/Results';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex flex-col min-h-screen bg-gray-50">
          <Navbar />
          <main className="flex-grow pt-3">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/upload" element={<CVUpload />} />
              <Route path="/interview/:sessionId" element={<Interview />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/results/:sessionId" element={<Results />} />
            </Routes>
          </main>
        </div>
      </Router>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;