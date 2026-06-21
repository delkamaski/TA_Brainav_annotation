import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import DashboardLayout from '../components/layout/dashboard';
import { doSmartFloodFill, doNormalBucketFill, applyEdgeDetectionAlgorithm } from '../utils/cv';
import { toast } from 'sonner';

// --- Types ---
interface SegmentationLayer {
  id: number;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  locked: boolean;
  dataUrl: string; 
}

// --- Icons ---
const IconBrush = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" /></svg>;
const IconEraser = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>;
const IconBucket = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>;
const IconUndo = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>;
const IconRedo = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></svg>;
const IconEye = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
const IconEyeOff = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>;
const IconTrash = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>;
const IconLock = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconUnlock = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>;

const randomColorHex = () => `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;

export default function DataDetailedPage() {
  const navigate = useNavigate();
  const { projectId, groupId, id: dataId } = useParams();
  
  const [projectName, setProjectName] = useState(projectId || 'Project');
  const [groupName, setGroupName] = useState(groupId || 'Group');
  const [dataItem, setDataItem] = useState<any>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 }); 
  
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser' | 'bucket'>('brush');
  const [isFloodFill, setIsFloodFill] = useState(false);
  const [brushSize, setBrushSize] = useState(10);
  const [floodThreshold, setFloodThreshold] = useState(15);
  const [scale, setScale] = useState(1);
  
  const [panXY, setPanXY] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(false);
  const [appliedNoise, setAppliedNoise] = useState("none");
  
  const initialLayer = { id: Date.now(), name: "mask #1", color: "#ff0000", opacity: 100, visible: true, locked: false, dataUrl: "" };

  const [layers, setLayers] = useState<SegmentationLayer[]>([initialLayer]);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(initialLayer.id);
  const [editingLayerId, setEditingLayerId] = useState<number | null>(null);

  const [history, setHistory] = useState<SegmentationLayer[][]>([[initialLayer]]);
  const [historyStep, setHistoryStep] = useState(0);

  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (projectId) {
          const pRes = await api.get(`/project/${projectId}`);
          if (pRes.data.success) setProjectName(pRes.data.data.name);
        }
        if (groupId) {
          const gRes = await api.get(`/group/${groupId}`);
          if (gRes.data.success) setGroupName(gRes.data.data.name);
        }
        if (dataId) {
          const dRes = await api.get(`/data/${dataId}`);
          if (dRes.data.success) setDataItem(dRes.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch data");
      }
    };
    fetchData();
  }, [projectId, groupId, dataId]);

  const dataName = dataItem?.img_path?.split(/[\\/]/).pop() || 'Loading...';
  const backendUrl = api.defaults.baseURL || 'http://localhost:8080';
  const imgUrl = dataItem?.img_path ? `${backendUrl.replace(/\/$/, '')}/${dataItem.img_path.replace(/\\/g, '/').replace(/^\/+/, '')}` : undefined;

  // --- BULLETPROOF DATABASE LOADER ---
  const loadDatabaseMasks = async () => {
    try {
      const maskRes = await api.get(`/segmentationclass/data/${dataId}`);
      
      if (maskRes.data.success && maskRes.data.data.length > 0) {
        const loadedLayers: SegmentationLayer[] = [];
        
        for (const mask of maskRes.data.data) {
          // FIX: mask is defined here, inside the loop
          const cleanPath = mask.mask_path.replace(/\\/g, '/').replace(/^\/+/, '');
          const url = `${backendUrl.replace(/\/$/, '')}/${cleanPath}`;
          
          let dataUrl = "";
          let layerColor = randomColorHex(); 
          
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("HTTP error");
            
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            let imageBytes = data;
            
            if (data.length > 4 && data[0] !== 0x89) {
              const r = data[0].toString(16).padStart(2, '0');
              const g = data[1].toString(16).padStart(2, '0');
              const b = data[2].toString(16).padStart(2, '0');
              layerColor = `#${r}${g}${b}`;
              imageBytes = data.slice(4);
            }
            
            dataUrl = URL.createObjectURL(new Blob([imageBytes], { type: 'image/png' }));
          } catch(e) { console.error("Mask load fail", e); }
          
          loadedLayers.push({ id: mask.id, name: mask.name, color: layerColor, opacity: 100, visible: true, locked: false, dataUrl });
        }
        
        setLayers(loadedLayers);
        setHistory([loadedLayers]);
        setActiveLayerId(loadedLayers[0].id);
      }
    } catch (err) { console.error("Error fetching masks:", err); }
  };

  const getProcessedBaseImageData = () => {
    if (!imageRef.current || imgSize.w === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = imgSize.w;
    canvas.height = imgSize.h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    
    let filterStr = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (grayscale) filterStr += ` grayscale(100%)`;
    if (appliedNoise === 'gaussian') filterStr += ` blur(2px)`;
    else if (appliedNoise === 'median') filterStr += ` blur(1px)`;
    
    ctx.filter = filterStr;
    ctx.drawImage(imageRef.current, 0, 0, imgSize.w, imgSize.h);
    try { return ctx.getImageData(0, 0, imgSize.w, imgSize.h); } catch (e) { return null; }
  };

  const saveHistoryState = (newLayers: SegmentationLayer[]) => {
    const stateToSave = newLayers.map(l => {
      const canvas = canvasRefs.current[l.id];
      try { return { ...l, dataUrl: canvas ? canvas.toDataURL() : l.dataUrl }; } 
      catch (e) { return { ...l }; }
    });
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(stateToSave);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    setLayers(stateToSave);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      setHistoryStep(prev => prev - 1);
      setLayers(history[historyStep - 1]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(prev => prev + 1);
      setLayers(history[historyStep + 1]);
    }
  };

  useEffect(() => {
    const stepLayers = history[historyStep];
    if (!stepLayers) return;
    stepLayers.forEach(layer => {
      const canvas = canvasRefs.current[layer.id];
      if (canvas && layer.dataUrl) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = layer.dataUrl;
        img.onload = () => {
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          ctx?.drawImage(img, 0, 0);
        };
      } else if (canvas && !layer.dataUrl) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
  }, [historyStep, history]);

  // --- BULLETPROOF SAVER ---
  const handleSaveToDatabase = async () => {
    try {
      const toastId = toast.loading("Saving masks to database...");
      
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const canvas = canvasRefs.current[layer.id];
        if (!canvas) continue;

        const maskBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!maskBlob) continue;

        const headerBytes = new Uint8Array(4);
        const hexColor = layer.color.replace('#', '');
        headerBytes[0] = parseInt(hexColor.substring(0, 2), 16) || 255;
        headerBytes[1] = parseInt(hexColor.substring(2, 4), 16) || 0;
        headerBytes[2] = parseInt(hexColor.substring(4, 6), 16) || 0;
        headerBytes[3] = i; 

        const maskArrayBuffer = await maskBlob.arrayBuffer();
        const maskBytes = new Uint8Array(maskArrayBuffer);
        const combinedBlob = new Blob([headerBytes, maskBytes], { type: 'application/octet-stream' });

        const formData = new FormData();
        formData.append("name", layer.name);
        formData.append("data_id", String(dataId));
        formData.append("mask", combinedBlob, `mask_${layer.id}.bin`);

        // FIX 4: Removed hyphen from API route
        if (layer.id > 1000000) {
          await api.post('/segmentationclass', formData);
        } else {
          await api.put(`/segmentationclass/${layer.id}`, formData);
        }
      }
      
      toast.success("All masks successfully saved!", { id: toastId });
      
      // FIX 5: Reload DB immediately so new masks get their permanent database IDs!
      await loadDatabaseMasks();

    } catch (err: any) { 
      toast.error(err.response?.data?.message || "Error saving masks."); 
    }
  };

  const exportMaskLayer = () => {
    if (!activeLayerId) return toast.info("Please select a layer first");
    const layer = layers.find(l => l.id === activeLayerId);
    if (!layer) return;
    
    const canvas = canvasRefs.current[layer.id];
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const imgData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    if (!imgData) return;

    const blob = new Blob([imgData.data.buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layer.name.replace(/\s+/g, '_')}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importMaskLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeLayerId) return;

    const layer = layers.find(l => l.id === activeLayerId);
    if (!layer) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        const buffer = ev.target?.result as ArrayBuffer;
        const canvas = canvasRefs.current[layer.id];
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dataArray = new Uint8ClampedArray(buffer);
        try {
            const imgData = new ImageData(dataArray, canvas.width, canvas.height);
            ctx.putImageData(imgData, 0, 0);
            saveHistoryState(layers);
        } catch (err) { toast.error("Invalid .bin file dimensions."); }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addNewLayer = () => {
    const newLayer = { id: Date.now(), name: `mask #${layers.length + 1}`, color: randomColorHex(), opacity: 100, visible: true, locked: false, dataUrl: "" };
    const updatedLayers = [...layers, newLayer];
    setActiveLayerId(newLayer.id);
    saveHistoryState(updatedLayers);
  };

  const deleteLayer = (id: number) => {
    const updatedLayers = layers.filter(l => l.id !== id);
    if (activeLayerId === id) setActiveLayerId(updatedLayers.length > 0 ? updatedLayers[updatedLayers.length - 1].id : null);
    saveHistoryState(updatedLayers);
  };

  const toggleLayerProperty = (id: number, prop: 'visible' | 'locked') => {
    const updated = layers.map(l => l.id === id ? { ...l, [prop]: !l[prop] } : l);
    saveHistoryState(updated);
  };

  const updateLayerColor = (id: number, color: string) => {
    const updated = layers.map(l => l.id === id ? { ...l, color } : l);
    saveHistoryState(updated);
  };

  const updateLayerOpacity = (id: number, opacity: number) => {
    const updated = layers.map(l => l.id === id ? { ...l, opacity } : l);
    setLayers(updated); 
  };

  const renameLayer = (id: number, newName: string) => {
    const updated = layers.map(l => l.id === id ? { ...l, name: newName } : l);
    saveHistoryState(updated);
    setEditingLayerId(null);
  };

  const lastPos = useRef<{x: number, y: number} | null>(null);

  const getCanvasCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || imgSize.w === 0) return null;
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 2) { setIsPanning(true); return; }

    setIsDragging(true);
    const coords = getCanvasCoords(e);
    if (!coords || !activeLayerId) return;
    
    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (!activeLayer || activeLayer.locked || !activeLayer.visible) return;

    const canvas = canvasRefs.current[activeLayerId];
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    if (activeTool === 'bucket') {
      if (isFloodFill) {
        const baseData = getProcessedBaseImageData();
        if (baseData) {
            let maskData;
            try { maskData = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch(err) { return; }
            const newMask = doSmartFloodFill(baseData, maskData, coords.x, coords.y, activeLayer.color, floodThreshold);
            ctx.putImageData(newMask, 0, 0);
        }
      } else {
        let maskData;
        try { maskData = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch(err) { return; }
        const newMask = doNormalBucketFill(maskData, coords.x, coords.y, activeLayer.color);
        ctx.putImageData(newMask, 0, 0);
      }
      saveHistoryState(layers);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;

    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = activeLayer.color; 
    }
    
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    lastPos.current = coords;
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) { setPanXY(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY })); return; }
    if (!isDragging || activeTool === 'bucket' || !activeLayerId) return;

    const coords = getCanvasCoords(e);
    if (!coords || !lastPos.current) return;

    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (!activeLayer || activeLayer.locked || !activeLayer.visible) return;

    const ctx = canvasRefs.current[activeLayerId]?.getContext('2d');
    if (ctx) {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
    lastPos.current = coords;
  };

  const handlePointerUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 2 || isPanning) { setIsPanning(false); return; }
    setIsDragging(false);
    lastPos.current = null;
    if (activeTool !== 'bucket' && activeLayerId) saveHistoryState(layers); 
  };

  return (
    <DashboardLayout>
      <input type="file" ref={fileInputRef} className="hidden" accept=".bin" onChange={importMaskLayer} />
      
      <div className="flex flex-col h-[calc(100vh-140px)] w-full">
         
         <div className="flex flex-col shrink-0 mb-4">
           <div className="mb-2 text-[#747677] text-sm">
             <Link to="/home" className="hover:text-[#0091AD] hover:underline">Dashboard</Link> /{' '}
             <Link to="/projects" className="hover:text-[#0091AD] hover:underline">{projectName}</Link> /{' '}
             <Link to={`/projects/${projectId}/groups`} className="hover:text-[#0091AD] hover:underline">{groupName}</Link> /{' '}
             <Link to={`/projects/${projectId}/groups/${groupId}/data`} className="hover:text-[#0091AD] hover:underline">Data</Link>
           </div>
           
           <div className="flex justify-between items-center">
             <div className="flex items-center gap-4">
               <span className="text-[#393E41] text-[28px] font-bold">{dataName}</span>
             </div>
             
             <div className="flex items-center gap-3">
               <button onClick={handleUndo} disabled={historyStep === 0} className="p-2 text-[#393e41] hover:bg-black/5 disabled:opacity-30 rounded-full transition-colors"><IconUndo/></button>
               <button onClick={handleRedo} disabled={historyStep === history.length - 1} className="p-2 text-[#393e41] hover:bg-black/5 disabled:opacity-30 rounded-full transition-colors"><IconRedo/></button>
               <button className="bg-[#0091AD] text-white py-2 px-6 rounded-2xl text-lg hover:bg-[#007a94] shadow-sm ml-4" onClick={handleSaveToDatabase}>
                 save
               </button>
             </div>
           </div>
         </div>

         <div className="flex h-full gap-6 min-h-0">
            <div className="relative flex-1 bg-white border-2 border-[#393E41] rounded-[24px] overflow-hidden flex items-center justify-center shadow-inner">
               <div 
                 onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
                 onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onContextMenu={(e) => e.preventDefault()} 
                 className={`relative ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                 style={{ transform: `translate(${panXY.x}px, ${panXY.y}px) scale(${scale})`, transformOrigin: 'center' }}
               >
                 {imgUrl ? (
                   <>
                     <img 
                       ref={imageRef} src={imgUrl} crossOrigin="anonymous" alt="Workspace Data" 
                       className="max-w-[1000px] max-h-[700px] object-contain pointer-events-none select-none" 
                       style={{ filter: `brightness(${brightness}%) contrast(${contrast}%) ${grayscale ? 'grayscale(100%)' : ''} ${appliedNoise === 'gaussian' ? 'blur(2px)' : appliedNoise === 'median' ? 'blur(1px)' : ''}` }}
                       onLoad={(e) => {
                         const w = e.currentTarget.naturalWidth;
                         const h = e.currentTarget.naturalHeight;
                         setImgSize({ w, h });
                         loadDatabaseMasks();
                       }}
                     />
                     {layers.map(layer => (
                       <canvas 
                         key={layer.id} ref={el => {canvasRefs.current[layer.id] = el}}
                         width={imgSize.w || 800} height={imgSize.h || 600}
                         className={`absolute top-0 left-0 w-full h-full pointer-events-none ${layer.visible ? '' : 'hidden'}`}
                         style={{ opacity: layer.opacity / 100 }} 
                       />
                     ))}
                   </>
                 ) : ( <div className="text-gray-400">Loading image...</div> )}
               </div>

               <div className="absolute bottom-4 right-4 bg-white/90 border border-[#393e41] rounded-[12px] flex items-center p-1 shadow-md z-10">
                 <button className="px-3 hover:bg-black/5 rounded-md text-[#393e41] font-bold text-lg" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>-</button>
                 <span className="px-2 text-[#393e41] min-w-[50px] text-center text-sm">{Math.round(scale * 100)}%</span>
                 <button className="px-3 hover:bg-black/5 rounded-md text-[#393e41] font-bold text-lg" onClick={() => setScale(s => Math.min(3, s + 0.1))}>+</button>
               </div>
            </div>

            <div className="w-[350px] flex shrink-0 flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
               <div className="flex flex-col bg-white p-4 rounded-2xl border border-solid border-[#393E41] gap-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#393E41] text-sm font-bold">Grayscale</span>
                    <div className="flex items-center rounded-lg border border-solid border-[#393E41] overflow-hidden cursor-pointer select-none">
                      <div className={`px-4 py-1 text-xs ${!grayscale ? 'bg-[#0091AD] text-white' : 'bg-transparent text-[#393E41]'}`} onClick={() => setGrayscale(false)}>Off</div>
                      <div className={`px-4 py-1 text-xs ${grayscale ? 'bg-[#0091AD] text-white' : 'bg-transparent text-[#393E41]'}`} onClick={() => setGrayscale(true)}>On</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[#393E41] text-sm min-w-[80px]">Brightness</span>
                    <input type="range" min="0" max="200" value={brightness} onChange={(e)=>setBrightness(Number(e.target.value))} className="flex-1 accent-[#0091AD] cursor-pointer" />
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[#393E41] text-sm min-w-[80px]">Contrast</span>
                    <input type="range" min="0" max="200" value={contrast} onChange={(e)=>setContrast(Number(e.target.value))} className="flex-1 accent-[#0091AD] cursor-pointer" />
                  </div>
               </div>

               <div className="flex items-center bg-white rounded-2xl border border-solid border-[#393E41] p-2 gap-4 shadow-sm">
                 <div className="flex flex-col shrink-0 items-center py-2 px-2 rounded-2xl border border-solid border-[#393E41] gap-2">
                   <button onClick={()=>setActiveTool('brush')} className={`p-1.5 rounded-xl transition-colors ${activeTool==='brush' ? 'bg-[#0091AD] text-white' : 'text-[#393E41] hover:bg-black/5'}`}><IconBrush/></button>
                   <button onClick={()=>setActiveTool('eraser')} className={`p-1.5 rounded-xl transition-colors ${activeTool==='eraser' ? 'bg-[#0091AD] text-white' : 'text-[#393E41] hover:bg-black/5'}`}><IconEraser/></button>
                   <button onClick={()=>setActiveTool('bucket')} className={`p-1.5 rounded-xl transition-colors ${activeTool==='bucket' ? 'bg-[#0091AD] text-white' : 'text-[#393E41] hover:bg-black/5'}`}><IconBucket/></button>
                 </div>

                 <div className="flex flex-col flex-1 gap-3 pr-2">
                    <div className="flex flex-col gap-1">
                       <span className="text-black text-xs font-bold">Brush Size: {brushSize}px</span>
                       <input type="range" min="1" max="50" value={brushSize} onChange={(e)=>setBrushSize(Number(e.target.value))} className="w-full accent-[#0091AD] cursor-pointer" />
                    </div>

                    <div className="flex items-center rounded-lg border border-solid border-black overflow-hidden cursor-pointer select-none">
                       <div className={`flex-1 text-center py-1 text-[10px] uppercase font-bold ${!isFloodFill ? 'bg-[#0091AD] text-white' : 'bg-transparent text-black'}`} onClick={() => setIsFloodFill(false)}>Normal</div>
                       <div className={`flex-1 text-center py-1 text-[10px] uppercase font-bold ${isFloodFill ? 'bg-[#0091AD] text-white' : 'bg-transparent text-black'}`} onClick={() => setIsFloodFill(true)}>Flood Fill</div>
                    </div>

                    <div className={`flex flex-col gap-1 transition-opacity ${!isFloodFill && 'opacity-40 pointer-events-none'}`}>
                       <span className="text-black text-xs font-bold">Fill Threshold: {floodThreshold}</span>
                       <input type="range" min="1" max="100" value={floodThreshold} onChange={(e)=>setFloodThreshold(Number(e.target.value))} className="w-full accent-[#0091AD] cursor-pointer" />
                    </div>
                 </div>
               </div>

               <div className="flex flex-col rounded-2xl border border-solid border-[#393E41] bg-white overflow-hidden shadow-sm flex-1 min-h-[250px]">
                  <div className="flex items-stretch bg-[#0091AD] text-white divide-x divide-white border-b border-[#393E41]">
                     <button onClick={addNewLayer} className="flex-1 py-3 text-center text-sm font-bold hover:bg-[#007a94] transition-colors">Add Layer</button>
                     <button onClick={exportMaskLayer} className="flex-1 py-2 text-center text-xs hover:bg-[#007a94] transition-colors leading-tight">Export<br/>Mask</button>
                     <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2 text-center text-xs hover:bg-[#007a94] transition-colors leading-tight">Import<br/>Mask</button>
                  </div>

                  <div className="flex flex-col overflow-y-auto">
                     {layers.map((layer) => (
                        <div 
                          key={layer.id} 
                          className={`flex flex-col p-3 border-b border-gray-100 cursor-pointer transition-colors ${activeLayerId === layer.id ? 'bg-[#0091AD]/10' : 'hover:bg-black/5'}`}
                          onClick={() => setActiveLayerId(layer.id)}
                        >
                          <div className="flex items-center gap-3">
                            <button onClick={(e) => { e.stopPropagation(); toggleLayerProperty(layer.id, 'visible'); }} className={`text-[#393E41] hover:text-[#0091AD] transition-colors ${!layer.visible && 'opacity-40'}`}>
                              {layer.visible ? <IconEye /> : <IconEyeOff />}
                            </button>
                            
                            {editingLayerId === layer.id ? (
                              <input 
                                autoFocus defaultValue={layer.name}
                                onBlur={(e) => renameLayer(layer.id, e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && renameLayer(layer.id, e.currentTarget.value)}
                                className="flex-1 bg-white border border-[#0091ad] px-1 text-sm outline-none"
                              />
                            ) : (
                              <span 
                                onDoubleClick={() => setEditingLayerId(layer.id)}
                                className={`flex-1 text-sm text-[#393E41] font-bold truncate select-none ${!layer.visible && 'opacity-50'}`}
                              >
                                {layer.name}
                              </span>
                            )}
                            
                            <label className="relative w-6 h-6 rounded-full border border-[#393E41] shrink-0 shadow-sm overflow-hidden block cursor-pointer" style={{ backgroundColor: layer.color }} onClick={(e) => e.stopPropagation()}>
                              <input type="color" value={layer.color} onChange={(e) => updateLayerColor(layer.id, e.target.value)} className="opacity-0 absolute inset-[-10px] w-10 h-10 cursor-pointer" />
                            </label>
                            
                            <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="text-gray-400 hover:text-red-500 transition-colors shrink-0">
                              <IconTrash />
                            </button>
                          </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </div>
    </DashboardLayout>
  );
}