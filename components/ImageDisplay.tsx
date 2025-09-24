
import React from 'react';
import LoadingSpinner from './icons/LoadingSpinner';

interface ImageDisplayProps {
  imageSrc: string | null;
  isLoading: boolean;
  error: string | null;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ imageSrc, isLoading, error }) => {
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
          <LoadingSpinner />
          <p className="text-lg">Conjuring cosmic dust into art...</p>
          <p className="text-sm">This can take a moment.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-red-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-semibold">Generation Failed</p>
          <p className="text-sm text-center">{error}</p>
        </div>
      );
    }

    if (imageSrc) {
      return (
        <img
          src={imageSrc}
          alt="Generated cosmic art"
          className="w-full h-full object-cover rounded-xl shadow-2xl shadow-black/50 animate-fade-in"
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-xl font-medium">Your Cosmic Masterpiece Awaits</h3>
        <p className="text-center">Describe a scene and choose a style to begin your journey.</p>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 w-full aspect-video rounded-2xl p-4 flex items-center justify-center shadow-inner transition-all duration-500">
       <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
      {renderContent()}
    </div>
  );
};

export default ImageDisplay;
