'use client';

import React from 'react';

interface EyeLogoProps {
  className?: string;
  size?: number;
}

export function EyeLogo({ className = 'w-6 h-6', size = 24 }: EyeLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Eye Contour */}
      <path
        d="M2 16C5 9.5 10 5 16 5C22 5 27 9.5 30 16C27 22.5 22 27 16 27C10 27 5 22.5 2 16Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-sky-400"
      />
      {/* Iris Ring */}
      <circle
        cx="16"
        cy="16"
        r="6.5"
        stroke="currentColor"
        strokeWidth="2"
        className="text-white"
        fill="rgba(14, 165, 233, 0.25)"
      />
      {/* Pupil Core */}
      <circle
        cx="16"
        cy="16"
        r="3"
        fill="currentColor"
        className="text-sky-400"
      />
      {/* Lens Reflection Highlight */}
      <circle
        cx="14"
        cy="14"
        r="1.2"
        fill="#FFFFFF"
      />
    </svg>
  );
}
