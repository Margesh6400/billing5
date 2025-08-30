import React from 'react';

interface MobileAppWrapperProps {
  children: React.ReactNode;
}

export function MobileAppWrapper({ children }: MobileAppWrapperProps) {
  return (
    <div className="mobile-app-wrapper">
      {children}
    </div>
  );
}