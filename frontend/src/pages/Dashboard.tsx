import React from 'react';
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
  const { useCandidates } = useCVQueries();
  const { useInterviewSessions } = useInterviewQueries();
  
  const candidatesQuery = useCandidates({ limit: 10 });
  const interviewsQuery = useInterviewSessions({ limit: 10 });

  const statsData = [
    {
      title: 'Total Candidates',
      value: candidatesQuery.data?.total || 0,
      icon: UserGroupIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Active Interviews',
      value: interviewsQuery.data?.items?.filter((i: InterviewSession) => i.status === 'active').length || 0,
      icon: MicrophoneIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Completed Interviews',
      value: interviewsQuery.data?.items?.filter((i: InterviewSession) => i.status === 'completed').length || 0,
      icon: CheckCircleIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Pending Reviews',
      value: interviewsQuery.data?.items?.filter((i: InterviewSession) => i.status === 'pending').length || 0,
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
            Failed to load dashboard data: {candidatesQuery.error?.message || interviewsQuery.error?.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600">
          Overview of candidates, interviews, and recruitment analytics
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
            <CardTitle>Recent Candidates</CardTitle>
          </CardHeader>
          <CardContent>
            {candidatesQuery.isLoading ? (
              <TableSkeleton rows={3} />
            ) : candidatesQuery.data?.items?.length ? (
              <div className="space-y-3">
                {candidatesQuery.data.items.slice(0, 5).map((candidate: Candidate) => (
                  <div key={candidate._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{candidate.personalInfo.name}</p>
                      <p className="text-sm text-gray-600">{candidate.personalInfo.email}</p>
                    </div>
                    <Chip
                      variant={candidate.analysis.qualified ? 'success' : 'error'}
                      size="sm"
                    >
                      {candidate.analysis.qualified ? 'Qualified' : 'Not Qualified'}
                    </Chip>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No candidates found</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Interviews */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Interview Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {interviewsQuery.isLoading ? (
              <TableSkeleton rows={3} />
            ) : interviewsQuery.data?.items?.length ? (
              <div className="space-y-3">
                {interviewsQuery.data.items.slice(0, 5).map((interview: InterviewSession) => (
                  <div key={interview._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{interview.candidateId}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(interview.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Chip
                      variant={interview.status === 'active' ? 'primary' : interview.status === 'completed' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {interview.status}
                    </Chip>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No interviews found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;