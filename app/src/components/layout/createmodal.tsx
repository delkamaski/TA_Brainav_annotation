import React, { useState, useRef } from 'react';
import { X, UploadCloud } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: any) => void;
  type: 'project' | 'group' | 'data';
}

export function CreateModal({ isOpen, onClose, onConfirm, type }: CreateModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (type === 'data') {
      if (selectedFiles.length === 0) return;
      onConfirm(selectedFiles); // Send the array of files to DataPage
      setSelectedFiles([]);
    } else {
      if (!inputValue.trim()) return;
      onConfirm(inputValue);    // Send the string name to Project/GroupPage
      setInputValue('');
    }
    onClose();
  };

  const handleClose = () => {
    setInputValue('');
    setSelectedFiles([]);
    onClose();
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const isDataMode = type === 'data';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity px-4">
      <div className="w-full max-w-[480px] rounded-2xl bg-white p-8 shadow-xl relative">
        
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-[#0091AD] transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="text-[28px] font-bold text-[#393E41] mb-2 capitalize">
          {isDataMode ? 'Upload Data' : `Create New ${type}`}
        </h2>
        <p className="text-gray-500 mb-6 text-sm">
          {isDataMode 
            ? 'Select medical images to upload to this group.' 
            : `Enter a name for your new ${type} to get started.`}
        </p>

        {isDataMode ? (
          <div className="flex flex-col gap-4 mb-8">
            <div 
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#0091AD] hover:bg-[#0091AD]/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="w-10 h-10 text-gray-400 mb-2" />
              <span className="text-sm font-bold text-[#393E41]">Click to select files</span>
              <span className="text-xs text-gray-500 mt-1">Supports .jpg, .png, .dcm</span>
            </div>
            
            <input 
              type="file" 
              multiple 
              accept=".jpg,.jpeg,.png,.dcm,.dicom" 
              className="hidden" 
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files) {
                  // Append new files to existing selection
                  setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }
              }}
            />

            {/* Selected Files List Preview */}
            {selectedFiles.length > 0 && (
              <div className="max-h-[120px] overflow-y-auto flex flex-col gap-2 pr-2 custom-scrollbar">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <span className="text-sm text-gray-600 truncate pr-4">{file.name}</span>
                    <button onClick={() => removeFile(idx)} className="text-red-400 hover:text-red-600">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Input
            type="text"
            placeholder={`${type} name...`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="h-12 text-lg border-2 border-[#0091AD] focus-visible:ring-0 focus-visible:border-[#0091AD] mb-8"
            autoFocus
          />
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose} className="text-gray-500">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isDataMode ? selectedFiles.length === 0 : !inputValue.trim()} 
            className="px-8 bg-[#0091AD] hover:bg-[#007a94] text-white"
          >
            {isDataMode ? `Upload ${selectedFiles.length} File(s)` : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}