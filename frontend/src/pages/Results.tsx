import React from 'react';
import { useParams } from 'react-router-dom';
import { useInterviewQueries } from '../hooks/useInterviewQueries';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert, AlertDescription } from '../components/ui/Alert';
import { Chip } from '../components/ui/Chip';
import { Spinner } from '../components/ui/LoadingStates';
import { 
  DocumentArrowDownIcon, 
  StarIcon,
  ClockIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';

const Results: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { useInterviewSession, generateInterviewReport } = useInterviewQueries();
  
  const sessionQuery = useInterviewSession(sessionId);

  const handleDownloadReport = () => {
    if (sessionId) {
      generateInterviewReport.mutate(sessionId, {
        onSuccess: (data) => {
          // Create download link
          const link = document.createElement('a');
          link.href = data.reportUrl;
          link.download = data.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      });
    }
  };

  if (sessionQuery.isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">Loading interview results...</p>
        </div>
      </div>
    );
  }

  if (sessionQuery.error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="error">
          <AlertDescription>
            Failed to load interview results: {sessionQuery.error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const session = sessionQuery.data;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Interview Results
        </h1>
        <p className="text-gray-600">
          Comprehensive analysis and detailed interview assessment
        </p>
      </div>

      {session ? (
        <div className="space-y-6">
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <StarIcon className="mr-2 h-5 w-5" />
                Overall Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-500 mb-2">
                    {session.overallScore || 'N/A'}/100
                  </div>
                  <p className="text-gray-600">Overall Score</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500 mb-2">
                    {session.questions?.length || 0}
                  </div>
                  <p className="text-gray-600">Questions Answered</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-500 mb-2">
                    {session.duration || '0'} min
                  </div>
                  <p className="text-gray-600">Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ClockIcon className="mr-2 h-5 w-5" />
                  Session Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Session ID:</span>
                    <span className="font-medium">{sessionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Chip
                      variant={session.status === 'completed' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {session.status}
                    </Chip>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Started:</span>
                    <span className="font-medium">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Completed:</span>
                    <span className="font-medium">
                      {session.completedAt ? 
                        new Date(session.completedAt).toLocaleDateString() : 
                        'In Progress'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircleIcon className="mr-2 h-5 w-5" />
                  Performance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Technical Skills</span>
                      <span className="text-sm font-medium">85%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Communication</span>
                      <span className="text-sm font-medium">78%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '78%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Problem Solving</span>
                      <span className="text-sm font-medium">90%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: '90%' }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Questions and Answers */}
          <Card>
            <CardHeader>
              <CardTitle>Interview Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {session.questions?.length ? (
                  session.questions.map((qa: {question: string; answer?: string; score?: number;}, index: number) => (
                    <div key={index} className="border-l-4 border-primary-500 pl-4 py-2">
                      <p className="font-medium text-gray-900 mb-2">
                        Q{index + 1}: {qa.question}
                      </p>
                      <p className="text-gray-700">
                        A: {qa.answer || 'No answer recorded'}
                      </p>
                      {qa.score && (
                        <div className="mt-2">
                          <Chip variant="primary" size="sm">
                            Score: {qa.score}/10
                          </Chip>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No questions and answers available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-center space-x-4">
            <Button
              onClick={handleDownloadReport}
              loading={generateInterviewReport.isPending}
              size="lg"
              className="px-8"
            >
              <DocumentArrowDownIcon className="mr-2 h-5 w-5" />
              Download PDF Report
            </Button>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              size="lg"
              className="px-8"
            >
              Go Back
            </Button>
          </div>
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            No interview data found for this session.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Results;