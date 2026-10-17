import React, { useEffect, useRef } from 'react';
import { VideoProject, DubbingSegment, Speaker } from '../types';
import { RASAS } from '../data/rasas';

interface ProceduralVideoCanvasProps {
  project: VideoProject;
  currentTime: number;
  isPlaying: boolean;
  activeSegment: DubbingSegment | null;
  activeSpeaker: Speaker | null;
  subtitlesMode: 'devanagari' | 'iast' | 'dual' | 'off';
  isMuted: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export const ProceduralVideoCanvas: React.FC<ProceduralVideoCanvasProps> = ({
  project,
  currentTime,
  isPlaying,
  activeSegment,
  activeSpeaker,
  subtitlesMode,
  onCanvasReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (canvasRef.current && onCanvasReady) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let tick = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      tick += isPlaying ? 0.015 : 0.003;

      ctx.clearRect(0, 0, width, height);

      const theme = project.canvasTheme || 'cosmic';

      if (theme === 'cosmic') {
        // High-end science documentary: Deep space & planetary physics
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#0a0d18');
        bgGrad.addColorStop(0.5, '#040711');
        bgGrad.addColorStop(1, '#020307');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Distant stars
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        for (let i = 0; i < 80; i++) {
          const sx = (i * 123.4) % width;
          const sy = (i * 345.6 + currentTime * 6) % height;
          ctx.beginPath();
          ctx.arc(sx, sy, (i % 3) * 0.6 + 0.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Central Star / Planetary Body
        const cx = width / 2;
        const cy = height / 2 - 20;

        // Subtle glow
        const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 220);
        glow.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        glow.addColorStop(0.5, 'rgba(99, 102, 241, 0.1)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 220, 0, Math.PI * 2);
        ctx.fill();

        // Planet Body
        const planetGrad = ctx.createRadialGradient(cx - 20, cy - 20, 10, cx, cy, 75);
        planetGrad.addColorStop(0, '#38bdf8');
        planetGrad.addColorStop(0.6, '#1e40af');
        planetGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = planetGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 70, 0, Math.PI * 2);
        ctx.fill();

        // Precision Orbital Rings with Scientific HUD Data
        [130, 200, 280].forEach((rx, idx) => {
          const ry = rx * 0.38;
          ctx.strokeStyle = idx === 1 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(148, 163, 184, 0.15)';
          ctx.lineWidth = idx === 1 ? 1.5 : 1;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, -0.1, 0, Math.PI * 2);
          ctx.stroke();

          // Satellite / Orbiting body
          const angle = tick * (1.2 / (idx + 1)) + idx * 1.8;
          const px = cx + Math.cos(angle) * rx;
          const py = cy + Math.sin(angle) * ry;

          ctx.fillStyle = idx === 0 ? '#38bdf8' : idx === 1 ? '#818cf8' : '#34d399';
          ctx.beginPath();
          ctx.arc(px, py, 4 + idx, 0, Math.PI * 2);
          ctx.fill();

          // Telemetry coordinate marker
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
          ctx.fillText(`ORB-${idx + 1}: ${(px / 10).toFixed(1)} AU`, px + 8, py - 4);
        });

      } else if (theme === 'nature') {
        // Blue-chip nature documentary: Savanna landscape
        const nGrad = ctx.createLinearGradient(0, 0, 0, height);
        nGrad.addColorStop(0, '#0f172a');
        nGrad.addColorStop(0.4, '#1e293b');
        nGrad.addColorStop(0.7, '#064e3b');
        nGrad.addColorStop(1, '#022c22');
        ctx.fillStyle = nGrad;
        ctx.fillRect(0, 0, width, height);

        // Sun on horizon
        ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.beginPath();
        ctx.arc(width * 0.75, height * 0.45, 52, 0, Math.PI * 2);
        ctx.fill();

        // Horizon mountain silhouette
        ctx.fillStyle = '#022018';
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, height * 0.65);
        ctx.quadraticCurveTo(width * 0.3, height * 0.55, width * 0.6, height * 0.68);
        ctx.quadraticCurveTo(width * 0.85, height * 0.58, width, height * 0.64);
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        // Acacias tree silhouettes
        ctx.fillStyle = '#01140e';
        ctx.fillRect(width * 0.22, height * 0.58, 6, 90);
        ctx.beginPath();
        ctx.ellipse(width * 0.22 + 3, height * 0.58, 55, 14, 0, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Tech keynote: Neural grid & data telemetry
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);

        // Grid lines
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 45) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 45) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Animated waveforms & nodes
        const nodes = [
          { x: width * 0.2, y: height * 0.38, label: 'Audio In (EN)' },
          { x: width * 0.42, y: height * 0.28, label: 'Diarization & Voice' },
          { x: width * 0.65, y: height * 0.45, label: 'Phonetic Alignment' },
          { x: width * 0.84, y: height * 0.35, label: 'Sanskrit Dubbed (WAV)' },
        ];

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = 2;
        nodes.forEach((n, i) => {
          if (i < nodes.length - 1) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(nodes[i + 1].x, nodes[i + 1].y);
            ctx.stroke();
          }
        });

        nodes.forEach(n => {
          ctx.fillStyle = '#4f46e5';
          ctx.beginPath();
          ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#c7d2fe';
          ctx.beginPath();
          ctx.arc(n.x, n.y, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '11px "JetBrains Mono", monospace';
          ctx.fillStyle = '#e0e7ff';
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.x, n.y + 26);
        });
      }

      // Modern Broadcast Subtitle Overlay
      if (activeSegment && subtitlesMode !== 'off') {
        const subBoxWidth = width * 0.86;
        const subBoxX = (width - subBoxWidth) / 2;
        const subBoxY = height - 105;
        const subBoxH = 82;

        // Clean semi-transparent container
        ctx.fillStyle = 'rgba(9, 9, 11, 0.88)';
        ctx.strokeStyle = 'rgba(63, 63, 70, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(subBoxX, subBoxY, subBoxWidth, subBoxH, 10);
        ctx.fill();
        ctx.stroke();

        // Speaker pill tag
        if (activeSpeaker) {
          ctx.fillStyle = activeSpeaker.color || '#38bdf8';
          ctx.beginPath();
          ctx.arc(subBoxX + 20, subBoxY + 22, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#f4f4f5';
          ctx.textAlign = 'left';
          ctx.fillText(activeSpeaker.name, subBoxX + 32, subBoxY + 26);

          // Tone badge
          const emotion = RASAS[activeSegment.rasa];
          if (emotion) {
            ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#a1a1aa';
            const speakerWidth = ctx.measureText(activeSpeaker.name).width;
            ctx.fillText(`• ${emotion.label}`, subBoxX + 32 + speakerWidth + 8, subBoxY + 26);
          }
        }

        // Subtitle Text rendering
        ctx.textAlign = 'center';
        const centerX = width / 2;

        if (subtitlesMode === 'devanagari' || subtitlesMode === 'dual') {
          ctx.font = '600 19px "Noto Sans Devanagari", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(activeSegment.sanskritDevanagari, centerX, subBoxY + 52);
        }

        if (subtitlesMode === 'iast' || subtitlesMode === 'dual') {
          ctx.font = 'italic 13px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#d4d4d8';
          const yPos = subtitlesMode === 'dual' ? subBoxY + 72 : subBoxY + 54;
          ctx.fillText(activeSegment.sanskritIAST, centerX, yPos);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [project, currentTime, isPlaying, activeSegment, activeSpeaker, subtitlesMode]);

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-zinc-800 shadow-2xl flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="w-full h-full object-contain"
      />
    </div>
  );
};
