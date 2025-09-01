import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { useCVQueries } from '../hooks/useCVQueries';
import { useJob } from '../hooks/useJobQueries';
import { type CVUploadResponse } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Alert, AlertDescription } from '../components/ui/Alert';
import { Chip } from '../components/ui/Chip';
import { Spinner } from '../components/ui/LoadingStates';
import { 
  CloudArrowUpIcon, 
  DocumentIcon, 
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const CVUpload: React.FC = () => {
  const { t } = useTranslation();
  const { jobId } = useParams<{ jobId: string }>();
  const { uploadCV } = useCVQueries();
  const { data: job, isLoading: isLoadingJob } = useJob(jobId!);
  const [activeStep, setActiveStep] = useState(0);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CVUploadResponse | null>(null);

  const steps = [
    t('cvUpload.steps.uploadCV'),
    t('cvUpload.steps.aiAnalysis'),
    t('cvUpload.steps.results')
  ];

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
      setError(t('cvUpload.pleaseUploadValidPDF'));
    },
  });

  const handleNext = () => {
    if (activeStep === 0 && !cvFile) {
      setError(t('cvUpload.pleaseUploadCV'));
      return;
    }
    
    setError('');
    if (activeStep === 0) {
      handleAnalyze();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleAnalyze = async () => {
    if (!cvFile || !jobId) return;

    setActiveStep(1);
    setError('');

    uploadCV.mutate(
      {
        cv: cvFile,
        jobId: jobId,
      },
      {
        onSuccess: (response) => {
          setResult(response);
          setActiveStep(2);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : t('cvUpload.failedToAnalyzeCV'));
          setActiveStep(0); // Go back to upload step
        }
      }
    );
  };

  if (isLoadingJob) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">{t('cvUpload.loadingJobDetails')}</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-600">{t('cvUpload.jobNotFound')}</p>
        </div>
      </div>
    );
  }

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Card>
            <CardHeader>
              <CardTitle>{t('cvUpload.uploadCandidate', { jobTitle: job.title })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">{t('jobDetails.jobTitle')}: {job.title}</h3>
                <p className="text-blue-700 text-sm">
                  {job.description.length > 200 
                    ? `${job.description.substring(0, 200)}...`
                    : job.description
                  }
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {job.requiredSkills.slice(0, 5).map((skill, index) => (
                    <Chip key={index} variant="secondary" size="sm">
                      {skill}
                    </Chip>
                  ))}
                  {job.requiredSkills.length > 5 && (
                    <Chip variant="secondary" size="sm">
                      +{job.requiredSkills.length - 5} {t('cvUpload.andMore')}
                    </Chip>
                  )}
                </div>
              </div>
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
                  {cvFile ? cvFile.name : t('cvUpload.dropFileHere')}
                </h3>
                <p className="text-gray-500">
                  {t('cvUpload.supportsFiles')}
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
            <CardContent className="text-center py-12">
              <Spinner size="lg" className="mx-auto mb-6 text-primary-500" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t('cvUpload.analyzing')}
              </h3>
              <p className="text-gray-500">
                {t('cvUpload.analyzingDescription')}
              </p>
            </CardContent>
          </Card>
        );

      case 2:
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
                  {result.qualified ? t('cvUpload.qualified') : t('cvUpload.notQualified')}
                </h2>
                <Chip
                  variant={result.qualificationScore >= 70 ? 'success' : result.qualificationScore >= 50 ? 'warning' : 'error'}
                  size="lg"
                >
                  {t('cvUpload.score', { score: result.qualificationScore })}
                </Chip>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    {t('cvUpload.extractedSkills')}
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
                    {t('cvUpload.experienceSummary')}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>{t('cvUpload.totalYears', { years: result.experience.totalYears })}</p>
                    <p>{t('cvUpload.positions', { count: result.experience.positions.length })}</p>
                    <p>{t('cvUpload.education', { count: result.experience.education.length })}</p>
                  </div>
                </div>
              </div>
              
              {/* Work Experience Details */}
              {result.experience.positions && result.experience.positions.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {t('cvUpload.workExperience')}
                  </h3>
                  <div className="space-y-4">
                    {result.experience.positions.map((position, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border border-green-100">
                        <div className="mb-3">
                          <h4 className="text-lg font-semibold text-gray-900">{position.position}</h4>
                          <p className="text-primary-600 font-medium">{position.company}</p>
                          <p className="text-sm text-gray-600">{position.duration}</p>
                        </div>
                        
                        {position.technologies && position.technologies.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-600 mb-2">{t('cvUpload.technologies')}</p>
                            <div className="flex flex-wrap gap-1">
                              {position.technologies.map((tech, techIndex) => (
                                <Chip key={techIndex} variant="secondary" size="sm">
                                  {tech}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {position.responsibilities && position.responsibilities.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-2">{t('cvUpload.keyResponsibilities')}</p>
                            <ul className="text-sm text-gray-700 space-y-1">
                              {position.responsibilities.slice(0, 3).map((responsibility, respIndex) => (
                                <li key={respIndex} className="flex items-start">
                                  <span className="text-green-500 mr-2 mt-1">•</span>
                                  {responsibility}
                                </li>
                              ))}
                              {position.responsibilities.length > 3 && (
                                <li className="text-gray-500 italic text-xs">
                                  {t('cvUpload.andMore', { count: position.responsibilities.length - 3 })}
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education Details */}
              {result.experience.education && result.experience.education.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {t('cvUpload.educationBackground')}
                  </h3>
                  <div className="space-y-4">
                    {result.experience.education.map((edu, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border border-blue-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-600">{t('cvUpload.degree')}</p>
                            <p className="text-gray-900 font-semibold">{edu.degree}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">{t('cvUpload.institution')}</p>
                            <p className="text-gray-900">{edu.institution}</p>
                          </div>
                          {edu.year && (
                            <div>
                              <p className="text-sm font-medium text-gray-600">{t('cvUpload.year')}</p>
                              <p className="text-gray-900">{edu.year}</p>
                            </div>
                          )}
                          {edu.grade && (
                            <div>
                              <p className="text-sm font-medium text-gray-600">{t('cvUpload.grade')}</p>
                              <p className="text-gray-900">{edu.grade}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {t('cvUpload.aiAnalysisNotes')}
                </h3>
                <p className="text-gray-700">
                  {result.aiNotes}
                </p>
              </div>

              {result.qualified && (
                <div className="text-center">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-green-800 mb-2">
                      {t('cvUpload.candidateQualifiedForInterview')}
                    </h3>
                    <p className="text-green-700 text-sm mb-4">
                      {t('cvUpload.candidateQualifiedDescription')}
                    </p>
                    <p className="text-green-600 text-xs">
                      <strong>{t('cvUpload.nextStep')}</strong> {t('cvUpload.nextStepDescription')}
                    </p>
                  </div>
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
          {t('cvUpload.title')}
        </h1>
        <p className="text-gray-600 text-center mb-8">
          {t('cvUpload.subtitle')}
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

        {activeStep < 1 && (
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={activeStep === 0}
            >
              {t('cvUpload.backButton')}
            </Button>
            <Button
              onClick={handleNext}
              disabled={uploadCV.isPending}
              loading={uploadCV.isPending}
            >
              {t('cvUpload.analyzeCV')}
            </Button>
          </div>
        )}

        {activeStep === 2 && result && !result.qualified && (
          <div className="text-center mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setActiveStep(0);
                setCvFile(null);
                setResult(null);
                setError('');
              }}
            >
              {t('cvUpload.uploadAnotherCV')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CVUpload;