import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadingStates } from '../components/ui/LoadingStates';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useJob, useJobCandidates, useJobStatistics } from '../hooks/useJobQueries';
import { useInviteCandidate } from '../hooks/useInterviewQueries';
import { useDeleteCandidate, useDownloadCV } from '../hooks/useCVQueries';

const JobDetails: React.FC = () => {
  const { t } = useTranslation();
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job, isLoading: isLoadingJob } = useJob(jobId!);
  const { data: candidatesData, isLoading: isLoadingCandidates } = useJobCandidates(jobId!);
  const { data: statsData } = useJobStatistics(jobId!);
  const inviteCandidate = useInviteCandidate();
  const deleteCandidate = useDeleteCandidate();
  const downloadCV = useDownloadCV();
  
  // State for delete confirmation
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);

  if (isLoadingJob) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <LoadingStates.Skeleton />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <p className="text-red-600">{t('jobDetails.jobNotFound')}</p>
        </div>
      </div>
    );
  }

  const candidates = candidatesData?.candidates || [];
  const stats = statsData?.statistics ? 
    (statsData.statistics.basic || statsData.statistics) :
    job.statistics;

  // Ensure we have the right structure for stats access
  const safeStats = {
    totalCandidates: stats.totalCandidates || 0,
    qualifiedCandidates: stats.qualifiedCandidates || 0,
    completedInterviews: stats.completedInterviews || 0,
    averageScore: stats.averageScore || 0
  };

  const handleInviteCandidate = async (candidateId: string) => {
    try {
      await inviteCandidate.mutateAsync(candidateId);
    } catch (error) {
      console.error('Failed to invite candidate:', error);
    }
  };

  const handleDownloadCV = async (candidateId: string) => {
    try {
      await downloadCV.mutateAsync(candidateId);
    } catch (error) {
      console.error('Failed to download CV:', error);
    }
  };

  const handleDeleteClick = (candidateId: string, candidateName: string) => {
    setCandidateToDelete({ id: candidateId, name: candidateName });
    setDeleteCandidateId(candidateId);
  };
  
  const handleDeleteConfirm = async () => {
    if (deleteCandidateId) {
      try {
        await deleteCandidate.mutateAsync(deleteCandidateId);
        setDeleteCandidateId(null);
        setCandidateToDelete(null);
      } catch (error) {
        console.error('Failed to delete candidate:', error);
      }
    }
  };
  
  const handleDeleteCancel = () => {
    setDeleteCandidateId(null);
    setCandidateToDelete(null);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/jobs" className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 inline-block">
              {t('jobDetails.backToJobs')}
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
            <div className="flex items-center space-x-4 mt-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                job.status === 'active' 
                  ? 'bg-green-100 text-green-800'
                  : job.status === 'inactive'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {t(`jobs.status.${job.status}`)}
              </span>
            </div>
          </div>
          <div className="flex space-x-3">
            <Link to={`/jobs/${jobId}/upload-cv`}>
              <Button variant="primary">
                {t('jobDetails.uploadCV')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Job Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Description */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('jobDetails.jobDescription')}</h2>
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
            </div>
          </Card>

          {/* Required Skills */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('jobDetails.requiredSkills')}</h2>
            <div className="flex flex-wrap gap-2">
              {job.requiredSkills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {skill}
                </span>
              ))}
            </div>
          </Card>

          {/* Candidates List */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('jobDetails.candidates')}</h2>
              <span className="text-sm text-gray-500">{t('jobDetails.totalCandidates', { count: candidates.length })}</span>
            </div>
            
            {isLoadingCandidates ? (
              <LoadingStates.Spinner />
            ) : candidates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>{t('jobDetails.noCandidatesYet')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {candidates.map((candidate) => (
                  <div key={candidate._id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {candidate.personalInfo.name}
                        </h3>
                        <p className="text-sm text-gray-500">{candidate.personalInfo.email}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            candidate.status === 'qualified'
                              ? 'bg-green-100 text-green-800'
                              : candidate.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : candidate.status === 'invited'
                              ? 'bg-blue-100 text-blue-800'
                              : candidate.status === 'interviewed'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {t(`cvAnalysis.status.${candidate.status}`)}
                          </span>
                          {candidate.analysis && (
                            <span className="text-xs text-gray-500">
                              {t('cvUpload.score', { score: candidate.analysis.qualificationScore })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {candidate.status === 'qualified' && !candidate.interviewInvitation?.sent && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleInviteCandidate(candidate._id)}
                            disabled={inviteCandidate.isPending}
                          >
                            {t('jobDetails.sendInvitation')}
                          </Button>
                        )}
                        {candidate.status === 'interviewed' && candidate.interviewSessions && candidate.interviewSessions.length > 0 && (
                          <Link to={`/results/${candidate.interviewSessions[candidate.interviewSessions.length - 1]}`}>
                            <Button variant="outline" size="sm">
                              {t('jobDetails.viewResults')}
                            </Button>
                          </Link>
                        )}
                        <Link to={`/cv/analysis/${candidate._id}`}>
                          <Button variant="outline" size="sm">
                            {t('jobDetails.viewCV')}
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadCV(candidate._id)}
                          disabled={downloadCV.isPending}
                        >
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {downloadCV.isPending ? t('jobDetails.downloading') : t('jobDetails.downloadCV')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(candidate._id, candidate.personalInfo.name)}
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                          disabled={deleteCandidate.isPending}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Statistics Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('jobDetails.statistics')}</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('jobDetails.totalCandidatesLabel')}</span>
                <span className="font-semibold">{safeStats.totalCandidates}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('jobDetails.qualifiedLabel')}</span>
                <span className="font-semibold text-green-600">{safeStats.qualifiedCandidates}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('jobDetails.interviewsCompletedLabel')}</span>
                <span className="font-semibold text-blue-600">{safeStats.completedInterviews}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('jobDetails.averageScore')}</span>
                <span className="font-semibold">
                  {safeStats.averageScore ? `${Math.round(safeStats.averageScore)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </Card>

          {/* Job Details */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('jobDetails.jobDetails')}</h2>
            <div className="space-y-3">
              {job.experience && (
                <div>
                  <span className="text-sm text-gray-500">{t('jobDetails.experience')}</span>
                  <p className="font-medium">{job.formattedExperienceRange}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-500">{t('jobDetails.created')}</span>
                <p className="font-medium">
                  {new Date(job.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
      
      {/* Delete Candidate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteCandidateId}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t('jobDetails.deleteCandidate')}
        message={candidateToDelete ? t('jobDetails.deleteCandidateConfirm', { name: candidateToDelete.name }) : ''}
        confirmText={t('jobDetails.deleteCandidate')}
        cancelText={t('confirmDialog.cancel')}
        variant="danger"
        isLoading={deleteCandidate.isPending}
      />
    </div>
  );
};

export default JobDetails;