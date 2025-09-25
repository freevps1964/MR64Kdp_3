import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`p-6 bg-white rounded-lg shadow-md animate-fade-in ${className}`}>
      {children}
    </div>
  );
};

export default Card;
