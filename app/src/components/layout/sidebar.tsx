import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Folder, 
  Box, 
  Activity, 
  Settings, 
  ChevronLeft 
} from 'lucide-react';

interface SidebarProps {
  isMinimized: boolean;
  onToggle: () => void;
}

export function Sidebar({ isMinimized, onToggle }: SidebarProps) {
  const location = useLocation();

  const isActive = (path: string) => 
    location.pathname === path || location.pathname.startsWith(path + '/');

  const navItems = [
    { path: '/home', label: 'Dashboard', icon: Home },
    { path: '/projects', label: 'Projects', icon: Folder },
    { path: '/models', label: 'Models', icon: Box },
    { path: '/training', label: 'Training', icon: Activity },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div 
      className={`relative h-full bg-[var(--sidebar)] transition-all duration-300 ease-in-out z-40 flex flex-col pt-6 ${
        isMinimized ? 'w-[80px]' : 'w-[192px]'
      }`}
    >
      {/* Toggle Button */}
      <button 
        onClick={onToggle}
        className="absolute top-4 right-[-12px] bg-[var(--primary)] text-white p-1 rounded-full shadow-md hover:bg-opacity-80 transition-all z-50"
      >
        <ChevronLeft size={16} className={`transition-transform duration-300 ${isMinimized ? 'rotate-180' : 'rotate-0'}`} />
      </button>

      {/* Navigation Links (Flexbox makes this perfectly spaced without absolute math) */}
      <nav className="flex flex-col gap-2 px-4">
        {navItems.map((item, index) => {
          const isItemActive = item.path && isActive(item.path);
          const Icon = item.icon; // Grab the Lucide icon component

          return (
            <Link
              key={index}
              to={item.path}
              className={`flex items-center h-10 rounded-xl cursor-pointer hover:opacity-90 transition-all duration-300 overflow-hidden ${
                isItemActive 
                  ? 'bg-[var(--background)] text-[var(--primary)] shadow-sm' 
                  : 'text-[var(--background)] hover:bg-white/10'
              }`}
            >
              {/* Icon Container */}
              <div className="w-10 h-10 shrink-0 flex items-center justify-center ml-1">
                <Icon size={20} strokeWidth={isItemActive ? 2.5 : 2} />
              </div>

              {/* Text Container */}
              <span 
                className={`font-medium whitespace-nowrap transition-opacity duration-300 ${
                  isMinimized ? 'opacity-0' : 'opacity-100 ml-2'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}