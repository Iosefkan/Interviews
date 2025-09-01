import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { useCVQueries } from '../hooks/useCVQueries';
import { type CVUploadResponse } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Alert, AlertDescription } from '../components/ui/Alert';
import { Chip } from '../components/ui/Chip';
import { Spinner } from '../components/ui/LoadingStates';
import { 
  CloudArrowUpIcon, 
  DocumentIcon, 
  CheckCircleIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';

const CVUpload: React.FC = () => {
  const navigate = useNavigate();
  const { uploadCV } = useCVQueries();
  const [activeStep, setActiveStep] = useState(0);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
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
    setError('');

    uploadCV.mutate(
      {
        cv: cvFile,
        jobTitle: jobTitle.trim(),
        jobDescription: jobDescription.trim(),
      },
      {
        onSuccess: (response) => {
          setResult(response);
          setActiveStep(3);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to analyze CV');
          setActiveStep(1); // Go back to job details step
        }
      }
    );
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
            <CardHeader>
              <CardTitle>Upload Candidate CV</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
                  ${
                    isDragActive
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-300 hover:border-primary-500 hover:bg-gray-50'
                  }
                `}
              >
                <input {...getInputProps()} />
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {cvFile ? cvFile.name : 'Drop CV file here or click to browse'}
                </h3>
                <p className="text-gray-500">
                  Supports PDF files up to 10MB
                </p>
              </div>
              {cvFile && (
                <div className="mt-4 flex items-center gap-2">
                  <DocumentIcon className="h-5 w-5 text-primary-500" />
                  <span className="text-gray-700">{cvFile.name}</span>
                  <Chip variant="primary" size="sm">PDF</Chip>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6">
                <Input
                  label="Job Title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., Senior Frontend Developer"
                  required
                />
                <Textarea
                  label="Job Description"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={8}
                  placeholder="Provide detailed job requirements, responsibilities, and qualifications..."
                  required
                />
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardContent className="text-center py-12">
              <Spinner size="lg" className="mx-auto mb-6 text-primary-500" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Analyzing CV with AI
              </h3>
              <p className="text-gray-500">
                Our AI is evaluating the candidate's qualifications against the job requirements...
              </p>
            </CardContent>
          </Card>
        );

      case 3:
        return result ? (
          <Card>
            <CardContent>
              <div className="text-center mb-6">
                {result.qualified ? (
                  <CheckCircleIcon className="mx-auto h-15 w-15 text-green-500 mb-4" />
                ) : (
                  <div className="mx-auto h-15 w-15 text-red-500 mb-4 text-6xl">❌</div>
                )}
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {result.qualified ? 'Candidate Qualified!' : 'Candidate Not Qualified'}
                </h2>
                <Chip
                  variant={result.qualificationScore >= 70 ? 'success' : result.qualificationScore >= 50 ? 'warning' : 'error'}
                  size="lg"
                >
                  Score: {result.qualificationScore}/100
                </Chip>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Extracted Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {result.extractedSkills.map((skill, index) => (
                      <Chip key={index} variant="default" size="sm">
                        {skill}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Experience
                  </h3>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>Total Years: {result.experience.totalYears}</p>
                    <p>Positions: {result.experience.positions.length}</p>
                    <p>Education: {result.experience.education.length} entries</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  AI Analysis Notes
                </h3>
                <p className="text-gray-700">
                  {result.aiNotes}
                </p>
              </div>

              {result.qualified && (
                <div className="text-center">
                  <Button
                    size="lg"
                    onClick={handleStartInterview}
                    className="px-8"
                  >
                    <BrainIcon className="mr-2 h-5 w-5" />
                    Start AI Interview
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="py-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          CV Upload & Analysis
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Upload a candidate's CV to get AI-powered qualification assessment
        </p>

        {/* Stepper */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${
                  index <= activeStep
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }
              `}>
                {index + 1}
              </div>
              <span className={`ml-2 text-sm font-medium ${
                index <= activeStep ? 'text-primary-600' : 'text-gray-500'
              }`}>
                {label}
              </span>
              {index < steps.length - 1 && (
                <div className={`ml-4 w-12 h-0.5 ${
                  index < activeStep ? 'bg-primary-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <Alert variant="error" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {renderStepContent(activeStep)}

        {activeStep < 2 && (
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={activeStep === 0}
            >
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={uploadCV.isPending}
              loading={uploadCV.isPending}
            >
              {activeStep === 1 ? 'Analyze CV' : 'Next'}
            </Button>
          </div>
        )}

        {activeStep === 3 && result && !result.qualified && (
          <div className="text-center mt-6">
            <Button
              variant="outline"
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
          </div>
        )}
      </div>
    </div>
  );
};

export default CVUpload;