import React from 'react';

const OdtIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2Z" fill="#3B82F6"/>
    <path d="M20 8H14V2L20 8Z" fill="#2563EB"/>
    <path d="M9.5 14C10.88 14 12 15.12 12 16.5C12 17.88 10.88 19 9.5 19C8.12 19 7 17.88 7 16.5C7 15.12 8.12 14 9.5 14ZM9.5 15.5C9.22 15.5 9 15.72 9 16C9 16.28 9.22 16.5 9.5 16.5C9.78 16.5 10 16.28 10 16C10 15.72 9.78 15.5 9.5 15.5Z" fill="white"/>
    <path d="M13 14H14.5V19H13V14Z" fill="white"/>
    <path d="M15.5 14H17V19H15.5V14Z" fill="white"/>
  </svg>
);

export default OdtIcon;
