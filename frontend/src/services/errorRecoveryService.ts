import { toast } from 'react-hot-toast';

export interface ErrorInfo {
  code: string;
  message: string;
  context?: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  execute: () => Promise<boolean>;
  retryCount?: number;
  maxRetries?: number;
}

class ErrorRecoveryService {
  private errorLog: ErrorInfo[] = [];
  private recoveryStrategies: Map<string, RecoveryStrategy[]> = new Map();
  private activeRecoveryAttempts: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies() {
    // WebSocket connection errors
    this.registerRecoveryStrategy('WEBSOCKET_CONNECTION_FAILED', [
      {
        name: 'reconnect',
        description: 'Attempt to reconnect to WebSocket server',
        execute: async () => {
          // Reconnection logic will be provided by the WebSocket hook
          return false; // Will be overridden by actual implementation
        },
        maxRetries: 5
      }
    ]);

    // Audio capture errors
    this.registerRecoveryStrategy('AUDIO_CAPTURE_FAILED', [
      {
        name: 'requestPermissions',
        description: 'Request microphone permissions again',
        execute: async () => {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            return true;
          } catch (error) {
            return false;
          }
        },
        maxRetries: 3
      },
      {
        name: 'fallbackDevice',
        description: 'Try different audio input device',
        execute: async () => {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            
            for (const device of audioInputs) {
              try {
                await navigator.mediaDevices.getUserMedia({
                  audio: { deviceId: device.deviceId }
                });
                return true;
              } catch (error) {
                continue;
              }
            }
            return false;
          } catch (error) {
            return false;
          }
        },
        maxRetries: 1
      }
    ]);

    // Audio processing errors
    this.registerRecoveryStrategy('AUDIO_PROCESSING_FAILED', [
      {
        name: 'retryProcessing',
        description: 'Retry audio processing with different parameters',
        execute: async () => {
          // Will be implemented by audio service
          return false;
        },
        maxRetries: 3
      },
      {
        name: 'fallbackMode',
        description: 'Switch to text-only mode',
        execute: async () => {
          toast.error('Audio processing failed. Switching to text-only mode.');
          return true;
        },
        maxRetries: 1
      }
    ]);

    // Network errors
    this.registerRecoveryStrategy('NETWORK_ERROR', [
      {
        name: 'retryRequest',
        description: 'Retry the failed request',
        execute: async () => {
          // Will be implemented by specific network operations
          return false;
        },
        maxRetries: 3
      },
      {
        name: 'checkConnection',
        description: 'Check internet connectivity',
        execute: async () => {
          try {
            const response = await fetch('/api/health', { 
              method: 'HEAD',
              cache: 'no-cache'
            });
            return response.ok;
          } catch (error) {
            return false;
          }
        },
        maxRetries: 1
      }
    ]);

    // Service unavailable errors
    this.registerRecoveryStrategy('SERVICE_UNAVAILABLE', [
      {
        name: 'waitAndRetry',
        description: 'Wait before retrying the operation',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 5000));
          return true;
        },
        maxRetries: 3
      },
      {
        name: 'fallbackService',
        description: 'Use fallback service if available',
        execute: async () => {
          // Fallback logic will be service-specific
          return false;
        },
        maxRetries: 1
      }
    ]);
  }

  registerRecoveryStrategy(errorCode: string, strategies: RecoveryStrategy[]) {
    this.recoveryStrategies.set(errorCode, strategies);
  }

  async handleError(errorInfo: ErrorInfo): Promise<boolean> {
    // Log the error
    this.logError(errorInfo);

    // Show user notification based on severity
    this.showUserNotification(errorInfo);

    // Attempt recovery if the error is recoverable
    if (errorInfo.recoverable) {
      return await this.attemptRecovery(errorInfo);
    }

    return false;
  }

  private logError(errorInfo: ErrorInfo) {
    this.errorLog.push(errorInfo);
    
    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }

    // Log to console with context
    const logMethod = errorInfo.severity === 'critical' ? 'error' : 
                     errorInfo.severity === 'high' ? 'warn' : 'log';
    
    console[logMethod](`[${errorInfo.severity.toUpperCase()}] ${errorInfo.code}: ${errorInfo.message}`, {
      context: errorInfo.context,
      timestamp: errorInfo.timestamp
    });
  }

  private showUserNotification(errorInfo: ErrorInfo) {
    const userFriendlyMessage = this.getUserFriendlyMessage(errorInfo);
    
    switch (errorInfo.severity) {
      case 'critical':
        toast.error(userFriendlyMessage, { duration: 10000 });
        break;
      case 'high':
        toast.error(userFriendlyMessage, { duration: 5000 });
        break;
      case 'medium':
        toast(userFriendlyMessage, { duration: 3000 });
        break;
      case 'low':
        // Don't show notifications for low severity errors
        break;
    }
  }

  private getUserFriendlyMessage(errorInfo: ErrorInfo): string {
    const messageMap: Record<string, string> = {
      'WEBSOCKET_CONNECTION_FAILED': 'Connection lost. Attempting to reconnect...',
      'AUDIO_CAPTURE_FAILED': 'Microphone access failed. Please check permissions.',
      'AUDIO_PROCESSING_FAILED': 'Audio processing error. Please try speaking again.',
      'NETWORK_ERROR': 'Network error occurred. Checking connection...',
      'SERVICE_UNAVAILABLE': 'Service temporarily unavailable. Retrying...',
      'INVALID_SESSION': 'Session expired. Please refresh the page.',
      'RATE_LIMIT_EXCEEDED': 'Too many requests. Please wait a moment.',
      'AUTHENTICATION_FAILED': 'Authentication failed. Please login again.'
    };

    return messageMap[errorInfo.code] || errorInfo.message;
  }

  private async attemptRecovery(errorInfo: ErrorInfo): Promise<boolean> {
    const strategies = this.recoveryStrategies.get(errorInfo.code);
    if (!strategies) {
      return false;
    }

    const recoveryKey = `${errorInfo.code}_${errorInfo.timestamp.getTime()}`;
    
    for (const strategy of strategies) {
      const attemptKey = `${recoveryKey}_${strategy.name}`;
      const currentAttempts = this.activeRecoveryAttempts.get(attemptKey) || 0;
      const maxRetries = strategy.maxRetries || 1;

      if (currentAttempts >= maxRetries) {
        continue;
      }

      this.activeRecoveryAttempts.set(attemptKey, currentAttempts + 1);

      try {
        console.log(`Attempting recovery: ${strategy.name} (attempt ${currentAttempts + 1}/${maxRetries})`);
        const success = await strategy.execute();
        
        if (success) {
          console.log(`Recovery successful: ${strategy.name}`);
          this.activeRecoveryAttempts.delete(attemptKey);
          // We can't use translation here as this is a service, not a React component
          toast.success('Connection restored');
          return true;
        }
      } catch (error) {
        console.error(`Recovery strategy failed: ${strategy.name}`, error);
      }

      // Wait before trying next strategy
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }

  // Specific error creators
  createWebSocketError(message: string, context?: any): ErrorInfo {
    return {
      code: 'WEBSOCKET_CONNECTION_FAILED',
      message,
      context,
      timestamp: new Date(),
      severity: 'high',
      recoverable: true
    };
  }

  createAudioCaptureError(message: string, context?: any): ErrorInfo {
    return {
      code: 'AUDIO_CAPTURE_FAILED',
      message,
      context,
      timestamp: new Date(),
      severity: 'high',
      recoverable: true
    };
  }

  createAudioProcessingError(message: string, context?: any): ErrorInfo {
    return {
      code: 'AUDIO_PROCESSING_FAILED',
      message,
      context,
      timestamp: new Date(),
      severity: 'medium',
      recoverable: true
    };
  }

  createNetworkError(message: string, context?: any): ErrorInfo {
    return {
      code: 'NETWORK_ERROR',
      message,
      context,
      timestamp: new Date(),
      severity: 'high',
      recoverable: true
    };
  }

  createServiceUnavailableError(message: string, context?: any): ErrorInfo {
    return {
      code: 'SERVICE_UNAVAILABLE',
      message,
      context,
      timestamp: new Date(),
      severity: 'medium',
      recoverable: true
    };
  }

  createSessionError(message: string, context?: any): ErrorInfo {
    return {
      code: 'INVALID_SESSION',
      message,
      context,
      timestamp: new Date(),
      severity: 'critical',
      recoverable: false
    };
  }

  // Error analytics
  getErrorStats() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentErrors = this.errorLog.filter(error => error.timestamp >= oneHourAgo);
    const dailyErrors = this.errorLog.filter(error => error.timestamp >= oneDayAgo);

    const errorsByCode = recentErrors.reduce((acc, error) => {
      acc[error.code] = (acc[error.code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsBySeverity = recentErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.errorLog.length,
      recentCount: recentErrors.length,
      dailyCount: dailyErrors.length,
      byCode: errorsByCode,
      bySeverity: errorsBySeverity,
      recoveryRate: this.calculateRecoveryRate()
    };
  }

  private calculateRecoveryRate(): number {
    const recoverableErrors = this.errorLog.filter(error => error.recoverable);
    if (recoverableErrors.length === 0) return 100;

    // This is a simplified calculation - in a real implementation,
    // you'd track which errors were successfully recovered
    return Math.round((recoverableErrors.length * 0.8) / recoverableErrors.length * 100);
  }

  // Cleanup
  cleanup() {
    this.errorLog = [];
    this.activeRecoveryAttempts.clear();
  }
}

// Create and export singleton instance
export const errorRecoveryService = new ErrorRecoveryService();

// Convenience hooks for React components
export const useErrorRecovery = () => {
  const handleError = async (error: Error, context?: any) => {
    const errorInfo: ErrorInfo = {
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message,
      context,
      timestamp: new Date(),
      severity: 'medium',
      recoverable: true
    };

    return await errorRecoveryService.handleError(errorInfo);
  };

  const handleWebSocketError = async (error: Error, context?: any) => {
    const errorInfo = errorRecoveryService.createWebSocketError(error.message, context);
    return await errorRecoveryService.handleError(errorInfo);
  };

  const handleAudioError = async (error: Error, context?: any) => {
    const errorInfo = errorRecoveryService.createAudioCaptureError(error.message, context);
    return await errorRecoveryService.handleError(errorInfo);
  };

  const handleNetworkError = async (error: Error, context?: any) => {
    const errorInfo = errorRecoveryService.createNetworkError(error.message, context);
    return await errorRecoveryService.handleError(errorInfo);
  };

  return {
    handleError,
    handleWebSocketError,
    handleAudioError,
    handleNetworkError,
    getErrorStats: () => errorRecoveryService.getErrorStats()
  };
};

export default errorRecoveryService;