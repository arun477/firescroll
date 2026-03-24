import React from 'react';
import { C } from '../constants';

export const PhoneMockup: React.FC<{
  children: React.ReactNode;
  label?: string;
}> = ({ children, label }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div
        style={{
          width: 220,
          height: 440,
          borderRadius: 28,
          border: `3px solid ${C.border}`,
          background: C.bgCard,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 80,
            height: 22,
            background: '#000',
            borderRadius: '0 0 14px 14px',
            zIndex: 10,
          }}
        />
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
      {label && (
        <div style={{ fontSize: 18, fontWeight: 600, color: C.textSecondary }}>
          {label}
        </div>
      )}
    </div>
  );
};
