import { useState, useEffect, useRef, useCallback } from 'react';

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

interface SimpleWebSocketState {
  isConnected: boolean;
  error: string | null;
  aiResponse: string | null;
  audioUrl: string | null;
  transcript: Array<{ speaker: string; content: string; timestamp: string }>;
  isCompleted: boolean;
}

const useSimpleInterviewWebSocket = () => {
  const [state, setState] = useState<SimpleWebSocketState>({
    isConnected: false,
    error: null,
    aiResponse: null,
    audioUrl: null,
    transcript: [],
    isCompleted: false
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  
  const connect = useCallback((sessionId: string, sessionKey?: string) => {
    // Clear any existing reconnection attempts
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close existing connection if one exists
    if (wsRef.current) {
      wsRef.current.close(1000, 'New connection requested');
    }
    
    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/interview?sessionId=${sessionId}${sessionKey ? `&sessionKey=${sessionKey}` : ''}`;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null
        }));
        reconnectAttemptsRef.current = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('Received message:', message);
          
          switch (message.type) {
            case 'connected':
              // Connection established
              break;
            
            case 'ai_response':
              // Check if the interview is completed based on the AI response content
              const isCompleted = message.text && (
                message.text.includes('Interview is now over') || 
                message.text.includes('Интервью завершено')
              );
              
              setState(prev => ({
                ...prev,
                aiResponse: message.text,
                audioUrl: message.audioUrl || null,
                transcript: [
                  ...prev.transcript,
                  {
                    speaker: 'ai',
                    content: message.text,
                    timestamp: new Date().toISOString()
                  }
                ],
                isCompleted: isCompleted
              }));
              break;
            
            case 'candidate_response':
              setState(prev => ({
                ...prev,
                transcript: [
                  ...prev.transcript,
                  {
                    speaker: 'candidate',
                    content: message.text,
                    timestamp: new Date().toISOString()
                  }
                ]
              }));
              break;
            
            case 'audio_received':
              // Audio chunk received
              break;
            
            case 'processing_started':
              // Processing started
              break;
            
            case 'error':
              setState(prev => ({
                ...prev,
                error: message.message
              }));
              break;
            
            default:
              console.warn('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          setState(prev => ({
            ...prev,
            error: 'Failed to parse message from server'
          }));
        }
      };
      
      ws.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
        wsRef.current = null;
        
        setState(prev => ({
          ...prev,
          isConnected: false
        }));
        
        // Attempt reconnection if not explicitly closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < 3) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            console.log(`Reconnection attempt ${reconnectAttemptsRef.current}`);
            connect(sessionId, sessionKey);
          }, delay);
        } else if (event.code !== 1000) {
          setState(prev => ({
            ...prev,
            error: 'Connection failed. Please refresh the page to try again.'
          }));
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'Connection error occurred'
        }));
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to establish connection'
      }));
      
      // Attempt reconnection
      if (reconnectAttemptsRef.current < 3) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect(sessionId, sessionKey);
        }, delay);
      }
    }
  }, []);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    
    reconnectAttemptsRef.current = 0;
    setState({
      isConnected: false,
      error: null,
      aiResponse: null,
      audioUrl: null,
      transcript: [],
      isCompleted: false
    });
  }, []);
  
  const sendAudioData = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData)));
      wsRef.current.send(JSON.stringify({
        type: 'audio_data',
        data: base64Audio
      }));
      
      // Do NOT add to transcript here - only update transcript with actual transcribed responses
    }
  }, []);
  
  const endSpeech = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'end_speech'
      }));
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  
  return {
    ...state,
    connect,
    disconnect,
    sendAudioData,
    endSpeech
  };
};

export default useSimpleInterviewWebSocket;