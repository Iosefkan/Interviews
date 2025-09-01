import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useWebRTCAudio } from '../../hooks/useWebRTCAudio';
import useSimpleInterviewWebSocket from '../../hooks/useSimpleInterviewWebSocket';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import { Spinner } from '../ui/LoadingStates';
import { AudioVisualizer } from '../ui/AudioVisualizer';
import { 
  MicrophoneIcon, 
  StopIcon, 
  SignalIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

interface SimpleRealTimeInterviewProps {
  sessionId: string;
  sessionKey: string;
}

const SimpleRealTimeInterview: React.FC<SimpleRealTimeInterviewProps> = ({
  sessionId,
  sessionKey
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // WebSocket connection
  const {
    isConnected,
    error,
    audioUrl,
    transcript,
    isCompleted,
    connect,
    disconnect,
    sendAudioData,
    endSpeech
  } = useSimpleInterviewWebSocket();

  // Audio recording
  const onAudioData = useCallback((audioBlob: Blob) => {
    // Convert blob to array buffer and send
    audioBlob.arrayBuffer().then(arrayBuffer => {
      sendAudioData(arrayBuffer);
    });
  }, [sendAudioData]);

  const {
    state: audioState,
    startRecording,
    stopRecording
  } = useWebRTCAudio(
    {
      timeSlice: 1000, // 1 second chunks
      enableAutoGainControl: true,
      enableNoiseSuppression: true,
      enableEchoCancellation: true
    },
    onAudioData
  );

  // Interview state
  const [interviewStartTime] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [transcriptHeight, setTranscriptHeight] = useState(400); // Default height in pixels
  const [isResizing, setIsResizing] = useState(false);

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      if (transcriptContainerRef.current) {
        const containerRect = transcriptContainerRef.current.getBoundingClientRect();
        const newHeight = e.clientY - containerRect.top;
        
        // Set minimum and maximum height constraints
        if (newHeight >= 200 && newHeight <= 600) {
          setTranscriptHeight(newHeight);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Scroll to bottom of transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Update current time
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Connect to WebSocket on mount
  useEffect(() => {
    if (sessionId) {
      connect(sessionId, sessionKey);
    }

    return () => {
      disconnect();
    };
  }, [sessionId, sessionKey, connect, disconnect]);

  // Redirect to ThankYouPage when interview is completed
  useEffect(() => {
    if (isCompleted) {
      // Small delay to ensure the final message is displayed
      const timer = setTimeout(() => {
        navigate(`/interview/thank-you/${sessionId}`);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isCompleted, navigate, sessionId]);

  // Handle start recording
  const handleStartRecording = useCallback(async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [startRecording]);

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    try {
      // Stop recording and get the final blob
      const finalBlob = await stopRecording();
      
      // If there's a final blob, send it before ending speech
      if (finalBlob) {
        onAudioData(finalBlob);
        // Small delay to ensure the audio data is sent
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      endSpeech();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, [stopRecording, onAudioData, endSpeech]);

  // Auto-play AI response audio when received
  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      // Add event listener for when audio is loaded
      audio.addEventListener('canplaythrough', () => {
        audio.play().catch(error => {
          console.error('Failed to auto-play audio:', error);
        });
      });
      
      // Also try to play immediately in case canplaythrough doesn't fire
      setTimeout(() => {
        audio.play().catch(error => {
          console.error('Failed to auto-play audio (timeout):', error);
        });
      }, 100);
      
      return () => {
        audio.pause();
        audio.remove();
      };
    }
  }, [audioUrl]);

  // Calculate interview duration
  const interviewDuration = Math.floor((currentTime.getTime() - interviewStartTime.getTime()) / 1000);
  const durationMinutes = Math.floor(interviewDuration / 60);
  const durationSeconds = interviewDuration % 60;

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="error">
          <AlertDescription>
            {t('interview.connectionFailed', { error })}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('interview.connecting')}</p>
        </div>
      </div>
    );
  }

  // Show completion message when interview is completed
  if (isCompleted) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('interview.interviewCompletedRedirect')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('interview.title')}
        </h1>
        <p className="text-gray-600">
          {t('interview.sessionId')}: {sessionId}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Interview Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transcript Display */}
          <Card>
            <CardHeader>
              <CardTitle>{t('interview.transcript')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={transcriptContainerRef}
                className="relative bg-gray-50 p-4 rounded-lg"
                style={{ height: `${transcriptHeight}px` }}
              >
                <div className="overflow-y-auto h-full pb-6">
                  {transcript.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      {t('interview.transcriptEmpty')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {transcript.map((entry, index) => (
                        <div 
                          key={index} 
                          className={cn(
                            'p-3 rounded-lg',
                            entry.speaker === 'ai' 
                              ? 'bg-blue-50 border border-blue-100' 
                              : 'bg-green-50 border border-green-100'
                          )}
                        >
                          <div className="flex justify-between items-start">
                            <span className={cn(
                              'font-semibold text-sm',
                              entry.speaker === 'ai' ? 'text-blue-700' : 'text-green-700'
                            )}>
                              {entry.speaker === 'ai' ? t('interview.interviewer') : t('interview.you')}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="mt-1 text-gray-700 whitespace-pre-wrap">
                            {entry.content}
                          </p>
                        </div>
                      ))}
                      <div ref={transcriptEndRef} />
                    </div>
                  )}
                </div>
                {/* Resize Handle */}
                <div 
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-gray-300 hover:bg-gray-400 rounded-b-lg"
                  onMouseDown={handleMouseDown}
                >
                  <div className="flex justify-center items-center h-full">
                    <div className="w-8 h-1 bg-gray-500 rounded"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Question */}
          <Card>
            <CardHeader>
              <CardTitle>{t('interview.instructions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-gray-700 mb-6">
                {t('interview.instructionsText')}
              </p>
              
              <div className="flex flex-col items-center space-y-6">
                <AudioVisualizer
                  audioLevel={audioState.audioLevel}
                  isRecording={audioState.isRecording}
                  isActive={isConnected}
                  size="lg"
                />
                
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex space-x-4">
                    {!audioState.isRecording ? (
                      <Button
                        size="lg"
                        onClick={handleStartRecording}
                        className="px-8 py-4 text-lg"
                      >
                        <MicrophoneIcon className="mr-2 h-6 w-6" />
                        {t('interview.startSpeaking')}
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={handleStopRecording}
                        className="px-8 py-4 text-lg"
                      >
                        <StopIcon className="mr-2 h-6 w-6" />
                        {t('interview.stopSpeaking')}
                      </Button>
                    )}
                  </div>
                  
                  {audioState.isRecording && (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-600">{t('interview.recordingInProgress')}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <SignalIcon className="h-5 w-5" />
                <span>{t('interview.connectionStatus')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t('interview.status')}:</span>
                  <span className={cn(
                    'text-sm font-medium',
                    isConnected ? 'text-green-600' : 'text-red-600'
                  )}>
                    {isConnected ? t('interview.connected') : t('interview.disconnected')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interview Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ClockIcon className="h-5 w-5" />
                <span>{t('interview.progress')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-700">
                    {durationMinutes}:{durationSeconds.toString().padStart(2, '0')}
                  </p>
                  <p className="text-sm text-gray-600">{t('interview.interviewDuration')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SimpleRealTimeInterview;