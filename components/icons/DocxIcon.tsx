import React from 'react';

const DocxIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2Z" fill="#295394"/>
    <path d="M20 8H14V2L20 8Z" fill="#1E3A8A"/>
    <path d="M12.5 13.6338L15 18H13.25L11.5 15.015L9.75 18H8L10.5 13.6338L8 10H9.75L11.5 12.985L13.25 10H15L12.5 13.6338Z" fill="white"/>
  </svg>
);

export default DocxIcon;
