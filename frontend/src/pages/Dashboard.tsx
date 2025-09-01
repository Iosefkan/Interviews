import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCVQueries } from '../hooks/useCVQueries';
import { useInterviewQueries } from '../hooks/useInterviewQueries';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { TableSkeleton } from '../components/ui/LoadingStates';
import { Alert, AlertDescription } from '../components/ui/Alert';
import type { Candidate, InterviewSession } from '../types';
import { 
  UserGroupIcon, 
  MicrophoneIcon, 
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { useCandidates } = useCVQueries();
  const { useInterviewSessions } = useInterviewQueries();
  
  const candidatesQuery = useCandidates({ limit: 10 });
  const interviewsQuery = useInterviewSessions({ limit: 10 });

  const statsData = [
    {
      title: t('dashboard.stats.totalCandidates'),
      value: candidatesQuery.data?.pagination?.total || 0,
      icon: UserGroupIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: t('dashboard.stats.activeInterviews'),
      value: interviewsQuery.data?.sessions?.filter((i: InterviewSession) => i.status === 'active').length || 0,
      icon: MicrophoneIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: t('dashboard.stats.completedInterviews'),
      value: interviewsQuery.data?.sessions?.filter((i: InterviewSession) => i.status === 'completed').length || 0,
      icon: CheckCircleIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: t('dashboard.stats.terminatedInterviews'),
      value: interviewsQuery.data?.sessions?.filter((i: InterviewSession) => i.status === 'terminated').length || 0,
      icon: ClockIcon,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  if (candidatesQuery.error || interviewsQuery.error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Alert variant="error">
          <AlertDescription>
            {t('dashboard.error')} {candidatesQuery.error?.message || interviewsQuery.error?.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('dashboard.title')}
        </h1>
        <p className="text-gray-600">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent className="flex items-center">
                <div className={`${stat.bgColor} p-3 rounded-lg mr-4`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {candidatesQuery.isLoading || interviewsQuery.isLoading ? '...' : stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Candidates */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.sections.recentCandidates')}</CardTitle>
          </CardHeader>
          <CardContent>
            {candidatesQuery.isLoading ? (
              <TableSkeleton rows={3} />
            ) : candidatesQuery.data?.candidates?.length ? (
              <div className="space-y-3">
                {candidatesQuery.data.candidates.slice(0, 5).map((candidate: Candidate) => (
                  <div key={candidate._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{candidate.personalInfo.name}</p>
                      <p className="text-sm text-gray-600">{candidate.personalInfo.email}</p>
                    </div>
                    <Chip
                      variant={candidate.analysis.qualified ? 'success' : 'error'}
                      size="sm"
                    >
                      {candidate.analysis.qualified ? t('dashboard.status.qualified') : t('dashboard.status.notQualified')}
                    </Chip>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">{t('dashboard.empty.noCandidates')}</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Interviews */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.sections.recentInterviews')}</CardTitle>
          </CardHeader>
          <CardContent>
            {interviewsQuery.isLoading ? (
              <TableSkeleton rows={3} />
            ) : interviewsQuery.data?.sessions?.length ? (
              <div className="space-y-3">
                {interviewsQuery.data.sessions.slice(0, 5).map((interview: InterviewSession) => (
                  <div key={interview._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{interview.candidateId.personalInfo.name}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(interview.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Chip
                      variant={interview.status === 'active' ? 'primary' : interview.status === 'completed' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {t(`dashboard.status.${interview.status}`)}
                    </Chip>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">{t('dashboard.empty.noInterviews')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;