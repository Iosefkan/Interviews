import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useStartPublicInterview } from '../hooks/useInterviewQueries';
import SimpleRealTimeInterview from '../components/interview/SimpleRealTimeInterview';

const InterviewStart: React.FC = () => {
  const { t } = useTranslation();
  const [sessionKey, setSessionKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewData, setInterviewData] = useState<any>(null);
  
  const startInterview = useStartPublicInterview();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionKey.trim()) {
      setError(t('interview.pleaseEnterSessionKey'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await startInterview.mutateAsync({ 
        sessionKey: sessionKey.trim(),
        interviewType: 'mixed' 
      });
      setInterviewData(data);
      setInterviewStarted(true);
    } catch (err) {
      setError(t('interview.invalidSessionKey'));
    } finally {
      setIsLoading(false);
    }
  };

  // If interview has started, show the simple interview component
  if (interviewStarted && interviewData) {
    return (
      <SimpleRealTimeInterview 
        sessionId={interviewData.sessionId}
        sessionKey={sessionKey}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {t('interview.startTitle')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t('interview.startSubtitle')}
          </p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="sessionKey" className="block text-sm font-medium text-gray-700">
                {t('interview.sessionKey')}
              </label>
              <input
                id="sessionKey"
                name="sessionKey"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('interview.sessionKeyPlaceholder')}
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
              />
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? t('interview.startingInterview') : t('interview.startInterview')}
              </Button>
            </div>
          </form>

          <div className="mt-6 border-t pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">{t('interview.beforeYouStart')}</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                {t('interview.quietEnvironment')}
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                {t('interview.testAudio')}
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                {t('interview.allowTime')}
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                {t('interview.haveCVReady')}
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default InterviewStart;