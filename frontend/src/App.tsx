import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';

// Components
import Navbar from './components/Navbar';
import Home from './pages/Home';
import CVUpload from './pages/CVUpload';
import Interview from './pages/Interview';
import Dashboard from './pages/Dashboard';
import Results from './pages/Results';

const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar />
          <Box component="main" sx={{ flexGrow: 1, pt: 3 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/upload" element={<CVUpload />} />
              <Route path="/interview/:sessionId" element={<Interview />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/results/:sessionId" element={<Results />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;