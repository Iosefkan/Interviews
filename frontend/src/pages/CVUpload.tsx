import React, { useState } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Chip,
  Grid,
  Paper,
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, Description, CheckCircle, Psychology } from '@mui/icons-material';
import { CVService } from '../services/hrService';
import { CVUploadResponse } from '../types';
import { useNavigate } from 'react-router-dom';

const CVUpload: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CVUploadResponse | null>(null);

  const steps = ['Upload CV', 'Job Details', 'AI Analysis', 'Results'];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setCvFile(acceptedFiles[0]);
        setError('');
      }
    },
    onDropRejected: () => {
      setError('Please upload a valid PDF file');
    },
  });

  const handleNext = () => {
    if (activeStep === 0 && !cvFile) {
      setError('Please upload a CV file');
      return;
    }
    if (activeStep === 1 && (!jobTitle.trim() || !jobDescription.trim())) {
      setError('Please fill in all job details');
      return;
    }
    
    setError('');
    if (activeStep === 1) {
      handleAnalyze();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleAnalyze = async () => {
    if (!cvFile) return;

    setActiveStep(2);
    setLoading(true);
    setError('');

    try {
      const response = await CVService.uploadCV({
        cv: cvFile,
        jobTitle: jobTitle.trim(),
        jobDescription: jobDescription.trim(),
      });

      setResult(response);
      setActiveStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze CV');
      setActiveStep(1); // Go back to job details step
    } finally {
      setLoading(false);
    }
  };

  const handleStartInterview = () => {
    if (result?.candidateId) {
      navigate(`/interview/${result.candidateId}`);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Upload Candidate CV
              </Typography>
              <Box
                {...getRootProps()}
                sx={{
                  border: '2px dashed',
                  borderColor: isDragActive ? 'primary.main' : 'grey.300',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <input {...getInputProps()} />
                <CloudUpload sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {cvFile ? cvFile.name : 'Drop CV file here or click to browse'}
                </Typography>
                <Typography color="text.secondary">
                  Supports PDF files up to 10MB
                </Typography>
              </Box>
              {cvFile && (
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Description color="primary" />
                  <Typography>{cvFile.name}</Typography>
                  <Chip label="PDF" size="small" color="primary" />
                </Box>
              )}
            </CardContent>
          </Card>
        );

      case 1:
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Job Details
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Job Title"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g., Senior Frontend Developer"
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Job Description"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    multiline
                    rows={8}
                    placeholder="Provide detailed job requirements, responsibilities, and qualifications..."
                    required
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h6" gutterBottom>
                Analyzing CV with AI
              </Typography>
              <Typography color="text.secondary">
                Our AI is evaluating the candidate's qualifications against the job requirements...
              </Typography>
            </CardContent>
          </Card>
        );

      case 3:
        return result ? (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                {result.qualified ? (
                  <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                ) : (
                  <Box sx={{ fontSize: 60, color: 'error.main', mb: 2 }}>❌</Box>
                )}
                <Typography variant="h5" gutterBottom>
                  {result.qualified ? 'Candidate Qualified!' : 'Candidate Not Qualified'}
                </Typography>
                <Chip
                  label={`Score: ${result.qualificationScore}/100`}
                  color={result.qualificationScore >= 70 ? 'success' : result.qualificationScore >= 50 ? 'warning' : 'error'}
                  size="large"
                />
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Extracted Skills
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {result.extractedSkills.map((skill, index) => (
                        <Chip key={index} label={skill} variant="outlined" />
                      ))}
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Experience
                    </Typography>
                    <Typography>
                      Total Years: {result.experience.totalYears}
                    </Typography>
                    <Typography>
                      Positions: {result.experience.positions.length}
                    </Typography>
                    <Typography>
                      Education: {result.experience.education.length} entries
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      AI Analysis Notes
                    </Typography>
                    <Typography color="text.secondary">
                      {result.aiNotes}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {result.qualified && (
                <Box sx={{ textAlign: 'center', mt: 3 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleStartInterview}
                    startIcon={<Psychology />}
                    sx={{ px: 4 }}
                  >
                    Start AI Interview
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom textAlign="center">
          CV Upload & Analysis
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
          Upload a candidate's CV to get AI-powered qualification assessment
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {renderStepContent(activeStep)}

        {activeStep < 2 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              onClick={handleBack}
              disabled={activeStep === 0}
              variant="outlined"
            >
              Back
            </Button>
            <Button
              onClick={handleNext}
              variant="contained"
              disabled={loading}
            >
              {activeStep === 1 ? 'Analyze CV' : 'Next'}
            </Button>
          </Box>
        )}

        {activeStep === 3 && result && !result.qualified && (
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setActiveStep(0);
                setCvFile(null);
                setJobTitle('');
                setJobDescription('');
                setResult(null);
                setError('');
              }}
            >
              Upload Another CV
            </Button>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default CVUpload;