
import React, { useEffect, useState, useRef } from 'react';
import { Concept, PhotoboothSettings, AspectRatio } from '../types';
import { generateAIImage, generateVeoVideo } from '../lib/gemini';
import { uploadToDrive, uploadVideoToDrive } from '../lib/appsScript';

interface ResultPageProps {
  capturedImage: string;
  concept: Concept;
  settings: PhotoboothSettings;
  onDone: () => void;
  onGallery: () => void;
}

interface UploadResult {
  downloadUrl: string;
  shareUrl: string;
}

const ResultPage: React.FC<ResultPageProps> = ({ capturedImage, concept, settings, onDone, onGallery }) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoProcessing, setIsVideoProcessing] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'info'} | null>(null);
  
  // Separate states for Photo and Video uploads
  const [photoUploadData, setPhotoUploadData] = useState<UploadResult | null>(null);
  const [videoUploadData, setVideoUploadData] = useState<UploadResult | null>(null);
  
  const [showQR, setShowQR] = useState(false);
  const [progress, setProgress] = useState("AI_CORE_PROCESSING");
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Determine Target Dimensions for Canvas Processing (High Res)
  let targetWidth = 1080;
  let targetHeight = 1920;
  let displayAspectRatio = '9/16';

  const outputRatio: AspectRatio = settings.outputRatio || '9:16';

  switch (outputRatio) {
    case '16:9':
      targetWidth = 1920;
      targetHeight = 1080;
      displayAspectRatio = '16/9';
      break;
    case '9:16':
      targetWidth = 1080;
      targetHeight = 1920;
      displayAspectRatio = '9/16';
      break;
    case '3:2':
      targetWidth = 1800;
      targetHeight = 1200;
      displayAspectRatio = '3/2';
      break;
    case '2:3':
      targetWidth = 1200;
      targetHeight = 1800;
      displayAspectRatio = '2/3';
      break;
  }

  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(prev => prev + 1), 1000);

    const processFlow = async () => {
      try {
        // 1. Generate AI Image
        setProgress("Processing...");
        const aiOutput = await generateAIImage(capturedImage, concept.prompt, outputRatio);
        
        // 2. Tempel Overlay PNG & Crop
        setProgress("APPLYING_FRAME_OVERLAY...");
        const finalImage = await applyOverlay(aiOutput, settings.overlayImage);
        
        // 3. Update UI
        setResultImage(finalImage);
        setIsProcessing(false);
        if (timerRef.current) clearInterval(timerRef.current);
        
        // 4. Upload ke Google Drive
        await performPhotoUpload(finalImage);
        
      } catch (err: any) {
        console.error("Process Flow Error:", err);
        setError(err.message || "Transformation failed. Neural link unstable.");
        setIsProcessing(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    processFlow();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [capturedImage, concept, settings, outputRatio]);

  const performPhotoUpload = async (image: string) => {
    setNotification(null);
    setProgress("UPLOADING_TO_ARCHIVE...");
    
    try {
      const res = await uploadToDrive(image, {
        conceptName: concept.name,
        eventName: settings.eventName,
        eventId: settings.activeEventId,
        folderId: settings.folderId
      });
      
      if (res.ok) {
        setPhotoUploadData({ downloadUrl: res.imageUrl, shareUrl: res.viewUrl });
      } else {
        console.error("Upload failed", res);
        setNotification({ message: "PHOTO CLOUD SYNC FAILED", type: 'error' });
      }
    } catch (e) {
      console.error("Upload Exception", e);
      setNotification({ message: "NETWORK ERROR DURING UPLOAD", type: 'error' });
    }
  };

  // Sync Audio with Video Loop
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    if (videoUrl && settings.backgroundAudio && video && audio) {
        const handleEnded = () => {
            video.currentTime = 0;
            audio.currentTime = 0;
            video.play().catch(e => console.log("Replay video failed", e));
            audio.play().catch(e => console.log("Replay audio failed", e));
        };

        video.addEventListener('ended', handleEnded);
        
        video.play().catch(e => console.log("Auto-play video prevented", e));
        audio.play().catch(e => console.log("Auto-play audio prevented", e));
        
        return () => {
           video.removeEventListener('ended', handleEnded);
        };
    } else if (videoUrl && video) {
        video.play().catch(e => console.log("Auto-play video prevented", e));
    }
  }, [videoUrl, settings.backgroundAudio]);

  const applyOverlay = async (base64AI: string, overlayUrl: string | null): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context unavailable");

    const loadImg = (src: string, isCors = false): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        if (isCors) img.crossOrigin = "Anonymous";
        img.referrerPolicy = "no-referrer"; 
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error("Image load error"));
        img.src = src;
      });
    };

    try {
      const baseImg = await loadImg(base64AI);
      const scale = Math.max(targetWidth / baseImg.width, targetHeight / baseImg.height);
      const x = (targetWidth / 2) - (baseImg.width / 2) * scale;
      const y = (targetHeight / 2) - (baseImg.height / 2) * scale;
      ctx.drawImage(baseImg, x, y, baseImg.width * scale, baseImg.height * scale);

      if (overlayUrl && overlayUrl.trim() !== '') {
        const getDriveId = (url: string) => {
           const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
           return match ? match[1] : null;
        };

        const driveId = getDriveId(overlayUrl);
        
        const attempts = [
           driveId ? `https://lh3.googleusercontent.com/d/${driveId}` : null,
           overlayUrl,
           driveId ? `https://drive.google.com/uc?export=view&id=${driveId}` : null
        ].filter(Boolean) as string[];

        let applied = false;

        for (const url of attempts) {
            if (applied) break;
            const cacheBuster = url.includes('?') ? '&t=' : '?t=';
            const freshUrl = url + cacheBuster + Date.now();

            try {
                const ovrImg = await loadImg(freshUrl, true);
                ctx.drawImage(ovrImg, 0, 0, targetWidth, targetHeight);
                applied = true;
            } catch (errA) {
                try {
                    const resp = await fetch(freshUrl, { mode: 'cors', cache: 'no-cache' });
                    if (!resp.ok) throw new Error("Fetch failed");
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const ovrImg = await loadImg(blobUrl, false);
                    ctx.drawImage(ovrImg, 0, 0, targetWidth, targetHeight);
                    URL.revokeObjectURL(blobUrl);
                    applied = true;
                } catch (errB) {
                   // Silent fail
                }
            }
        }
      }

      return canvas.toDataURL('image/jpeg', 0.92);

    } catch (err) {
      console.error("Canvas composition error:", err);
      return base64AI;
    }
  };

  const handleGenerateVideo = async () => {
    const win = window as any;
    
    // Initial Key Check for IDX environment
    if (win.aistudio) {
      try {
        const hasKey = await win.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await win.aistudio.openSelectKey();
        }
      } catch (e) {
        console.error("API Key check failed", e);
      }
    }

    if (!resultImage) return;
    setIsVideoProcessing(true);
    setError(null);
    setNotification(null);
    setTimer(0);
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTimer(prev => prev + 1), 1000);

    try {
      setProgress("OPTIMIZING_ASSETS_FOR_VEO...");
      
      // Removed optimization to fix pixelation - sending full quality image to Veo
      const optimizedImage = resultImage;

      setProgress("VIDEO PROCESSING...");
      
      const videoBlob = await generateVeoVideo(optimizedImage, settings.videoPrompt, settings.outputRatio);
      
      const localUrl = URL.createObjectURL(videoBlob);
      setVideoUrl(localUrl);
      
      setProgress("UPLOADING_VIDEO_SIGNAL...");
      const res = await uploadVideoToDrive(videoBlob, {
          conceptName: concept.name + " (VIDEO)",
          eventName: settings.eventName,
          eventId: settings.activeEventId,
          folderId: settings.folderId
      });
      
      if (res.ok) {
        setVideoUploadData({ downloadUrl: res.imageUrl, shareUrl: res.viewUrl });
      } else {
        setNotification({ message: "VIDEO UPLOAD FAILED. SAVING LOCAL COPY...", type: 'error' });
      }
      
    } catch (err: any) {
      console.error("Video Gen Error:", err);
      const errString = err.message || JSON.stringify(err);
      
      if (errString.includes("PERMISSION_DENIED") || errString.includes("ENTITY_NOT_FOUND")) {
        setNotification({ 
          message: "PREMIUM FEATURE LOCKED. VIDEO SKIPPED. SAVED PHOTO ONLY.", 
          type: 'error' 
        });
        setVideoUrl(null); 
        setShowQR(true);
      } else {
         setNotification({ message: "VIDEO FAILED: " + (err.message || "Unknown Error"), type: 'error' });
      }
    } finally {
      setIsVideoProcessing(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const currentUploadData = videoUrl ? videoUploadData : photoUploadData;

  if (isProcessing || isVideoProcessing) {
    return (
      <div className="w-full h-[100dvh] flex flex-col items-center justify-center relative p-6 text-center overflow-hidden bg-black">
        <div className="absolute inset-0 z-0 flex items-center justify-center p-4">
          <img src={capturedImage} className="max-w-full max-h-full object-contain opacity-50 blur-lg" alt="Preview" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative w-40 h-40 md:w-64 md:h-64 mb-8 shrink-0">
            <div className="absolute inset-0 border-[6px] border-white/5 rounded-full" />
            <div className="absolute inset-0 border-[6px] border-t-purple-500 rounded-full animate-spin shadow-[0_0_30px_rgba(188,19,254,0.4)]" />
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-[10px] tracking-[0.3em] text-purple-400 font-bold mb-1 uppercase italic">Processing</span>
              <span className="text-3xl md:text-5xl font-heading text-white italic">{timer}S</span>
            </div>
          </div>
          <div className="max-w-md bg-black/40 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
            <h2 className="text-xl md:text-2xl font-heading mb-3 neon-text italic uppercase tracking-tighter">{progress}</h2>
            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mb-3">
              <div className="bg-purple-500 h-full animate-[progress_10s_ease-in-out_infinite]" style={{width: '60%'}} />
            </div>
            <p className="text-gray-400 font-mono text-[9px] tracking-[0.2em] uppercase leading-relaxed">
              {isVideoProcessing ? "CORO.AI VIDEO GENERATE" : "CORO.AI IMAGE GENERATE"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[100dvh] flex flex-col items-center justify-center p-6 text-center bg-[#050505]">
        <div className="w-20 h-20 border-2 border-red-500/50 rounded-full flex items-center justify-center mb-8">
          <span className="text-red-500 text-4xl font-bold">!</span>
        </div>
        <h2 className="text-red-500 text-2xl font-heading mb-4 uppercase italic">Neural_Link_Severed</h2>
        <p className="text-gray-500 mb-10 max-w-xs font-mono text-xs uppercase tracking-widest">{error}</p>
        <button onClick={onDone} className="px-16 py-6 bg-white text-black font-heading font-bold uppercase italic tracking-[0.3em] hover:bg-purple-500 hover:text-white transition-all">REBOOT_SESSION</button>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#050505] overflow-hidden relative font-sans">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full animate-pulse" style={{animationDelay: '1s'}} />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full h-full flex flex-col items-center p-4 md:p-6 lg:p-8 gap-4 md:gap-6">
        
        {/* Media Area (Image or Video) */}
        <div className="flex-1 w-full min-h-0 flex items-center justify-center">
          <div 
            className={`relative border-4 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.7)] bg-gray-900 rounded-xl overflow-hidden transition-all duration-300`}
            style={{
              aspectRatio: displayAspectRatio,
              maxHeight: '100%',
              maxWidth: '100%'
            }}
          >
            {videoUrl ? (
              <>
                 <video 
                   ref={videoRef}
                   src={videoUrl} 
                   className="w-full h-full object-cover" 
                   autoPlay 
                   loop={!settings.backgroundAudio} 
                   playsInline 
                   muted={!settings.backgroundAudio} 
                 />
                 {settings.backgroundAudio && (
                   <audio ref={audioRef} src={settings.backgroundAudio} autoPlay loop={false} />
                 )}
              </>
            ) : (
              <img src={resultImage!} alt="Final Composition" className="w-full h-full object-cover" />
            )}

            {/* ERROR / INFO NOTIFICATION OVERLAY */}
            {notification && !showQR && (
               <div className={`absolute top-4 left-4 right-4 p-3 rounded text-center backdrop-blur z-40 border animate-[popIn_0.3s] ${notification.type === 'error' ? 'bg-red-900/80 border-red-500/50' : 'bg-blue-900/80 border-blue-500/50'}`}>
                 <p className="text-white text-[10px] font-bold uppercase tracking-widest">{notification.message}</p>
                 {notification.type === 'error' && !videoUrl && (
                    <button onClick={() => setNotification(null)} className="mt-2 text-[9px] underline text-white/70 hover:text-white">DISMISS</button>
                 )}
               </div>
            )}
            
            {/* Action Buttons Overlay (Photo Mode) - ALWAYS VISIBLE FOR KIOSK */}
            {!videoUrl && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 z-30">
                <button 
                  onClick={() => setShowQR(true)} 
                  disabled={!photoUploadData}
                  className={`bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-full font-heading text-[10px] tracking-[0.2em] uppercase italic transition-all shadow-lg border border-purple-400/30 ${!photoUploadData ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                >
                  {photoUploadData ? "SAVE PHOTO" : "UPLOADING..."}
                </button>

                {settings.enableVideoGeneration !== false && (
                  <button 
                    onClick={handleGenerateVideo} 
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-full font-heading text-[10px] tracking-[0.2em] uppercase italic transition-all shadow-lg border border-blue-400/30 active:scale-95"
                  >
                    GENERATE VIDEO
                  </button>
                )}
              </div>
            )}

            {/* Action Button Overlay (Video Mode) - ALWAYS VISIBLE FOR KIOSK */}
            {videoUrl && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-30">
                <button 
                  onClick={() => setShowQR(true)} 
                  disabled={!videoUploadData}
                  className={`bg-green-600 hover:bg-green-500 text-white px-5 py-3 rounded-full font-heading text-[10px] tracking-[0.2em] uppercase italic transition-all shadow-lg border border-green-400/30 active:scale-95 ${!videoUploadData ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {videoUploadData ? "SAVE VIDEO" : "UPLOADING..."}
                </button>
              </div>
            )}

            {/* QR Code Overlay (Centered) */}
            {showQR && currentUploadData && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-md p-5 rounded-2xl border border-white/20 shadow-2xl z-50 flex flex-col items-center animate-[popIn_0.3s_ease-out]">
                <button 
                   onClick={() => setShowQR(false)} 
                   className="absolute -top-3 -right-3 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold shadow-lg hover:scale-110 transition-transform z-50"
                >
                  ✕
                </button>
                
                <div className="bg-white p-2 rounded-xl shadow-inner mb-3">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentUploadData.shareUrl)}`} 
                    alt="Download QR" 
                    className="w-40 h-40 object-contain" 
                  />
                </div>
                
                <p className="text-white font-heading text-[10px] tracking-[0.2em] uppercase italic text-center text-purple-200">
                  {videoUrl ? "SCAN TO SAVE VIDEO" : "SCAN TO SAVE PHOTO"}
                </p>
                
                {/* Fallback Message in QR Modal */}
                {notification && notification.type === 'error' && (
                  <p className="mt-3 text-[9px] text-red-400 font-mono uppercase max-w-[200px] text-center border-t border-white/10 pt-2">
                    {notification.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="w-full max-w-lg shrink-0 flex gap-4 md:gap-6 z-20 pb-safe">
          <button 
            onClick={onDone} 
            className="flex-1 py-4 md:py-5 bg-white/5 border border-white/10 text-white font-heading tracking-[0.3em] hover:bg-white hover:text-black transition-all text-xs uppercase italic rounded-lg"
          >
            FINISH
          </button>
          {!videoUrl && (
             <button 
               onClick={onGallery} 
               className="flex-1 py-4 md:py-5 bg-purple-600/10 border border-purple-500/30 text-purple-400 font-heading tracking-[0.3em] hover:bg-purple-600/30 hover:text-purple-200 transition-all text-xs uppercase italic rounded-lg"
             >
               GALLERY
             </button>
          )}
        </div>

      </div>
      
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: translate(-50%, 20px) scale(0.9); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
      `}</style>
    </div>
  );
};

export default ResultPage;
