import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const ThankYouPage: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const handleRestart = () => {
    navigate('/interview/start');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-100">
            <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {t('thankYou.title')}
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            {t('thankYou.message')}
          </p>
        </div>

        <Card className="p-8">
          <div className="space-y-6">
            {sessionId && (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">
                  {t('thankYou.sessionId')}
                </p>
                <p className="font-mono text-sm bg-gray-100 p-2 rounded">
                  {sessionId}
                </p>
              </div>
            )}

            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                {t('thankYou.nextSteps')}
              </h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>{t('thankYou.weWillReview')}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>{t('thankYou.contactSoon')}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>{t('thankYou.keepCVReady')}</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col space-y-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => window.close()}
              >
                {t('thankYou.closeWindow')}
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                onClick={handleRestart}
              >
                {t('thankYou.restartInterview')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ThankYouPage;