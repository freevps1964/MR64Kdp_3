
import React from 'react';

const LoadingSpinner: React.FC = () => (
  <div className="relative h-20 w-20">
    <div className="absolute inset-0 border-2 border-purple-500/30 rounded-full"></div>
    <div className="absolute inset-2 border-2 border-pink-500/30 rounded-full animate-spin-slow"></div>
    <div className="absolute inset-4 border-2 border-purple-500/50 rounded-full animate-spin-reverse"></div>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="h-2 w-2 bg-white rounded-full shadow-[0_0_10px_#fff,0_0_20px_#fff,0_0_30px_#f0f]"></div>
    </div>
    <style>{`
      @keyframes spin-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes spin-reverse {
        from { transform: rotate(0deg); }
        to { transform: rotate(-360deg); }
      }
      .animate-spin-slow {
        animation: spin-slow 4s linear infinite;
      }
      .animate-spin-reverse {
        animation: spin-reverse 3s linear infinite;
      }
    `}</style>
  </div>
);

export default LoadingSpinner;
