
import React from 'react';
import { Concept } from '../types';

interface ThemesPageProps {
  concepts: Concept[];
  onSelect: (concept: Concept) => void;
  onBack: () => void;
}

const ThemesPage: React.FC<ThemesPageProps> = ({ concepts, onSelect, onBack }) => {
  return (
    <div className="w-full min-h-screen flex flex-col items-center p-6 md:p-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="flex justify-between items-center w-full mb-8 max-w-6xl">
        <button onClick={onBack} className="text-white flex items-center gap-2 hover:text-purple-400 transition-colors uppercase font-bold tracking-widest text-xs md:text-base">
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          BACK
        </button>
        <div className="text-center">
          <h2 className="text-xl md:text-3xl font-heading text-white neon-text">CHOOSE CONCEPT</h2>
          <p className="text-[10px] text-purple-400 tracking-widest uppercase mt-1">Select your transformation</p>
        </div>
        <div className="hidden md:block w-20" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl w-full pb-16">
        {concepts.map((concept) => (
          <div 
            key={concept.id}
            onClick={() => onSelect(concept)}
            className="group relative h-[180px] md:h-[240px] cursor-pointer overflow-hidden rounded-lg border border-white/10 hover:border-purple-500 transition-all duration-300 shadow-lg hover:shadow-purple-500/20"
          >
            <img 
              src={concept.thumbnail} 
              alt={concept.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />
            <div className="absolute bottom-0 left-0 p-3 md:p-4 w-full">
              <h3 className="text-xs md:text-base font-heading text-white leading-tight mb-2 tracking-tight">{concept.name}</h3>
              <div className="h-0.5 w-8 bg-purple-500 group-hover:w-full transition-all duration-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThemesPage;
