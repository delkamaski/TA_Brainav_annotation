import React, { useState } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);

  return (
    // 1. Changed to flex-col so Topbar sits on top of everything
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[var(--background)]">
      
      {/* TOPBAR: Now spans the entire width */}
      <Topbar />

      {/* INNER CONTAINER: Holds Sidebar and Content side-by-side */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* SIDEBAR: Now constrained below the Topbar */}
        <Sidebar 
          isMinimized={isSidebarMinimized} 
          onToggle={() => setIsSidebarMinimized(!isSidebarMinimized)} 
        />

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-auto p-10">
          {children}
        </main>

      </div>
    </div>
  );
}