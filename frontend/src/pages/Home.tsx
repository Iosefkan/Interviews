import React from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Psychology,
  Assessment,
  PictureAsPdf,
  CheckCircle,
  Speed,
  SmartToy,
} from '@mui/icons-material';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Upload />,
      title: 'CV Upload & Analysis',
      description: 'Upload candidate CVs and get AI-powered qualification assessment',
    },
    {
      icon: <Psychology />,
      title: 'AI Interviews',
      description: 'Conduct interactive interviews with voice-to-voice AI communication',
    },
    {
      icon: <Assessment />,
      title: 'Skills Verification',
      description: 'Verify technical and soft skills through dynamic questioning',
    },
    {
      icon: <PictureAsPdf />,
      title: 'PDF Reports',
      description: 'Generate comprehensive interview reports with detailed assessments',
    },
  ];

  const benefits = [
    'AI-powered CV qualification assessment',
    'Real-time voice-to-voice interviews',
    'Skills verification and evaluation',
    'Automated report generation',
    'Comprehensive candidate scoring',
    'Streamlined recruitment process',
  ];

  return (
    <Container maxWidth="lg">
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
          AI CV Screening & Interview System
        </Typography>
        <Typography variant="h5" component="h2" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
          Revolutionize your recruitment process with AI-powered CV analysis and interactive interviews
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/upload')}
            startIcon={<Upload />}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
          >
            Upload CV
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/dashboard')}
            startIcon={<Assessment />}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
          >
            View Dashboard
          </Button>
        </Box>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 6 }}>
        <Typography variant="h4" component="h2" textAlign="center" gutterBottom sx={{ mb: 4 }}>
          Key Features
        </Typography>
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ color: 'primary.main', mr: 2 }}>
                      {feature.icon}
                    </Box>
                    <Typography variant="h6" component="h3">
                      {feature.title}
                    </Typography>
                  </Box>
                  <Typography color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Benefits Section */}
      <Box sx={{ py: 6 }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h4" component="h2" gutterBottom>
              Why Choose Our System?
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Our AI-powered recruitment system streamlines the entire hiring process from CV screening 
              to final interview assessment, saving you time and ensuring consistent, unbiased evaluations.
            </Typography>
            <List>
              {benefits.map((benefit, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemIcon>
                    <CheckCircle color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={benefit} />
                </ListItem>
              ))}
            </List>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 4, textAlign: 'center', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
              <SmartToy sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" component="h3" gutterBottom>
                Powered by Advanced AI
              </Typography>
              <Typography color="text.secondary" paragraph>
                Utilizing OpenRouter AI models, XTTSv2 for speech synthesis, and OpenAI Whisper for 
                speech recognition to deliver the most accurate and natural interview experience.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 3 }}>
                <Box>
                  <Speed sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Typography variant="body2" sx={{ mt: 1 }}>Fast Processing</Typography>
                </Box>
                <Box>
                  <Assessment sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Typography variant="body2" sx={{ mt: 1 }}>Accurate Assessment</Typography>
                </Box>
                <Box>
                  <Psychology sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Typography variant="body2" sx={{ mt: 1 }}>AI Intelligence</Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* CTA Section */}
      <Box sx={{ py: 6, textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: 2, my: 4 }}>
        <Typography variant="h4" component="h2" gutterBottom>
          Ready to Transform Your Recruitment?
        </Typography>
        <Typography variant="h6" component="p" sx={{ mb: 3, opacity: 0.9 }}>
          Start screening candidates with AI-powered interviews today
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/upload')}
          sx={{ 
            backgroundColor: 'white', 
            color: 'primary.main', 
            px: 4, 
            py: 1.5,
            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.9)' }
          }}
        >
          Get Started Now
        </Button>
      </Box>
    </Container>
  );
};

export default Home;