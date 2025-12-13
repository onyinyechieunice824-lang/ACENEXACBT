
import React from 'react';

interface LogoProps {
  className?: string;
}

export const JambLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="JAMB Logo">
    <circle cx="50" cy="50" r="48" fill="#006837" />
    <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="2" />
    <path d="M25 40 H75 V75 H25 Z" fill="white" />
    <path d="M25 40 L50 20 L75 40" fill="white" />
    <text x="50" y="65" textAnchor="middle" fill="#006837" fontSize="22" fontWeight="900" fontFamily="sans-serif">JAMB</text>
  </svg>
);

export const WaecLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="WAEC Logo">
    <circle cx="50" cy="50" r="48" fill="#002D72" />
    <path d="M20 50 Q50 80 80 50 Q50 20 20 50" fill="none" stroke="#FFD700" strokeWidth="3" />
    <text x="50" y="55" textAnchor="middle" fill="#FFD700" fontSize="20" fontWeight="900" fontFamily="sans-serif">WAEC</text>
    <text x="50" y="75" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">SSCE</text>
  </svg>
);

export const JointLogo: React.FC<LogoProps> = ({ className = "w-12 h-8" }) => (
    <div className={`flex items-center justify-center -space-x-2 ${className}`}>
        <JambLogo className="w-full h-full" />
        <WaecLogo className="w-full h-full" />
    </div>
);

export const AcenexaLogo: React.FC<LogoProps> = ({ className = "w-12 h-12" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Ring */}
    <circle cx="50" cy="50" r="45" stroke="#064e3b" strokeWidth="6" fill="white"/>
    
    {/* Cap */}
    <path d="M20 35 L50 20 L80 35 L50 50 Z" fill="#EAB308" />
    <path d="M25 40 V55 C25 65 50 70 50 70 C50 70 75 65 75 55 V40" fill="#EAB308" />
    <path d="M80 35 V50" stroke="#EAB308" strokeWidth="3" />
    <circle cx="80" cy="52" r="3" fill="#EAB308" />

    {/* Checkmark overlaying bottom */}
    <path d="M35 60 L48 73 L70 45" stroke="#064e3b" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
