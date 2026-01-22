
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraPageProps {
  onCapture: (image: string) => void;
  onGenerate: () => void;
  onBack: () => void;
  capturedImage: string | null;
  orientation: 'portrait' | 'landscape';
  cameraRotation?: number; // 0, 90, 180, 270
}

const CameraPage: React.FC<CameraPageProps> = ({ onCapture, onGenerate, onBack, capturedImage, orientation, cameraRotation = 0 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const isPortrait = orientation === 'portrait';

  useEffect(() => {
    async function setupCamera() {
      try {
        // Meminta resolusi maksimal dari hardware untuk Preview yang tajam di layar
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 4096 }, 
            height: { ideal: 4096 }, 
            facingMode: 'user' 
          } 
        });
        setStream(mediaStream);
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
    setupCamera();
    return () => stream?.getTracks().forEach(track => track.stop());
  }, []);

  const capture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // 1. Dapatkan ukuran ASLI video dari webcam
      const vidW = video.videoWidth;
      const vidH = video.videoHeight;
      
      // Hitung dimensi akhir canvas (Tanpa Downscaling untuk Kualitas Maksimal)
      const destW = vidW;
      const destH = vidH;

      if (ctx && vidW && vidH) {
        // Cek apakah rotasi membuat dimensi tertukar (90 atau 270 derajat)
        const isRotated = cameraRotation % 180 !== 0;

        // Set ukuran canvas sesuai dimensi yang sudah di-resize
        canvas.width = isRotated ? destH : destW;
        canvas.height = isRotated ? destW : destH;
        
        ctx.save();
        
        // Pindahkan titik pusat ke tengah canvas untuk rotasi
        ctx.translate(canvas.width / 2, canvas.height / 2);
        
        // Putar canvas sesuai setting Admin
        ctx.rotate((cameraRotation * Math.PI) / 180);
        
        // Mirroring (Webcam standard)
        ctx.scale(-1, 1);

        // Gambar Video ke Canvas
        ctx.drawImage(video, -destW / 2, -destH / 2, destW, destH);
        
        ctx.restore();
        
        // Simpan sebagai JPEG kualitas 0.95
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        onCapture(dataUrl);
        
        // Lanjut ke proses generate
        onGenerate();
      }
    }
  }, [onCapture, onGenerate, cameraRotation]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          
          const width = img.width;
          const height = img.height;
          
          // Gunakan dimensi asli tanpa downscaling
          const destW = width;
          const destH = height;

          canvas.width = destW;
          canvas.height = destH;

          if (ctx) {
            // Gambar image upload (tanpa mirror/rotasi kamera karena file statis)
            ctx.drawImage(img, 0, 0, destW, destH);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            onCapture(dataUrl);
            onGenerate();
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const startCountdown = () => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(interval);
          capture();
          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);
  };

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-black relative overflow-hidden">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-40 bg-gradient-to-b from-black/60 to-transparent">
        <button 
          onClick={onBack} 
          className="text-white hover:text-purple-400 font-bold tracking-widest uppercase text-xs md:text-base transition-colors bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10"
        >
          BACK
        </button>
        <h2 className="text-sm md:text-2xl font-heading text-white neon-text italic uppercase drop-shadow-lg">Strike a Pose</h2>
        <div className="w-20" /> 
      </div>

      {/* Camera Preview Container - Full Size / Object Contain */}
      <div 
        className="relative flex items-center justify-center bg-gray-900 z-10 transition-all duration-500 ease-in-out border border-white/10"
        style={{
          width: '100%',
          height: '100%',
          maxHeight: '100vh',
          maxWidth: '100vw'
        }}
      >
        {!capturedImage ? (
          <>
            <div className="w-full h-full flex items-center justify-center overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="max-w-full max-h-full object-contain"
                style={{ 
                   transform: `rotate(${cameraRotation}deg) scaleX(-1)`,
                   width: cameraRotation % 180 !== 0 ? 'auto' : '100%',
                   height: cameraRotation % 180 !== 0 ? 'auto' : '100%',
                   maxHeight: cameraRotation % 180 !== 0 ? '90vw' : '100%',
                   maxWidth: cameraRotation % 180 !== 0 ? '90vh' : '100%',
                }}
              />
            </div>
            
            {/* HUD Overlay */}
            <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
               <div className="w-64 h-64 border border-white/20 rounded-full flex items-center justify-center opacity-30">
                   <div className="w-1 h-4 bg-purple-500/50" />
                   <div className="absolute h-1 w-4 bg-purple-500/50" />
               </div>
            </div>

            {countdown && (
              <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-[4px]">
                <span className="text-[120px] md:text-[250px] font-heading text-white neon-text animate-ping italic">{countdown}</span>
              </div>
            )}
            
            {/* Controls Container */}
            {!countdown && (
              <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center z-30 px-6 gap-8 pointer-events-none">
                
                {/* Spacer agar capture button tetap di tengah secara visual relative ke container */}
                <div className="w-16 h-16 hidden md:block" /> 

                {/* Capture Button (Center) */}
                <button 
                  onClick={startCountdown}
                  className="group pointer-events-auto relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center outline-none transition-transform active:scale-95"
                >
                  <div className="absolute inset-0 border-2 border-dashed border-purple-500/30 rounded-full animate-[spin_10s_linear_infinite]" />
                  <div className="absolute inset-2 border-2 border-white/20 rounded-full group-hover:border-purple-400/50 transition-colors duration-500" />
                  <div className="absolute inset-4 bg-white/5 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center group-hover:bg-purple-600/20 group-hover:border-purple-400 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] md:text-xs font-heading font-black text-white tracking-[0.2em] italic group-hover:neon-text">CAPTURE</span>
                    </div>
                  </div>
                </button>

                {/* Upload Button (Right Side) */}
                <div className="pointer-events-auto w-16 h-16 md:flex items-center justify-center">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-black/40 border border-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/10 hover:border-purple-500 transition-all group/upload"
                    title="Upload Image"
                  >
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-white/70 group-hover/upload:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </button>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileUpload} 
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <img src={capturedImage} alt="Capture" className="max-w-full max-h-full object-contain" />
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraPage;
