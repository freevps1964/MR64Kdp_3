import React from 'react';

const PdfIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2Z" fill="#D32F2F"/>
    <path d="M20 8H14V2L20 8Z" fill="#B71C1C"/>
    <path d="M8 17.5C8 18.33 8.67 19 9.5 19H10.5C11.33 19 12 18.33 12 17.5V14H8V17.5ZM10.5 15H11.5V17.5C11.5 17.78 11.28 18 11 18H10C9.72 18 9.5 17.78 9.5 17.5V15H10.5Z" fill="white"/>
    <path d="M14 19H12.5V14H14C15.1 14 16 14.9 16 16C16 17.1 15.1 18 14 18H13V19H14V18H13V15H14C14.55 15 15 15.45 15 16C15 16.55 14.55 17 14 17H12.5V19Z" fill="white"/>
    <path d="M17 14H19.5V15H18V16H19V17H18V18H19.5V19H17V14Z" fill="white"/>
  </svg>
);
export default PdfIcon;
