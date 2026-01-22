
import React, { useEffect, useState, useRef } from 'react';
import { GalleryItem } from '../types';
import { fetchGallery, deletePhotoFromGas, deleteAllPhotosFromGas } from '../lib/appsScript';

interface GalleryPageProps {
  onBack: () => void;
  activeEventId?: string;
}

const GalleryPage: React.FC<GalleryPageProps> = ({ onBack, activeEventId }) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tabs State
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  // QR Modal State
  const [showQR, setShowQR] = useState(false);

  // Delete Auth State
  const [showDeleteAuth, setShowDeleteAuth] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'all'>('single');
  const [deletePin, setDeletePin] = useState('');

  useEffect(() => {
    loadGallery();
    // Refresh every 30 seconds if in gallery
    const interval = setInterval(loadGallery, 30000);
    return () => clearInterval(interval);
  }, [activeEventId]);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!selectedItem && !showDeleteAuth) {
      setDeletePin('');
      setShowQR(false);
    }
    if (!selectedItem) {
      setShowQR(false);
    }
  }, [selectedItem, showDeleteAuth]);

  const loadGallery = async () => {
    try {
      const data = await fetchGallery(activeEventId);
      setItems(data);
      setError(null);
    } catch (err: any) {
      console.error("Gallery fetch error:", err);
      setError(`CONNECTION_ERROR`);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (item: GalleryItem) => {
    if (item.imageUrl && item.imageUrl.startsWith('http')) {
       if (item.imageUrl.includes('lh3.googleusercontent.com')) {
         return `https://drive.google.com/thumbnail?id=${item.id}&sz=w600`;
       }
       return item.imageUrl;
    }
    return `https://drive.google.com/thumbnail?id=${item.id}&sz=w600`;
  };

  const getShareUrl = (item: GalleryItem) => {
    if (item.downloadUrl && item.downloadUrl.includes('drive.google.com')) return item.downloadUrl;
    return `https://drive.google.com/file/d/${item.id}/view`;
  };

  const handleAuthDelete = (mode: 'single' | 'all') => {
    setDeleteMode(mode);
    setShowDeleteAuth(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletePin.trim()) {
      alert("Please enter PIN");
      return;
    }
    
    setIsDeleting(true);
    
    try {
      if (deleteMode === 'single') {
         if (!selectedItem) return;
         const res = await deletePhotoFromGas(selectedItem.id, deletePin);
         if (res.ok) {
           setItems(prev => prev.filter(item => item.id !== selectedItem.id));
           setSelectedItem(null);
           setShowDeleteAuth(false);
         } else {
           alert("DELETE FAILED: " + (res.error || "Wrong PIN"));
         }
      } else {
         // DELETE ALL MODE
         const res = await deleteAllPhotosFromGas(deletePin);
         if (res.ok) {
           setItems([]);
           setShowDeleteAuth(false);
           // Monitor page polling will automatically clear itself when it sees 0 items next poll
         } else {
            alert("DELETE ALL FAILED: " + (res.error || "Wrong PIN"));
         }
      }
    } catch (e: any) {
      alert("CONNECTION ERROR: " + e.message);
    } finally {
      setIsDeleting(false);
      setDeletePin('');
    }
  };

  // Filter Logic
  const filteredItems = items.filter(item => {
    if (activeTab === 'video') {
      return item.type === 'video';
    }
    // Default to image (handles undefined type as image for legacy data)
    return item.type !== 'video';
  });

  return (
    <div className="w-full min-h-screen flex flex-col p-6 md:p-12 bg-[#050505] overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-center w-full mb-8 max-w-7xl mx-auto gap-6 shrink-0 relative">
        <button onClick={onBack} className="text-white flex items-center gap-3 hover:text-purple-400 uppercase tracking-[0.3em] font-bold transition-all group shrink-0">
          <svg className="w-6 h-6 transform group-hover:-translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          BACK
        </button>
        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-heading text-white neon-text italic uppercase tracking-tighter">EVENT GALLERY</h2>
          <p className="text-[10px] md:text-xs text-purple-400 tracking-[0.6em] uppercase mt-2 font-bold italic">
            {activeEventId ? 'ACTIVE ARCHIVE' : 'CENTRAL ARCHIVE'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {items.length > 0 && (
            <button 
              onClick={() => handleAuthDelete('all')} 
              className="text-[10px] bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 px-3 py-2 rounded uppercase tracking-widest transition-all"
            >
              CLEAR GALLERY
            </button>
          )}
          <button onClick={loadGallery} className="p-2 text-white/40 hover:text-white transition-colors">
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {/* TABS CONTAINER */}
      <div className="flex justify-center gap-4 mb-8 w-full max-w-7xl mx-auto">
        <button 
          onClick={() => setActiveTab('image')} 
          className={`px-8 py-3 rounded border font-heading text-xs tracking-[0.2em] uppercase italic transition-all ${activeTab === 'image' ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_20px_rgba(147,51,234,0.5)]' : 'bg-white/5 text-white/40 border-white/10 hover:text-white hover:border-white/30'}`}
        >
          IMAGE RESULT
        </button>
        <button 
          onClick={() => setActiveTab('video')} 
          className={`px-8 py-3 rounded border font-heading text-xs tracking-[0.2em] uppercase italic transition-all ${activeTab === 'video' ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.5)]' : 'bg-white/5 text-white/40 border-white/10 hover:text-white hover:border-white/30'}`}
        >
          VIDEO RESULT
        </button>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-2">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin shadow-purple-500/20" />
            <span className="text-purple-400 font-mono text-xs tracking-[0.5em] animate-pulse">RETRIEVING DATA...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
             <h3 className="text-red-500 font-heading text-xl uppercase italic">Database Offline</h3>
             <button onClick={loadGallery} className="text-white/60 hover:text-white underline font-mono text-xs">TRY AGAIN</button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] opacity-30 text-center">
             <h3 className="text-2xl font-heading mb-3 text-white tracking-widest uppercase italic">
               {activeTab === 'video' ? 'NO_VIDEO_SIGNALS' : 'NO_IMAGE_DATA'}
             </h3>
             <p className="font-mono text-[10px]">
               {activeTab === 'video' ? 'No generated videos found in archive.' : 'No photos found for this event.'}
             </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-32 animate-[popIn_0.5s_ease-out]">
            {filteredItems.map((item, idx) => (
              <div 
                key={item.id || idx} 
                onClick={() => setSelectedItem(item)} 
                className={`group relative aspect-[9/16] overflow-hidden bg-white/5 border cursor-pointer hover:border-purple-500 transition-all rounded-lg shadow-xl ${activeTab === 'video' ? 'border-blue-500/30' : 'border-white/10'}`}
              >
                <img 
                  src={getImageUrl(item)} 
                  alt={item.conceptName} 
                  loading="lazy" 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://drive.google.com/thumbnail?id=${item.id}&sz=w400`;
                  }}
                />
                
                {item.type === 'video' && (
                  <div className="absolute top-2 right-2 bg-blue-600/80 p-1.5 rounded-full backdrop-blur-sm z-10 shadow-lg">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <span className="text-white font-heading text-[10px] tracking-widest border border-white/40 px-3 py-1">
                     {item.type === 'video' ? 'PLAY VIDEO' : 'VIEW PHOTO'}
                   </span>
                </div>
                <div className="absolute bottom-0 left-0 p-4 w-full bg-gradient-to-t from-black via-black/60 to-transparent">
                  <p className="text-white text-[10px] font-heading tracking-widest truncate uppercase italic">{item.conceptName}</p>
                  <p className="text-white/40 text-[8px] font-mono mt-1">{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VIEW SINGLE MODAL - MODIFIED LAYOUT */}
      {selectedItem && !showDeleteAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 overflow-hidden">
          <div className="relative w-full h-full max-w-7xl flex items-center justify-center">
            
            {/* CLOSE BUTTON */}
            <button 
              onClick={() => setSelectedItem(null)} 
              className="absolute top-4 right-4 md:top-6 md:right-6 bg-white/10 hover:bg-white text-white/70 hover:text-black rounded-full w-10 h-10 flex items-center justify-center transition-all z-50 backdrop-blur-md border border-white/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            {/* MEDIA CONTAINER */}
            <div className="relative w-full h-full flex items-center justify-center">
              {selectedItem.type === 'video' ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                     </div>
                     <video 
                        key={selectedItem.id} 
                        src={`https://drive.google.com/uc?export=download&id=${selectedItem.id}`} 
                        className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/10 object-contain relative z-10 bg-black" 
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                        controls 
                      />
                  </div>
              ) : (
                <img 
                  src={getImageUrl(selectedItem).replace('sz=w600', 'sz=w1600')} 
                  className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/10 object-contain bg-black" 
                  alt="Preview" 
                />
              )}

              {/* OVERLAY BUTTONS - BOTTOM CENTER INSIDE/OVER IMAGE */}
              <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-3 z-30 pointer-events-none">
                  {/* Download Button */}
                  <button 
                    onClick={() => setShowQR(true)} 
                    className="pointer-events-auto flex items-center gap-3 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-heading text-sm tracking-[0.2em] uppercase italic rounded-full shadow-[0_0_20px_rgba(147,51,234,0.5)] border border-purple-400/50 transition-all active:scale-95 group"
                  >
                    <svg className="w-5 h-5 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
                    DOWNLOAD
                  </button>

                  {/* Remove Button (Below Download) */}
                  <button 
                    onClick={() => handleAuthDelete('single')} 
                    className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-red-900/40 text-red-400 hover:text-red-200 font-heading text-[10px] tracking-widest uppercase border border-white/10 hover:border-red-500/30 rounded backdrop-blur-md transition-all"
                  >
                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                     REMOVE FROM GALLERY
                  </button>
              </div>

            </div>

            {/* QR CODE POPUP MODAL */}
            {showQR && (
              <div 
                className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-[popIn_0.2s_ease-out]"
                onClick={() => setShowQR(false)}
              >
                <div 
                  className="bg-black/90 p-8 rounded-2xl border border-white/20 shadow-2xl flex flex-col items-center gap-6 relative max-w-sm w-full mx-4" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    onClick={() => setShowQR(false)} 
                    className="absolute -top-3 -right-3 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold shadow-lg hover:scale-110 transition-transform z-50"
                  >
                    ✕
                  </button>

                  <div className="text-center">
                    <h3 className="text-xl font-heading text-white neon-text italic uppercase">DOWNLOAD MEDIA</h3>
                    <p className="text-purple-400 text-[10px] font-mono tracking-widest mt-1">SCAN QR CODE TO SAVE</p>
                  </div>
                  
                  <div className="bg-white p-3 rounded-xl shadow-inner relative group cursor-pointer hover:scale-105 transition-transform">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getShareUrl(selectedItem))}`} 
                      className="w-48 h-48 object-contain" 
                      alt="QR Code" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 backdrop-blur-[1px]">
                       <span className="text-black font-bold text-xs uppercase tracking-widest bg-white px-2 py-1 rounded">Open Link</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => window.open(getShareUrl(selectedItem), '_blank')}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-heading text-xs tracking-widest uppercase border border-white/20 rounded transition-all"
                  >
                    OPEN DIRECT LINK
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* AUTH MODAL (SINGLE OR ALL) */}
      {showDeleteAuth && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-red-900/20 border border-red-500/30 p-6 rounded-xl flex flex-col gap-4 animate-[popIn_0.2s_ease-out]">
            <div className="text-center">
              <h4 className="text-red-500 font-heading uppercase italic">
                 {deleteMode === 'all' ? 'NUCLEAR OPTION DETECTED' : 'AUTHORIZATION REQUIRED'}
              </h4>
              <p className="text-white/60 text-[10px] font-mono mt-1">
                {deleteMode === 'all' 
                   ? 'Enter PIN to clear DATABASE. Files in Google Drive will REMAIN SAFE.'
                   : 'Enter Admin PIN to permanently delete this record.'
                }
              </p>
            </div>
            
            <input 
              type="password"
              inputMode="numeric"
              autoFocus
              placeholder="ENTER PIN"
              value={deletePin}
              onChange={(e) => setDeletePin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDeleteConfirm()}
              className="w-full bg-black/50 border border-white/10 p-4 text-center text-white font-mono text-xl tracking-[0.5em] focus:border-red-500 outline-none rounded"
            />

            <button 
              onClick={handleDeleteConfirm} 
              disabled={isDeleting}
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-heading uppercase tracking-widest transition-all shadow-lg mt-2"
            >
              {isDeleting ? "PROCESSING..." : deleteMode === 'all' ? "CONFIRM CLEAR ALL" : "CONFIRM DELETE"}
            </button>
            
            <button 
              onClick={() => { setShowDeleteAuth(false); setDeletePin(''); }} 
              disabled={isDeleting}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-heading uppercase text-xs tracking-widest transition-all"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default GalleryPage;
