
import React, { useEffect, useRef, useState } from 'react';
import { GalleryItem } from '../types';
import { fetchGallery } from '../lib/appsScript';

interface MonitorPageProps {
  onBack: () => void;
  activeEventId?: string;
  eventName?: string;
  monitorSize?: 'small' | 'medium' | 'large';
}

interface PhysicsItem {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  element: HTMLDivElement;
  item: GalleryItem;
  isDragging: boolean;
}

const MonitorPage: React.FC<MonitorPageProps> = ({ onBack, activeEventId, eventName, monitorSize = 'medium' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<string, PhysicsItem>>(new Map());
  const requestRef = useRef<number | null>(null);
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Constants
  const getDimensions = () => {
    switch(monitorSize) {
      case 'small': return { w: 150, h: 225 };
      case 'large': return { w: 400, h: 600 };
      default: return { w: 250, h: 375 }; // Medium
    }
  };

  const { w: CARD_WIDTH, h: CARD_HEIGHT } = getDimensions();

  const MAX_SPEED = 2;
  const DAMPING = 0.99; // Air resistance
  const BOUNCE = 0.8; // Wall bounce energy retention

  // -- 1. Data Polling --
  useEffect(() => {
    const loadData = async () => {
      try {
        const galleryItems = await fetchGallery(activeEventId);
        
        // Filter ONLY PHOTOS for Monitor Page
        const photoItems = galleryItems.filter(item => item.type !== 'video');
        
        // Add new items only
        photoItems.forEach(item => {
          if (!itemsRef.current.has(item.id) && containerRef.current) {
            createPhysicsItem(item);
          }
        });

        // Optional: Remove items that are no longer in the list (if deleted)
        const currentIds = new Set(photoItems.map(i => i.id));
        itemsRef.current.forEach((val, key) => {
            if (!currentIds.has(key)) {
                val.element.remove();
                itemsRef.current.delete(key);
            }
        });

      } catch (e) {
        console.error("Monitor polling error", e);
      }
    };

    loadData();
    const interval = setInterval(loadData, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [activeEventId]);


  // -- 2. Physics Engine Setup --
  const createPhysicsItem = (item: GalleryItem) => {
    if (!containerRef.current) return;

    const div = document.createElement('div');
    div.className = "absolute top-0 left-0 rounded-xl overflow-hidden border border-white/20 shadow-[0_0_15px_rgba(188,19,254,0.3)] cursor-grab active:cursor-grabbing select-none touch-none bg-black/50 backdrop-blur-sm transition-transform will-change-transform";
    div.style.width = `${CARD_WIDTH}px`;
    div.style.height = `${CARD_HEIGHT}px`;
    
    // Content
    const imgUrl = item.imageUrl.includes('lh3') 
      ? `https://drive.google.com/thumbnail?id=${item.id}&sz=w600` 
      : item.imageUrl;

    div.innerHTML = `
      <div class="relative w-full h-full pointer-events-none">
        <img src="${imgUrl}" class="w-full h-full object-cover opacity-90" draggable="false" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
        <div class="absolute bottom-3 left-3 right-3 text-white">
           <p class="text-[10px] font-heading tracking-widest uppercase truncate">${item.conceptName}</p>
        </div>
      </div>
    `;

    // Random Start Position & Velocity
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    
    const x = Math.random() * (containerW - CARD_WIDTH);
    const y = Math.random() * (containerH - CARD_HEIGHT);
    const vx = (Math.random() - 0.5) * MAX_SPEED;
    const vy = (Math.random() - 0.5) * MAX_SPEED;

    containerRef.current.appendChild(div);

    const physicsObj: PhysicsItem = {
      id: item.id,
      x, y, vx, vy,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      element: div,
      item: item,
      isDragging: false
    };

    itemsRef.current.set(item.id, physicsObj);
    attachInteractions(div, physicsObj);
  };

  const attachInteractions = (element: HTMLElement, obj: PhysicsItem) => {
    let startX = 0, startY = 0;
    let lastX = 0, lastY = 0;
    let startTime = 0;
    let velocityTrackerX = 0;
    let velocityTrackerY = 0;

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      obj.isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      startTime = Date.now();
      
      // Move to front (z-index)
      element.style.zIndex = "100";
      itemsRef.current.forEach((val) => { if(val !== obj) val.element.style.zIndex = "1"; });
      
      element.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!obj.isDragging) return;
      
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      
      obj.x += dx;
      obj.y += dy;
      
      velocityTrackerX = dx; // Simple instant velocity
      velocityTrackerY = dy;
      
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      if (!obj.isDragging) return;
      obj.isDragging = false;
      element.releasePointerCapture(e.pointerId);

      // Check for Click vs Drag
      const dist = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
      const timeDiff = Date.now() - startTime;
      
      if (dist < 10 && timeDiff < 300) {
        // It's a click
        setLightboxItem(obj.item);
      } else {
        // It's a throw
        obj.vx = Math.min(Math.max(velocityTrackerX * 1.5, -15), 15); // Cap throw speed
        obj.vy = Math.min(Math.max(velocityTrackerY * 1.5, -15), 15);
      }
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
  };


  // -- 3. Physics Loop --
  const animate = () => {
    if (!containerRef.current) return;
    
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;

    const items: PhysicsItem[] = Array.from(itemsRef.current.values());

    for (let i = 0; i < items.length; i++) {
      const p1 = items[i];
      if (p1.isDragging) {
        // Just render position
        p1.element.style.transform = `translate(${p1.x}px, ${p1.y}px) scale(1.05)`;
        continue;
      }

      // Update position
      p1.x += p1.vx;
      p1.y += p1.vy;

      // Apply Friction
      p1.vx *= DAMPING;
      p1.vy *= DAMPING;

      // Wall Collision
      if (p1.x <= 0) {
        p1.x = 0;
        p1.vx *= -BOUNCE;
      } else if (p1.x + p1.width >= containerW) {
        p1.x = containerW - p1.width;
        p1.vx *= -BOUNCE;
      }

      if (p1.y <= 0) {
        p1.y = 0;
        p1.vy *= -BOUNCE;
      } else if (p1.y + p1.height >= containerH) {
        p1.y = containerH - p1.height;
        p1.vy *= -BOUNCE;
      }

      // Object Collision (Simple separation)
      for (let j = i + 1; j < items.length; j++) {
        const p2 = items[j];
        if (p2.isDragging) continue;

        // Center points
        const c1x = p1.x + p1.width / 2;
        const c1y = p1.y + p1.height / 2;
        const c2x = p2.x + p2.width / 2;
        const c2y = p2.y + p2.height / 2;

        const dx = c2x - c1x;
        const dy = c2y - c1y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = p1.width * 0.9; // Slightly smaller than full width to allow overlap feels better

        if (dist < minDist && dist > 0) {
           // Normal vector
           const nx = dx / dist;
           const ny = dy / dist;

           // Separation amount
           const separation = (minDist - dist) / 2;
           
           // Separate
           p1.x -= nx * separation;
           p1.y -= ny * separation;
           p2.x += nx * separation;
           p2.y += ny * separation;

           // Exchange velocity (elastic-ish)
           // Simple approach: swap velocities slightly modified by normal
           const k = 0.5; // bounciness factor between objects
           p1.vx -= nx * k;
           p1.vy -= ny * k;
           p2.vx += nx * k;
           p2.vy += ny * k;
        }
      }

      // Add small random drift if stopped
      if (Math.abs(p1.vx) < 0.1 && Math.abs(p1.vy) < 0.1) {
         p1.vx += (Math.random() - 0.5) * 0.2;
         p1.vy += (Math.random() - 0.5) * 0.2;
      }

      // Render
      p1.element.style.transform = `translate(${p1.x}px, ${p1.y}px)`;
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // -- 4. Utils --
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleShuffle = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    itemsRef.current.forEach(item => {
      item.vx = (Math.random() - 0.5) * 20; // Big impulse
      item.vy = (Math.random() - 0.5) * 20;
    });
  };

  const getShareUrl = (item: GalleryItem) => {
    if (item.downloadUrl && item.downloadUrl.includes('drive.google.com')) return item.downloadUrl;
    return `https://drive.google.com/file/d/${item.id}/view`;
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#050505] overflow-hidden overscroll-none touch-none">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,#1a0b2e_0%,#000000_100%)]">
        {/* Simple Stars */}
        <div className="absolute inset-0 opacity-30" style={{backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '50px 50px'}}></div>
      </div>

      {/* Physics Container */}
      <div ref={containerRef} className="absolute inset-0 z-10 overflow-hidden" />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 p-6 z-20 flex justify-between w-full pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-white font-heading text-xl uppercase tracking-[0.3em] neon-text italic">
            {eventName || "CORO AI MONITOR"}
          </h1>
          <p className="text-purple-400 text-[10px] font-mono tracking-widest mt-1">LIVE FEED_</p>
        </div>
        
        <div className="flex gap-4 pointer-events-auto">
           <button onClick={handleShuffle} className="bg-white/10 hover:bg-purple-600 text-white px-4 py-2 rounded-full text-[10px] uppercase tracking-widest backdrop-blur-md transition-colors border border-white/10">
             SHUFFLE
           </button>
           <button onClick={toggleFullscreen} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full backdrop-blur-md transition-colors border border-white/10">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
           </button>
           <button onClick={onBack} className="bg-red-900/50 hover:bg-red-800 text-white p-2 rounded-full backdrop-blur-md transition-colors border border-red-500/30">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
      </div>

      {/* Lightbox Overlay */}
      {lightboxItem && (
        <div 
          className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-8 animate-[popIn_0.2s_ease-out]"
          onClick={() => setLightboxItem(null)}
        >
          <div className="relative max-w-6xl max-h-full flex flex-col md:flex-row items-center gap-8 bg-black/50 p-6 rounded-2xl border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            
            {/* Image Section */}
            <div className="flex-1 flex justify-center max-h-[70vh]">
              <img 
                 src={lightboxItem.imageUrl.includes('lh3') ? `https://drive.google.com/thumbnail?id=${lightboxItem.id}&sz=w1200` : lightboxItem.imageUrl}
                 className="max-w-full max-h-full rounded-lg shadow-2xl border border-white/10 object-contain"
              />
            </div>

            {/* Info & QR Section */}
            <div className="flex flex-col items-center justify-center text-center gap-6 min-w-[250px]">
              <div>
                <h2 className="text-xl md:text-2xl text-white font-heading uppercase italic">{lightboxItem.conceptName}</h2>
                <p className="text-purple-400 font-mono text-xs tracking-widest mt-1">{new Date(lightboxItem.createdAt).toLocaleString()}</p>
              </div>

              {/* QR CODE */}
              <div className="bg-white p-3 rounded-xl shadow-inner group">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getShareUrl(lightboxItem))}`} 
                  alt="QR Code" 
                  className="w-40 h-40 object-contain" 
                />
              </div>
              <p className="text-white/60 text-[10px] uppercase tracking-[0.2em]">Scan to Download</p>

              <button 
                onClick={() => window.open(getShareUrl(lightboxItem), '_blank')}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-heading text-xs tracking-widest uppercase rounded shadow-lg transition-all"
              >
                Open Link
              </button>
            </div>
            
            <button 
              onClick={() => setLightboxItem(null)}
              className="absolute -top-4 -right-4 md:-top-6 md:-right-6 bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:scale-110 transition-transform shadow-lg z-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default MonitorPage;
