import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface WebSocketMessage {
  type: 'session_ready' | 'transcription' | 'ai_response' | 'audio_chunk_received' | 'transcription_started' | 'interview_complete' | 'error' | 'pong' | 'interview_started';
  sessionId: string;
  data: any;
  timestamp: number;
}

interface ConversationMessage {
  id: string;
  speaker: 'ai' | 'candidate';
  content: string;
  audioUrl?: string;
  timestamp: Date;
  confidence?: number;
}

interface InterviewSessionState {
  sessionId: string | null;
  currentQuestion: string | null;
  questionIndex: number;
  totalQuestions: number;
  transcript: ConversationMessage[];
  isComplete: boolean;
  status: 'connecting' | 'ready' | 'active' | 'processing' | 'completed' | 'error';
  candidateInfo?: {
    name: string;
    jobTitle: string;
  };
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastPingTime: number;
  latency: number;
  lastSuccessfulConnection: Date | null; // Track last successful connection
  consecutiveFailures: number; // Track consecutive failures
}

interface UseInterviewWebSocketReturn {
  sessionState: InterviewSessionState;
  connectionState: ConnectionState;
  connect: (sessionId: string, sessionKey?: string) => void;
  disconnect: () => void;
  sendAudioChunk: (audioData: ArrayBuffer, chunkIndex: number) => void;
  endResponse: () => void;
  isProcessing: boolean;
}

// Custom hook for network status detection
const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
};

const useInterviewWebSocket = (): UseInterviewWebSocketReturn => {
  const [sessionState, setSessionState] = useState<InterviewSessionState>({
    sessionId: null,
    currentQuestion: null,
    questionIndex: 0,
    totalQuestions: 0,
    transcript: [],
    isComplete: false,
    status: 'connecting'
  });

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
    lastPingTime: 0,
    latency: 0,
    lastSuccessfulConnection: null,
    consecutiveFailures: 0
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // WebSocket connection reference
  const wsRef = useRef<WebSocket | null>(null);

  // Reconnection timeout reference
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Ping interval reference
  const pingIntervalRef = useRef<number | null>(null);

  // Translation hook
  const { t } = useTranslation();

  // Generate unique message ID
  const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Track consecutive failed attempts
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastSuccessfulConnection, setLastSuccessfulConnection] = useState<Date | null>(null);
  
  // Network status
  const isOnline = useNetworkStatus();
  
  // Enable debugging in development
  const isDebug = import.meta.env.DEV;
  
  const logDebug = useCallback((message: string, data?: any) => {
    if (isDebug) {
      console.log(`[WebSocket Debug] ${message}`, data);
    }
  }, [isDebug]);
  
  const connect = useCallback((sessionId: string, sessionKey?: string) => {
    logDebug('Attempting connection', { sessionId, sessionKey });
    
    if (!isOnline) {
      setConnectionState(prev => ({
        ...prev,
        error: 'No internet connection. Please check your network and try again.',
        isConnecting: false
      }));
      logDebug('Connection failed - offline');
      return;
    }
    
    // Prevent connection if too many consecutive failures
    if (consecutiveFailures > 5) {
      const timeSinceLastSuccess = lastSuccessfulConnection 
        ? Date.now() - lastSuccessfulConnection.getTime() 
        : Infinity;
      
      // If we haven't had a successful connection in over 5 minutes, stop trying
      if (timeSinceLastSuccess > 5 * 60 * 1000) {
        setConnectionState(prev => ({
          ...prev,
          error: 'Unable to establish connection after multiple attempts. Please check your network connection and refresh the page.',
          isConnecting: false
        }));
        logDebug('Connection failed - too many consecutive failures');
        return;
      }
    }
    
    if (connectionState.isConnecting || connectionState.isConnected) {
      logDebug('Connection skipped - already connecting or connected');
      return;
    }

    setConnectionState(prev => ({ ...prev, isConnecting: true, error: null }));
    logDebug('Setting connection state to connecting');

    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/interview?sessionId=${sessionId}${sessionKey ? `&sessionKey=${sessionKey}` : ''}`;
      logDebug('Creating WebSocket connection', { wsUrl });
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Set up ping/pong mechanism
      let pingTimeout: number | null = null;
      let pongTimeout: number | null = null;

      const heartbeat = () => {
        if (pingTimeout) clearTimeout(pingTimeout);
        if (pongTimeout) clearTimeout(pongTimeout);
        
        // Send ping every 25 seconds
        pingTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
          // Wait 5 seconds for pong response
          pongTimeout = setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              console.log('🏓 Ping timeout - closing connection');
              ws.close(1006, 'Ping timeout');
            }
          }, 5000);
        }, 25000);
      };

      ws.onopen = () => {
        logDebug('WebSocket connected');
        console.log('✅ WebSocket connected', {
          url: ws.url,
          protocol: ws.protocol,
          extensions: ws.extensions
        });
        setConnectionState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          reconnectAttempts: 0,
          error: null,
          lastSuccessfulConnection: new Date(),
          consecutiveFailures: 0
        }));

        // Start heartbeat
        heartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          logDebug('Received message', { type: message.type, data: message.data });
          
          // Reset heartbeat on any message
          heartbeat();
          
          // Handle pong messages specifically
          if (message.type === 'pong') {
            const latency = Date.now() - connectionState.lastPingTime;
            setConnectionState(prev => ({ ...prev, latency }));
            return;
          }
          
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error, {
            data: event.data,
            dataSize: event.data?.length
          });
          logDebug('Failed to parse message', { error, data: event.data });
        }
      };

      ws.onclose = (event) => {
        logDebug('WebSocket disconnected', { code: event.code, reason: event.reason });
        console.log('🔌 WebSocket disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          timestamp: new Date().toISOString()
        });
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }));

        // Clear timeouts
        if (pingTimeout) clearTimeout(pingTimeout);
        if (pongTimeout) clearTimeout(pongTimeout);

        // Reset failure counter on successful connection
        if (connectionState.isConnected) {
          setConsecutiveFailures(0);
          setLastSuccessfulConnection(new Date());
        } else if (connectionState.error) {
          setConsecutiveFailures(prev => prev + 1);
        }

        // Attempt reconnection if not intentional and not too many failures
        if (event.code !== 1000 && connectionState.reconnectAttempts < 5 && consecutiveFailures < 5) {
          logDebug('Scheduling reconnection');
          scheduleReconnect(sessionId, sessionKey);
        }
      };

      ws.onerror = (error) => {
        logDebug('WebSocket error', { error });
        console.error('❌ WebSocket error:', error, {
          url: ws.url,
          readyState: ws.readyState,
          timestamp: new Date().toISOString()
        });
        
        setConnectionState(prev => ({
          ...prev,
          error: 'Connection failed',
          isConnecting: false,
          consecutiveFailures: prev.consecutiveFailures + 1
        }));
      };

    } catch (error) {
      logDebug('Failed to create WebSocket connection', { error });
      console.error('Failed to create WebSocket connection:', error);
      setConnectionState(prev => ({
        ...prev,
        error: 'Failed to connect',
        isConnecting: false,
        consecutiveFailures: prev.consecutiveFailures + 1
      }));
    }
  }, [isOnline, consecutiveFailures, lastSuccessfulConnection, connectionState.isConnecting, connectionState.isConnected, connectionState.reconnectAttempts, connectionState.isConnected, connectionState.error, isDebug, logDebug]);

  // WebSocket message handler
  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'interview_started':
        setSessionState(prev => ({
          ...prev,
          status: 'active',
          sessionId: message.data.sessionId || prev.sessionId,
          candidateInfo: message.data.candidateInfo,
          currentQuestion: message.data.currentQuestion,
          questionIndex: message.data.currentQuestionIndex || 0
        }));
        setConnectionState(prev => ({ ...prev, isConnected: true, isConnecting: false, error: null }));
        break;

      case 'ai_response':
        const aiMessage: ConversationMessage = {
          id: generateMessageId(),
          speaker: 'ai',
          content: message.data.text,
          audioUrl: message.data.audioUrl,
          timestamp: new Date()
        };

        setSessionState(prev => ({
          ...prev,
          transcript: [...prev.transcript, aiMessage],
          currentQuestion: message.data.nextQuestion || prev.currentQuestion,
          questionIndex: message.data.currentQuestionIndex || prev.questionIndex,
          isComplete: message.data.isComplete || false,
          status: message.data.isComplete ? 'completed' : 'active'
        }));

        setIsProcessing(false);

        // Play AI response audio if available
        if (message.data.audioUrl) {
          playAudio(message.data.audioUrl);
        }

        if (message.data.isComplete) {
          toast.success(t('toast.interview.completed'));
        }
        break;

      case 'transcription_started':
        setIsProcessing(true);
        setSessionState(prev => ({ ...prev, status: 'processing' }));
        break;

      case 'transcription':
        const transcriptionMessage: ConversationMessage = {
          id: generateMessageId(),
          speaker: 'candidate',
          content: message.data.text,
          timestamp: new Date(),
          confidence: message.data.confidence
        };
        
        setSessionState(prev => ({
          ...prev,
          transcript: [...prev.transcript, transcriptionMessage]
        }));
        break;

      case 'audio_chunk_received':
        // Acknowledge audio chunk receipt
        console.log(`Audio chunk ${message.data.chunkIndex} received, total size: ${message.data.totalSize}`);
        break;

      case 'interview_complete':
        setSessionState(prev => ({
          ...prev,
          isComplete: true,
          status: 'completed'
        }));
        toast.success(t('toast.interview.completed'));
        break;

      case 'error':
        console.error('WebSocket error:', message.data.message);
        setSessionState(prev => ({ ...prev, status: 'error' }));
        setIsProcessing(false);
        toast.error(message.data.message || t('toast.interview.processingFailed', { error: 'An error occurred' }));
        break;

      case 'pong':
        const latency = Date.now() - connectionState.lastPingTime;
        setConnectionState(prev => ({ ...prev, latency }));
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }, [connectionState.lastPingTime, t]);

  // Play audio response
  const playAudio = useCallback((audioUrl: string) => {
    try {
      const audio = new Audio(audioUrl);
      audio.play().catch(error => {
        console.error('Failed to play audio:', error);
        toast.error(t('toast.interview.processingFailed', { error: 'Failed to play audio response' }));
      });
    } catch (error) {
      console.error('Failed to create audio element:', error);
      toast.error(t('toast.interview.processingFailed', { error: 'Failed to create audio element' }));
    }
  }, [t]);

  // Schedule reconnection
  const scheduleReconnect = useCallback((sessionId: string, sessionKey?: string) => {
    const delay = Math.min(1000 * Math.pow(2, connectionState.reconnectAttempts), 30000);
    
    setConnectionState(prev => ({
      ...prev,
      reconnectAttempts: prev.reconnectAttempts + 1
    }));

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Attempting to reconnect (attempt ${connectionState.reconnectAttempts + 1})...`);
      connect(sessionId, sessionKey);
    }, delay);
  }, [connectionState.reconnectAttempts, connect]);

  // Send audio chunk
  const sendAudioChunk = useCallback((audioData: ArrayBuffer, chunkIndex: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData)));
      
      wsRef.current.send(JSON.stringify({
        type: 'audio_chunk',
        data: {
          audioBuffer: base64Audio,
          chunkIndex: chunkIndex,
          timestamp: Date.now()
        }
      }));
    }
  }, []);

  // End response (trigger audio processing)
  const endResponse = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'end_response',
        data: { timestamp: Date.now() }
      }));
    }
  }, []);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setConnectionState({
      isConnected: false,
      isConnecting: false,
      error: null,
      reconnectAttempts: 0,
      lastPingTime: 0,
      latency: 0,
      lastSuccessfulConnection: null,
      consecutiveFailures: 0
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    sessionState,
    connectionState,
    connect,
    disconnect,
    sendAudioChunk,
    endResponse,
    isProcessing
  };
};

export default useInterviewWebSocket;

export type { WebSocketMessage, ConversationMessage, InterviewSessionState, ConnectionState, UseInterviewWebSocketReturn };
