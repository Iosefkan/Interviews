import React from 'react';
import { useParams } from 'react-router-dom';
import { useInterviewQueries } from '../hooks/useInterviewQueries';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert, AlertDescription } from '../components/ui/Alert';
import { Spinner } from '../components/ui/LoadingStates';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';

const Interview: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { useInterviewSession } = useInterviewQueries();
  
  const sessionQuery = useInterviewSession(sessionId);

  if (sessionQuery.isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">Loading interview session...</p>
        </div>
      </div>
    );
  }

  if (sessionQuery.error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="error">
          <AlertDescription>
            Failed to load interview session: {sessionQuery.error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          AI Interview Session
        </h1>
        <p className="text-gray-600">
          Conduct real-time voice interview with AI assistant
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interview Control Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Interview Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="mb-8">
                  <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MicrophoneIcon className="w-12 h-12 text-red-500" />
                  </div>
                  <p className="text-lg text-gray-700 mb-2">Ready to start interview</p>
                  <p className="text-sm text-gray-500">Click the button below to begin recording</p>
                </div>
                
                <div className="space-y-4">
                  <Button size="lg" className="px-8">
                    <MicrophoneIcon className="mr-2 h-5 w-5" />
                    Start Recording
                  </Button>
                  
                  <Button variant="outline" size="lg" className="px-8">
                    <StopIcon className="mr-2 h-5 w-5" />
                    End Interview
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Session Info */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Session Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Session ID</p>
                  <p className="text-gray-600">{sessionId}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <p className="text-gray-600">{sessionQuery.data?.status || 'Unknown'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700">Started</p>
                  <p className="text-gray-600">
                    {sessionQuery.data?.startTime ? 
                      new Date(sessionQuery.data.startTime).toLocaleString() : 
                      'Not started'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Interview Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <p className="text-2xl font-bold text-gray-900 mb-2">0/5</p>
                <p className="text-sm text-gray-600">Questions Completed</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                  <div className="bg-primary-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Alert className="mt-6">
        <AlertDescription>
          <strong>Note:</strong> Voice recording and real-time AI interaction features are being implemented. 
          This interface will support full voice-to-voice communication with the AI interviewer.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default Interview;