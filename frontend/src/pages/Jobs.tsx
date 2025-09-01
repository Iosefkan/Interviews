import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadingStates } from '../components/ui/LoadingStates';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useJobs, useDeleteJob } from '../hooks/useJobQueries';

const Jobs: React.FC = () => {
  const { t } = useTranslation();
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<{ id: string; title: string } | null>(null);
  
  const { data: jobsData, isLoading, error } = useJobs({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  
  const deleteJobMutation = useDeleteJob();

  const jobs = jobsData?.jobs || [];
  
  const handleDeleteClick = (jobId: string, jobTitle: string) => {
    setJobToDelete({ id: jobId, title: jobTitle });
    setDeleteJobId(jobId);
  };
  
  const handleDeleteConfirm = async () => {
    if (deleteJobId) {
      await deleteJobMutation.mutateAsync(deleteJobId);
      setDeleteJobId(null);
      setJobToDelete(null);
    }
  };
  
  const handleDeleteCancel = () => {
    setDeleteJobId(null);
    setJobToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <LoadingStates.Skeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <p className="text-red-600">{t('jobs.failedToLoad')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('jobs.title')}</h1>
          <p className="mt-2 text-gray-600">
            {t('jobs.subtitle')}
          </p>
        </div>
        <Link to="/jobs/create">
          <Button variant="primary">
            {t('jobs.createNewJob')}
          </Button>
        </Link>
      </div>

      {/* Jobs Grid */}
      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 mb-4">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 8v6a2 2 0 002 2h4a2 2 0 002-2V8M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('jobs.noJobsYet')}</h3>
          <p className="text-gray-500 mb-6">{t('jobs.noJobsDescription')}</p>
          <Link to="/jobs/create">
            <Button variant="primary">
              {t('jobs.createFirstJob')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <Card key={job._id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {job.title}
                  </h3>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
              </div>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {job.description.length > 100 
                  ? `${job.description.substring(0, 100)}...`
                  : job.description
                }
              </p>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('jobs.candidates')}</span>
                  <span className="font-medium">{job.statistics.totalCandidates}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('jobs.qualified')}</span>
                  <span className="font-medium text-green-600">{job.statistics.qualifiedCandidates}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('jobs.interviews')}</span>
                  <span className="font-medium text-blue-600">{job.statistics.completedInterviews}</span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Link to={`/jobs/${job._id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    {t('jobs.viewDetails')}
                  </Button>
                </Link>
                <Link to={`/jobs/${job._id}/upload-cv`}>
                  <Button variant="primary" size="sm">
                    {t('jobs.addCV')}
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDeleteClick(job._id, job.title)}
                  className="text-red-600 hover:text-red-700 hover:border-red-300"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteJobId}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t('jobs.deleteJob')}
        message={jobToDelete ? t('jobs.deleteJobConfirm', { title: jobToDelete.title }) : ''}
        confirmText={t('jobs.deleteJob')}
        cancelText={t('confirmDialog.cancel')}
        variant="danger"
        isLoading={deleteJobMutation.isPending}
      />
    </div>
  );
};

export default Jobs;