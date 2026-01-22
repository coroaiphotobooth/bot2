
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Concept, PhotoboothSettings } from './types';
import { DEFAULT_CONCEPTS, DEFAULT_SETTINGS, DEFAULT_GAS_URL } from './constants';
import { fetchSettings, fetchEvents } from './lib/appsScript';
import LandingPage from './pages/LandingPage';
import ThemesPage from './pages/ThemesPage';
import CameraPage from './pages/CameraPage';
import ResultPage from './pages/ResultPage';
import GalleryPage from './pages/GalleryPage';
import AdminPage from './pages/AdminPage';
import MonitorPage from './pages/MonitorPage';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<AppState>(AppState.LANDING);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [settings, setSettings] = useState<PhotoboothSettings>(DEFAULT_SETTINGS);
  const [concepts, setConcepts] = useState<Concept[]>(DEFAULT_CONCEPTS);
  const autoResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Force update the LocalStorage GAS URL to the new Default constant if it differs.
    // This fixes "Failed to fetch" errors when the deployment ID changes in constants.tsx
    // but the browser still holds the old URL in localStorage.
    const currentStoredUrl = localStorage.getItem('APPS_SCRIPT_BASE_URL');
    if (currentStoredUrl !== DEFAULT_GAS_URL) {
       console.log("Updating APPS_SCRIPT_BASE_URL to new default:", DEFAULT_GAS_URL);
       localStorage.setItem('APPS_SCRIPT_BASE_URL', DEFAULT_GAS_URL);
    }

    // 1. Muat dari Local Storage dulu untuk kecepatan
    const savedSettings = localStorage.getItem('pb_settings');
    const savedConcepts = localStorage.getItem('pb_concepts');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    if (savedConcepts) setConcepts(JSON.parse(savedConcepts));
    
    // 2. Sinkronisasi dari Cloud untuk mendapatkan data terbaru
    const syncCloud = async () => {
      try {
        const res = await fetchSettings();
        if (res.ok) {
          setSettings(prev => ({ ...prev, ...res.settings }));
          // Jika ada konsep di cloud, gunakan itu
          if (res.concepts && Array.isArray(res.concepts)) {
            setConcepts(res.concepts);
            localStorage.setItem('pb_concepts', JSON.stringify(res.concepts));
          }
        }
        
        const events = await fetchEvents();
        const active = events.find(e => e.isActive);
        if (active) {
          setSettings(prev => ({
            ...prev,
            eventName: active.name,
            eventDescription: active.description,
            folderId: active.folderId,
            activeEventId: active.id
          }));
        }
      } catch (e) {
        console.warn("Cloud sync error:", e);
      }
    };
    syncCloud();
  }, []);

  useEffect(() => {
    if (autoResetTimer.current) clearTimeout(autoResetTimer.current);
    if (currentPage === AppState.RESULT) {
      autoResetTimer.current = setTimeout(() => { handleReset(); }, settings.autoResetTime * 1000);
    }
    return () => { if (autoResetTimer.current) clearTimeout(autoResetTimer.current); };
  }, [currentPage, settings.autoResetTime]);

  const handleReset = () => {
    setCurrentPage(AppState.LANDING);
    setSelectedConcept(null);
    setCapturedImage(null);
  };

  const renderPage = () => {
    switch (currentPage) {
      case AppState.LANDING:
        return <LandingPage onStart={() => setCurrentPage(AppState.THEMES)} onGallery={() => setCurrentPage(AppState.GALLERY)} onAdmin={() => setCurrentPage(AppState.ADMIN)} settings={settings} />;
      case AppState.THEMES:
        return <ThemesPage concepts={concepts} onSelect={(c) => { setSelectedConcept(c); setCurrentPage(AppState.CAMERA); }} onBack={() => setCurrentPage(AppState.LANDING)} />;
      case AppState.CAMERA:
        return <CameraPage onCapture={(img) => setCapturedImage(img)} onBack={() => setCurrentPage(AppState.THEMES)} onGenerate={() => setCurrentPage(AppState.GENERATING)} capturedImage={capturedImage} orientation={settings.orientation} cameraRotation={settings.cameraRotation} />;
      case AppState.GENERATING:
        return <ResultPage capturedImage={capturedImage!} concept={selectedConcept!} settings={settings} onDone={handleReset} onGallery={() => setCurrentPage(AppState.GALLERY)} />;
      case AppState.GALLERY:
        return <GalleryPage onBack={() => setCurrentPage(AppState.LANDING)} activeEventId={settings.activeEventId} />;
      case AppState.ADMIN:
        return <AdminPage settings={settings} concepts={concepts} onSaveSettings={(s) => { setSettings(s); localStorage.setItem('pb_settings', JSON.stringify(s)); }} onSaveConcepts={(c) => { setConcepts(c); localStorage.setItem('pb_concepts', JSON.stringify(c)); }} onBack={() => setCurrentPage(AppState.LANDING)} onLaunchMonitor={() => setCurrentPage(AppState.MONITOR)} />;
      case AppState.MONITOR:
        return <MonitorPage onBack={() => setCurrentPage(AppState.ADMIN)} activeEventId={settings.activeEventId} eventName={settings.eventName} monitorSize={settings.monitorImageSize} />;
      default:
        return <LandingPage onStart={() => setCurrentPage(AppState.THEMES)} onGallery={() => setCurrentPage(AppState.GALLERY)} onAdmin={() => setCurrentPage(AppState.ADMIN)} settings={settings} />;
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#050505] flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden font-sans">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-purple-600 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-blue-600 blur-[150px] rounded-full" />
      </div>
      <div className="relative z-10 w-full flex flex-col items-center">
        {renderPage()}
      </div>
    </div>
  );
};

export default App;
