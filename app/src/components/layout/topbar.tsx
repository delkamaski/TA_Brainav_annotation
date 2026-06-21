import React from 'react';
import { HelpCircle, Bell, User } from 'lucide-react';

export function Topbar() {
  return (
    // 1. Reduced height to 72px
    <header className="h-[72px] shrink-0 bg-[var(--primary)] shadow-md flex items-center justify-between px-8 z-50">
      
      <div className="flex items-center gap-4">
        {/* 2. Scaled down avatar placeholder to w-10 h-10 */}
        <div className="w-10 h-10 rounded-full bg-[var(--background)] shrink-0 shadow-sm" />
        
        {/* 3. Scaled down text to 32px */}
        <h1 className="text-[32px] font-normal text-white font-serif tracking-wide leading-none translate-y-[1px]">
          braiNAV
        </h1>
      </div>

      <div className="flex items-center gap-5">
        
        {/* 4. Scaled down icons to size 28 */}
        <button className="text-[var(--background)] hover:opacity-80 transition-opacity">
          <HelpCircle size={28} strokeWidth={2} />
        </button>
        
        <button className="text-[var(--background)] hover:opacity-80 transition-opacity">
          <Bell size={28} strokeWidth={2} />
        </button>
        
        <button className="w-10 h-10 rounded-full bg-[var(--background)] text-[var(--sidebar)] flex items-center justify-center shadow-sm hover:scale-105 transition-transform">
          <User size={24} strokeWidth={2.5} />
        </button>

      </div>
    </header>
  );
}