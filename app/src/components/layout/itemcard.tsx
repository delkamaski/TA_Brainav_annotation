import React, { useState } from 'react';
import { MoreVertical, Edit2, Trash2, Download, Folder, Image as ImageIcon, Eye } from 'lucide-react';

interface ItemCardProps {
  name: string;
  dateCreated: string;
  thumbnailSrc?: string; // FIXED: Added this property as optional
  onClick: () => void;
  onRename: () => void;
  onExport: () => void;
  onDelete: () => void;
  onViewMask?: () => void;
}

export function ItemCard({ name, dateCreated, thumbnailSrc, onClick, onRename, onExport, onDelete, onViewMask }: ItemCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  return (
    <div 
      onClick={onClick}
      className="relative w-[216px] h-[216px] bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-[#0091AD] flex flex-col p-4 transition-all cursor-pointer group hover:shadow-md"
    >
      {/* 3-Dot Menu Button */}
      <button 
        onClick={toggleMenu}
        className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-[#0091AD] hover:bg-white/80 transition-colors z-10 shadow-sm"
      >
        <MoreVertical size={20} />
      </button>

      {/* Pop-up Menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
          <div className="absolute top-10 right-3 w-40 bg-white rounded-xl shadow-lg border border-gray-100 z-30 overflow-hidden flex flex-col py-1">
            {onViewMask && (
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onViewMask(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0091AD] text-left">
                <Eye size={14} /> View Mask
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRename(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0091AD] text-left">
              <Edit2 size={14} /> Rename
            </button>
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onExport(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0091AD] text-left">
              <Download size={14} /> Export
            </button>
            <div className="h-px bg-gray-100 my-1" />
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}

      {/* Image or Folder Placeholder */}
      <div className="flex-1 bg-gray-50 rounded-xl flex items-center justify-center mb-3 border border-gray-100 group-hover:bg-[#f9fafb] transition-colors overflow-hidden">
        {thumbnailSrc && !imgError ? (
          <img 
            src={thumbnailSrc} 
            alt={name} 
            className="w-full h-full object-cover"
            onError={() => setImgError(true)} // If image is broken, fallback to icon
          />
        ) : (
          thumbnailSrc ? (
            <ImageIcon className="w-10 h-10 text-gray-400 opacity-40" />
          ) : (
            <Folder className="w-10 h-10 text-[#393E41] opacity-20" />
          )
        )}
      </div>
      
      {/* Card Details */}
      <div className="shrink-0 bg-white z-10 relative">
        <h3 className="font-bold text-[14px] text-[#393E41] truncate pr-6" title={name}>
          {name}
        </h3>
        <p className="text-[12px] text-gray-400 mt-0.5">
          {dateCreated}
        </p>
      </div>
    </div>
  );
}