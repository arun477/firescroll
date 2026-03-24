import React from 'react';
import { C } from '../constants';

export const MockBrowser: React.FC<{
  children: React.ReactNode;
  url?: string;
  width?: number;
  height?: number;
}> = ({ children, url = 'firescroll.app', width = 1400, height = 780 }) => {
  return (
    <div
      style={{
        width,
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        background: C.bg,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 44,
          background: C.bgCard,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 7 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
        </div>
        <div
          style={{
            flex: 1,
            height: 28,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: C.textMuted,
            marginLeft: 60,
            marginRight: 80,
          }}
        >
          {url}
        </div>
      </div>
      {/* Content */}
      <div style={{ height, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
};
