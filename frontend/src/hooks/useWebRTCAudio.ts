import { useState, useEffect, useRef, useCallback } from 'react';
import RecordRTC from 'recordrtc';

interface AudioCaptureState {
  isRecording: boolean;
  isConnected: boolean;
  audioLevel: number;
  error: string | null;
  mediaStream: MediaStream | null;
  recorder: RecordRTC | null;
}

interface WebRTCConfig {
  sampleRate?: number;
  bufferSize?: number;
  numberOfChannels?: 1 | 2;
  timeSlice?: number;
  enableAutoGainControl?: boolean;
  enableNoiseSuppression?: boolean;
  enableEchoCancellation?: boolean;
}

interface UseWebRTCAudioReturn {
  state: AudioCaptureState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  getAudioLevel: () => number;
  cleanup: () => void;
}

export const useWebRTCAudio = (
  config: WebRTCConfig = {},
  onAudioData?: (audioBlob: Blob) => void
): UseWebRTCAudioReturn => {
  const [state, setState] = useState<AudioCaptureState>({
    isRecording: false,
    isConnected: false,
    audioLevel: 0,
    error: null,
    mediaStream: null,
    recorder: null
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Add ref to track recording state for animation frame loop
  const isRecordingRef = useRef<boolean>(false);
  // Add refs for current values to avoid dependency issues
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);

  const defaultConfig: WebRTCConfig = {
    sampleRate: 44100,
    bufferSize: 4096,
    numberOfChannels: 1,
    timeSlice: 1000, // 1 second chunks
    enableAutoGainControl: true,
    enableNoiseSuppression: true,
    enableEchoCancellation: true,
    ...config
  };

  // Initialize audio context and analyser
  const initializeAudioContext = useCallback((stream: MediaStream) => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      return false;
    }
  }, []);

  // Calculate audio level
  const calculateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return 0;
    
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    
    return sum / dataArrayRef.current.length / 255; // Normalize to 0-1
  }, []);

  // Audio level monitoring loop
  const monitorAudioLevel = useCallback(() => {
    const level = calculateAudioLevel();
    
    setState(prev => ({ ...prev, audioLevel: level }));
    
    // Use a ref to track recording state for the animation loop
    // This avoids issues with stale state in the animation frame callback
    if (isRecordingRef.current) {
      animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
    }
  }, [calculateAudioLevel]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: defaultConfig.sampleRate,
          channelCount: defaultConfig.numberOfChannels,
          autoGainControl: defaultConfig.enableAutoGainControl,
          noiseSuppression: defaultConfig.enableNoiseSuppression,
          echoCancellation: defaultConfig.enableEchoCancellation
        }
      });

      // Initialize audio context for level monitoring
      const audioContextInitialized = initializeAudioContext(stream);
      if (!audioContextInitialized) {
        throw new Error('Failed to initialize audio context');
      }

      // Create recorder
      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: defaultConfig.numberOfChannels,
        desiredSampRate: defaultConfig.sampleRate,
        timeSlice: defaultConfig.timeSlice,
        ondataavailable: (blob: Blob) => {
          if (onAudioData) {
            onAudioData(blob);
          }
        }
      });

      recorder.startRecording();

      // Update refs before state to ensure animation frame loop has correct value
      isRecordingRef.current = true;
      mediaStreamRef.current = stream;
      recorderRef.current = recorder;

      setState(prev => ({
        ...prev,
        isRecording: true,
        isConnected: true,
        mediaStream: stream,
        recorder
      }));

      // Start audio level monitoring
      monitorAudioLevel();

    } catch (error) {
      console.error('Failed to start recording:', error);
      isRecordingRef.current = false;
      mediaStreamRef.current = null;
      recorderRef.current = null;
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start recording',
        isRecording: false,
        isConnected: false
      }));
    }
  }, [defaultConfig, initializeAudioContext, monitorAudioLevel, onAudioData]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      // Update ref immediately
      isRecordingRef.current = false;
      
      // Use ref instead of state
      if (!recorderRef.current) {
        resolve(null);
        return;
      }

      recorderRef.current.stopRecording(() => {
        const blob = recorderRef.current!.getBlob();
        
        // Stop audio level monitoring
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Clean up media stream using ref
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }

        // Clear refs
        mediaStreamRef.current = null;
        recorderRef.current = null;

        setState(prev => ({
          ...prev,
          isRecording: false,
          isConnected: false,
          audioLevel: 0,
          mediaStream: null,
          recorder: null
        }));

        resolve(blob);
      });
    });
  }, []);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (recorderRef.current && isRecordingRef.current) {
      recorderRef.current.pauseRecording();
      isRecordingRef.current = false;
      setState(prev => ({ ...prev, isRecording: false }));
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (recorderRef.current && !isRecordingRef.current) {
      recorderRef.current.resumeRecording();
      isRecordingRef.current = true;
      setState(prev => ({ ...prev, isRecording: true }));
      monitorAudioLevel();
    }
  }, [monitorAudioLevel]);

  // Get current audio level
  const getAudioLevel = useCallback(() => {
    return calculateAudioLevel();
  }, [calculateAudioLevel]);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Update ref
    isRecordingRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Use refs to get current values instead of state dependencies
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (recorderRef.current) {
      recorderRef.current.destroy();
      recorderRef.current = null;
    }

    setState({
      isRecording: false,
      isConnected: false,
      audioLevel: 0,
      error: null,
      mediaStream: null,
      recorder: null
    });
  }, []); // No dependencies to prevent recreation

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []); // Empty dependency array means this runs only on unmount

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getAudioLevel,
    cleanup
  };
};

export default useWebRTCAudio;