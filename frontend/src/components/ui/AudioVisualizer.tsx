import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface AudioVisualizerProps {
  audioLevel: number;
  isRecording: boolean;
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioLevel,
  isRecording,
  isActive = true,
  size = 'md',
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const sizeConfig = {
    sm: { width: 60, height: 60, bars: 8 },
    md: { width: 100, height: 100, bars: 12 },
    lg: { width: 140, height: 140, bars: 16 }
  };

  const config = sizeConfig[size];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { width, height, bars } = config;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 10;

      // Draw outer circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = isRecording 
        ? (isActive ? '#ef4444' : '#94a3b8') 
        : '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (isRecording && isActive) {
        // Draw audio level bars
        const angleStep = (2 * Math.PI) / bars;
        
        for (let i = 0; i < bars; i++) {
          const angle = i * angleStep - Math.PI / 2;
          const barHeight = Math.max(5, audioLevel * 30 + Math.random() * 5);
          
          const startX = centerX + Math.cos(angle) * (radius - barHeight);
          const startY = centerY + Math.sin(angle) * (radius - barHeight);
          const endX = centerX + Math.cos(angle) * radius;
          const endY = centerY + Math.sin(angle) * radius;

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = `hsla(${120 - audioLevel * 120}, 70%, 50%, ${0.7 + audioLevel * 0.3})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Draw center dot
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4 + audioLevel * 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
      } else if (!isRecording) {
        // Draw static microphone icon when not recording
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#9ca3af';
        ctx.fill();
      }

      if (isRecording && isActive) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    if (isRecording && isActive) {
      draw();
    } else {
      draw(); // Draw static state
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioLevel, isRecording, isActive, config]);

  return (
    <canvas
      ref={canvasRef}
      width={config.width}
      height={config.height}
      className={cn(
        'rounded-full',
        isRecording && isActive && 'animate-pulse',
        className
      )}
    />
  );
};

interface VoiceWaveformProps {
  audioLevel: number;
  isActive: boolean;
  bars?: number;
  className?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  audioLevel,
  isActive,
  bars = 20,
  className
}) => {
  return (
    <div className={cn('flex items-center justify-center space-x-1', className)}>
      {Array.from({ length: bars }).map((_, index) => {
        const height = isActive 
          ? Math.max(4, audioLevel * 32 + Math.random() * 8)
          : 4;
        
        return (
          <div
            key={index}
            className={cn(
              'bg-current rounded-full transition-all duration-75',
              isActive ? 'opacity-70' : 'opacity-30'
            )}
            style={{
              width: '3px',
              height: `${height}px`,
              animationDelay: `${index * 50}ms`
            }}
          />
        );
      })}
    </div>
  );
};

export default AudioVisualizer;