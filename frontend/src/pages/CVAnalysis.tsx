import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { LoadingStates } from '../components/ui/LoadingStates';
import { Chip } from '../components/ui/Chip';
import { useCVAnalysis, useGenerateCVReport, useDownloadCV } from '../hooks/useCVQueries';

const CVAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const { candidateId } = useParams<{ candidateId: string }>();
  const { data: analysisData, isLoading, error } = useCVAnalysis(candidateId!);
  const generateReport = useGenerateCVReport();
  const downloadCV = useDownloadCV();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <LoadingStates.Skeleton />
      </div>
    );
  }

  if (error || !analysisData) {
    return (
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <p className="text-red-600">{t('cvAnalysis.failedToLoad')}</p>
        </div>
      </div>
    );
  }

  const { personalInfo, jobInfo, analysisResults, status, interviewStatus } = analysisData;
  const { qualified, qualificationScore, extractedData, aiNotes, matchingCriteria } = analysisResults;

  const handleGenerateReport = () => {
    generateReport.mutate(candidateId!);
  };

  const handleDownloadCV = () => {
    downloadCV.mutate(candidateId!);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <Link 
              to={`/jobs/${jobInfo.jobId}`} 
              className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 inline-block"
            >
              {t('cvAnalysis.backToJob', { jobTitle: jobInfo.title })}
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{personalInfo.name}</h1>
            <p className="text-gray-600 mt-1">{personalInfo.email}</p>
            {personalInfo.phone && (
              <p className="text-gray-600">{personalInfo.phone}</p>
            )}
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={handleDownloadCV}
              disabled={downloadCV.isPending}
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {downloadCV.isPending ? t('cvAnalysis.downloading') : t('cvAnalysis.downloadOriginalCV')}
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateReport}
              disabled={generateReport.isPending}
            >
              {generateReport.isPending ? t('cvAnalysis.generating') : t('cvAnalysis.generatePDFReport')}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Qualification Status */}
          <Card className="p-6">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4">
                {qualified ? (
                  <div className="text-6xl text-green-500">✅</div>
                ) : (
                  <div className="text-6xl text-red-500">❌</div>
                )}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {qualified ? t('cvAnalysis.candidateQualified') : t('cvAnalysis.candidateNotQualified')}
              </h2>
              <Chip
                variant={qualificationScore >= 70 ? 'success' : qualificationScore >= 50 ? 'warning' : 'error'}
                size="lg"
              >
                {t('cvAnalysis.score', { score: qualificationScore })}
              </Chip>
            </div>
          </Card>

          {/* AI Analysis Notes */}
          <Card className="p-6">
            <CardHeader>
              <CardTitle>{t('cvAnalysis.aiAnalysisSummary')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">{aiNotes}</p>
            </CardContent>
          </Card>

          {/* Matching Criteria */}
          {matchingCriteria && matchingCriteria.length > 0 && (
            <Card className="p-6">
              <CardHeader>
                <CardTitle>{t('cvAnalysis.jobRequirementsAnalysis')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {matchingCriteria.map((criterion, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {criterion.met ? (
                          <div className="text-green-500 text-xl">✓</div>
                        ) : (
                          <div className="text-red-500 text-xl">✗</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{criterion.criterion}</p>
                        {criterion.evidence && (
                          <p className="text-sm text-gray-600 mt-1">{criterion.evidence}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skills and Technologies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <CardHeader>
                <CardTitle>{t('cvAnalysis.extractedSkills')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {extractedData.skills.map((skill, index) => (
                    <Chip key={index} variant="default" size="sm">
                      {skill}
                    </Chip>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader>
                <CardTitle>{t('cvAnalysis.technologies')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {extractedData.technologies.map((tech, index) => (
                    <Chip key={index} variant="secondary" size="sm">
                      {tech}
                    </Chip>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Work Experience */}
          {extractedData.experience.positions && extractedData.experience.positions.length > 0 && (
            <Card className="p-6">
              <CardHeader>
                <CardTitle>{t('cvAnalysis.workExperience')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {extractedData.experience.positions.map((position, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <div className="mb-3">
                        <h4 className="text-lg font-semibold text-gray-900">{position.position}</h4>
                        <p className="text-blue-600 font-medium">{position.company}</p>
                        <p className="text-sm text-gray-600">{position.duration}</p>
                      </div>
                      
                      {position.technologies && position.technologies.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-600 mb-2">{t('cvAnalysis.technologies')}</p>
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
                          <p className="text-sm font-medium text-gray-600 mb-2">{t('cvAnalysis.keyResponsibilities')}</p>
                          <ul className="text-sm text-gray-700 space-y-1">
                            {position.responsibilities.slice(0, 5).map((responsibility, respIndex) => (
                              <li key={respIndex} className="flex items-start">
                                <span className="text-blue-500 mr-2 mt-1">•</span>
                                {responsibility}
                              </li>
                            ))}
                            {position.responsibilities.length > 5 && (
                              <li className="text-gray-500 italic text-xs">
                                {t('cvAnalysis.andMoreResponsibilities', { count: position.responsibilities.length - 5 })}
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {extractedData.experience.education && extractedData.experience.education.length > 0 && (
            <Card className="p-6">
              <CardHeader>
                <CardTitle>{t('cvAnalysis.educationBackground')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {extractedData.experience.education.map((edu, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-600">{t('cvAnalysis.degree')}</p>
                          <p className="text-gray-900 font-semibold">{edu.degree}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">{t('cvAnalysis.institution')}</p>
                          <p className="text-gray-900">{edu.institution}</p>
                        </div>
                        {edu.year && (
                          <div>
                            <p className="text-sm font-medium text-gray-600">{t('cvAnalysis.year')}</p>
                            <p className="text-gray-900">{edu.year}</p>
                          </div>
                        )}
                        {edu.grade && (
                          <div>
                            <p className="text-sm font-medium text-gray-600">{t('cvAnalysis.grade')}</p>
                            <p className="text-gray-900">{edu.grade}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Certifications */}
          {extractedData.certifications && extractedData.certifications.length > 0 && (
            <Card className="p-6">
              <CardHeader>
                <CardTitle>{t('cvAnalysis.certifications')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {extractedData.certifications.map((cert, index) => (
                    <Chip key={index} variant="success" size="sm">
                      {cert}
                    </Chip>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Information */}
          <Card className="p-6">
            <CardHeader>
              <CardTitle>{t('cvAnalysis.statusInformation')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('cvAnalysis.applicationStatus')}</span>
                  <span className={`font-semibold capitalize ${
                    status === 'qualified' ? 'text-green-600' :
                    status === 'rejected' ? 'text-red-600' :
                    status === 'invited' ? 'text-blue-600' :
                    status === 'interviewed' ? 'text-purple-600' :
                    'text-gray-600'
                  }`}>
                    {status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('cvAnalysis.interviewStatus')}</span>
                  <span className={`font-semibold capitalize ${
                    interviewStatus === 'completed' ? 'text-green-600' :
                    interviewStatus === 'invited' ? 'text-blue-600' :
                    interviewStatus === 'expired' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {interviewStatus.replace('-', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('cvAnalysis.score', { score: qualificationScore })}</span>
                  <span className="font-semibold">{qualificationScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('cvAnalysis.totalExperience')}</span>
                  <span className="font-semibold">
                    {t('cvUpload.totalYears', { years: extractedData.experience.totalYears })}
                  </span>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Job Information */}
          <Card className="p-6">
            <CardHeader>
              <CardTitle>{t('cvAnalysis.appliedPosition')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">{t('cvAnalysis.jobTitle')}</p>
                  <p className="font-semibold">{jobInfo.title}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('cvAnalysis.jobStatus')}</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    jobInfo.status === 'active' 
                      ? 'bg-green-100 text-green-800'
                      : jobInfo.status === 'inactive'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {jobInfo.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('cvAnalysis.description')}</p>
                  <p className="text-gray-700 text-sm">
                    {jobInfo.description.length > 150 
                      ? `${jobInfo.description.substring(0, 150)}...`
                      : jobInfo.description
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <CardHeader>
              <CardTitle>{t('cvAnalysis.quickActions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleDownloadCV}
                  disabled={downloadCV.isPending}
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {downloadCV.isPending ? t('cvAnalysis.downloading') : t('cvAnalysis.downloadOriginalCV')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleGenerateReport}
                  disabled={generateReport.isPending}
                >
                  {generateReport.isPending ? t('cvAnalysis.generating') : t('cvAnalysis.downloadPDFReport')}
                </Button>
                <Link to={`/jobs/${jobInfo.jobId}`} className="block">
                  <Button variant="outline" size="sm" className="w-full">
                    {t('cvAnalysis.viewAllCandidates')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CVAnalysis;