import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/layout/dashboard';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import { Play, UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle, Eye, Sliders, Image as ImageIcon, Sparkles, X } from 'lucide-react';

interface PredictionRow {
  fileName: string;
  localFileUrl: string;
  dataId?: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  maskUrl?: string;
  maskColor?: string;
  error?: string;
}

export default function InferencePage() {
  const { user } = useAuth();
  
  // Selection States
  const [projects, setProjects] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [trainedModels, setTrainedModels] = useState<any[]>([]);
  
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  // Upload/Inference States
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [isInferenceRunning, setIsInferenceRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gallery of existing segmentations
  const [galleryItems, setGalleryItems] = useState<any[]>([]);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);

  // Active Overlay Modal States
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewMask, setPreviewMask] = useState<string | null>(null);
  const [previewMaskColor, setPreviewMaskColor] = useState('#ff0000');
  const [previewTitle, setPreviewTitle] = useState('');
  const [overlayOpacity, setOverlayOpacity] = useState(60);

  // 1. Fetch Projects & Trained Models
  useEffect(() => {
    if (!user?.id) return;
    
    // Fetch Projects
    api.get(`/project/user/${user.id}`).then(res => {
      if (res.data.success) setProjects(res.data.data || []);
    }).catch(() => toast.error("Failed to load projects"));

    // Fetch Trained Models
    api.get(`/training/trained-models?user_id=${user.id}`).then(res => {
      if (res.data.success) setTrainedModels(res.data.data || []);
    }).catch(() => toast.error("Failed to load trained models"));
  }, [user?.id]);

  // 2. Fetch Groups when Project changes
  useEffect(() => {
    if (selectedProject) {
      api.get(`/group/`).then(res => {
        if (res.data.success) {
          const allGroups = res.data.data || [];
          const projectGroups = allGroups.filter((g: any) => 
            String(g.project_id) === String(selectedProject) || String(g.ProjectID) === String(selectedProject)
          );
          if (projectGroups.length === 0 && allGroups.length > 0) {
            setGroups(allGroups);
          } else {
            setGroups(projectGroups);
          }
        }
      }).catch(() => toast.error("Failed to load groups"));
    } else {
      setGroups([]);
      setSelectedGroup('');
    }
  }, [selectedProject]);

  // 3. Load Gallery when Group changes
  const fetchGallery = async () => {
    if (!selectedGroup) {
      setGalleryItems([]);
      return;
    }
    setIsGalleryLoading(true);
    try {
      const [dataRes, segRes] = await Promise.all([
        api.get(`/data/groups/${selectedGroup}`),
        api.get(`/segmentationclass/group/${selectedGroup}`)
      ]);

      if (dataRes.data.success && segRes.data.success) {
        const images = dataRes.data.data || [];
        const masks = segRes.data.data || [];

        // Correlate masks with original images
        const gallery = masks.map((mask: any) => {
          const matchingImg = images.find((img: any) => img.id === mask.data_id);
          return {
            id: mask.id,
            name: mask.name,
            maskPath: mask.mask_path,
            dataId: mask.data_id,
            imgPath: matchingImg?.img_path,
          };
        }).filter((item: any) => item.imgPath); // Only show if original image exists

        setGalleryItems(gallery);
      }
    } catch (err) {
      console.error("Failed to fetch segmented gallery", err);
    } finally {
      setIsGalleryLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, [selectedGroup]);

  // 4. WebSocket log tracking for prediction jobs
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token || predictions.length === 0) return;

    let ws: WebSocket;
    const backendUrl = api.defaults.baseURL || 'http://localhost:8080';
    const wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws/notifications';
    
    ws = new WebSocket(wsUrl, [token]);

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'prediction_started') {
          setPredictions(prev => prev.map(p => 
            p.dataId === msg.data_id ? { ...p, status: 'processing' } : p
          ));
        } else if (msg.type === 'prediction_completed') {
          // Retrieve mask image bin and process header
          let maskUrl = '';
          let maskColor = '#00ffcc';
          
          if (msg.mask_path && msg.status === 'completed') {
            const cleanPath = msg.mask_path.replace(/\\/g, '/').replace(/^\/+/, '');
            const fetchUrl = `${backendUrl.replace(/\/$/, '')}/${cleanPath}`;
            
            try {
              const response = await fetch(fetchUrl);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const uint8 = new Uint8Array(arrayBuffer);
                let imageBytes = uint8;
                
                // Strip custom 4-byte header if not pure PNG magic bytes
                if (uint8.length > 4 && uint8[0] !== 0x89) {
                  const r = uint8[0].toString(16).padStart(2, '0');
                  const g = uint8[1].toString(16).padStart(2, '0');
                  const b = uint8[2].toString(16).padStart(2, '0');
                  maskColor = `#${r}${g}${b}`;
                  imageBytes = uint8.slice(4);
                }
                
                const blob = new Blob([imageBytes], { type: 'image/png' });
                maskUrl = URL.createObjectURL(blob);
              }
            } catch (err) {
              console.error("Failed to load completed mask bin file", err);
            }
          }

          setPredictions(prev => prev.map(p => 
            p.dataId === msg.data_id 
              ? { 
                  ...p, 
                  status: msg.status === 'completed' ? 'completed' : 'failed',
                  maskUrl: maskUrl || undefined,
                  maskColor,
                  error: msg.error || undefined
                } 
              : p
          ));

          // Reload segmented gallery when any prediction finishes
          fetchGallery();
        }
      } catch (err) {
        console.error("Inference ws listener error:", err);
      }
    };

    return () => {
      if (ws) ws.close();
    };
  }, [predictions]);

  // File Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Launch prediction form submission
  const handleRunInference = async () => {
    if (!selectedGroup) return toast.error("Please select a target dataset group.");
    if (!selectedModel) return toast.error("Please select a trained model.");
    if (selectedFiles.length === 0) return toast.error("Please upload at least one MRI image file.");

    setIsInferenceRunning(true);
    
    // Prepare temporary preview list
    const tempPredictions = selectedFiles.map(file => ({
      fileName: file.name,
      localFileUrl: URL.createObjectURL(file),
      status: 'queued' as const,
    }));
    setPredictions(tempPredictions);

    const formData = new FormData();
    formData.append("user_id", String(user?.id || 0));
    formData.append("group_id", selectedGroup);
    formData.append("model_id", selectedModel);
    
    selectedFiles.forEach(file => {
      formData.append("files", file, file.name);
    });

    try {
      const toastId = toast.loading("Submitting prediction jobs to queue...");
      const res = await api.post('/training/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        toast.success("Inference requests queued successfully!", { id: toastId });
        const dataIds = res.data.data?.data_ids || [];
        
        // Link returned data_ids to our prediction rows
        setPredictions(prev => prev.map((pred, index) => ({
          ...pred,
          dataId: dataIds[index] || undefined
        })));
      }
    } catch (err: any) {
      toast.error(`Failed to submit predictions: ${err.response?.data?.message || err.message}`);
      setPredictions([]);
    } finally {
      setIsInferenceRunning(false);
    }
  };

  // Inspect Segmentation in modal
  const openInspectModal = async (title: string, imgPath: string, maskPath: string) => {
    const backendUrl = api.defaults.baseURL || 'http://localhost:8080';
    
    // If paths are backend relative URLs, format them
    const cleanImgPath = imgPath.startsWith('http') ? imgPath : `${backendUrl.replace(/\/$/, '')}/${imgPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    const cleanMaskPath = maskPath.startsWith('http') ? maskPath : `${backendUrl.replace(/\/$/, '')}/${maskPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;

    setPreviewImage(cleanImgPath);
    setPreviewTitle(title);
    setPreviewMask(null);

    // Fetch and process mask
    try {
      const response = await fetch(cleanMaskPath);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let imageBytes = uint8;
        let maskColor = '#00ff00';
        
        // Strip custom header
        if (uint8.length > 4 && uint8[0] !== 0x89) {
          const r = uint8[0].toString(16).padStart(2, '0');
          const g = uint8[1].toString(16).padStart(2, '0');
          const b = uint8[2].toString(16).padStart(2, '0');
          maskColor = `#${r}${g}${b}`;
          imageBytes = uint8.slice(4);
        }

        const blob = new Blob([imageBytes], { type: 'image/png' });
        setPreviewMask(URL.createObjectURL(blob));
        setPreviewMaskColor(maskColor);
      }
    } catch (e) {
      console.error("Error loading gallery mask bin file:", e);
      toast.error("Failed to parse segmentation mask data.");
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-4 text-[#747677] text-sm">
        <Link to="/home" className="hover:text-[#0091AD] hover:underline">Dashboard</Link> /{' '}
        <Link to="/inference" className="hover:text-[#0091AD] hover:underline">Inference</Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[32px] font-bold text-[var(--foreground)]">Model Inference & Predictions</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Upload MRI scans and use trained models to generate predicted segmentation masks</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8 items-start mb-12">
        {/* CONFIGURATION & UPLOAD PANEL */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-[24px] shadow-sm overflow-hidden p-8 flex flex-col gap-6">
          <h3 className="font-bold text-lg text-[#393E41] border-b pb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#0091AD]" /> 1. Configure Inference
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">Project</label>
              <select 
                className="p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#0091AD] text-sm transition-all"
                value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">-- Select Project --</option>
                {projects.map(p => <option key={p.id || p.ID} value={p.id || p.ID}>{p.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">Dataset Group</label>
              <select 
                className="p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#0091AD] text-sm transition-all disabled:opacity-50"
                value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}
                disabled={!selectedProject}
              >
                <option value="">-- Select Group --</option>
                {groups.map(g => <option key={g.id || g.ID} value={g.id || g.ID}>{g.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0091AD] uppercase">Trained Model weights</label>
              <select 
                className="p-3 border border-[#0091AD] bg-[#0091AD]/5 rounded-xl outline-none focus:border-[#0091AD] text-sm transition-all font-semibold"
                value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="">-- Select Trained Model --</option>
                {trainedModels.map(m => (
                  <option key={m.id || m.ID} value={m.id || m.ID}>
                    Model Run #{m.id || m.ID} (Weights: U-Net)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 hover:border-[#0091AD] hover:bg-[#0091AD]/5 rounded-2xl p-10 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group"
          >
            <input 
              type="file" multiple ref={fileInputRef} className="hidden" 
              accept="image/*" onChange={handleFileChange}
            />
            <UploadCloud className="w-12 h-12 text-gray-400 group-hover:text-[#0091AD] transition-colors" />
            <span className="font-bold text-gray-700">Drag & Drop MRI scans here</span>
            <span className="text-xs text-gray-400">or click to browse from local files</span>
          </div>

          {selectedFiles.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
              <span className="font-bold text-xs text-gray-500 uppercase">Selected Files ({selectedFiles.length})</span>
              <div className="max-h-[120px] overflow-y-auto flex flex-col gap-1.5 pr-1">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex justify-between items-center text-xs text-gray-700 bg-white border border-gray-100 p-2 rounded-lg shadow-sm">
                    <span className="truncate font-semibold flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-gray-400" /> {file.name}</span>
                    <span className="text-gray-400 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleRunInference} 
              disabled={!selectedGroup || !selectedModel || selectedFiles.length === 0 || isInferenceRunning}
              className="bg-[#0091AD] hover:bg-[#007a94] text-white px-8 py-5 rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isInferenceRunning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              Run Prediction Sequence
            </Button>
          </div>
        </div>

        {/* ACTIVE PREDICTIONS STATUS LIST */}
        <div className="bg-white border border-gray-200 rounded-[24px] shadow-sm overflow-hidden p-6 flex flex-col gap-4 h-[450px]">
          <h3 className="font-bold text-lg text-[#393E41] border-b pb-2 uppercase tracking-wide text-xs">Prediction Queue</h3>
          
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
            {predictions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center p-6 gap-2">
                <ImageIcon className="w-10 h-10 opacity-30" />
                <span>Upload files and launch prediction to see live queue updates here</span>
              </div>
            ) : (
              predictions.map((p, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-gray-700 truncate w-[70%]" title={p.fileName}>{p.fileName}</span>
                    {p.status === 'queued' && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">Queued</span>}
                    {p.status === 'processing' && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Predict...
                      </span>
                    )}
                    {p.status === 'completed' && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Done</span>}
                    {p.status === 'failed' && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" /> Fail</span>}
                  </div>
                  
                  {p.status === 'completed' && p.maskUrl && (
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setPreviewImage(p.localFileUrl);
                        setPreviewMask(p.maskUrl || null);
                        setPreviewMaskColor(p.maskColor || '#00ffcc');
                        setPreviewTitle(p.fileName);
                      }}
                      className="text-[#0091AD] hover:text-[#007a94] hover:bg-[#0091AD]/5 flex items-center justify-center gap-1.5 w-full py-1 h-auto text-xs font-bold rounded-lg border border-[#0091AD]/20 mt-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect Mask Overlay
                    </Button>
                  )}
                  {p.status === 'failed' && p.error && (
                    <p className="text-[10px] text-red-500 font-mono break-words">{p.error}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* HISTORY GALLERY OF SEGMENTED MASKS */}
      <div className="bg-white border border-gray-200 rounded-[24px] shadow-sm overflow-hidden p-8 flex flex-col gap-6">
        <h3 className="font-bold text-lg text-[#393E41] border-b pb-2 flex items-center justify-between">
          <span className="flex items-center gap-2"><ImageIcon className="w-5 h-5 text-[#0091AD]" /> Segmented Masks Gallery</span>
          {selectedGroup && <span className="text-xs text-gray-400 font-normal">Showing {galleryItems.length} Segmented Scans</span>}
        </h3>

        {!selectedGroup ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Please select a Project and Dataset Group above to load existing segmented masks.
          </div>
        ) : isGalleryLoading ? (
          <div className="flex justify-center py-12 items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading segmented gallery...
          </div>
        ) : galleryItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500 border border-dashed border-gray-200 rounded-2xl bg-gray-50 text-sm">
            No segmented masks found for this group. Run predictions or manual annotations to see them here!
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-4">
            {galleryItems.map((item) => {
              const backendUrl = api.defaults.baseURL || 'http://localhost:8080';
              const cleanImgUrl = `${backendUrl.replace(/\/$/, '')}/${item.imgPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
              
              return (
                <div 
                  key={item.id} 
                  onClick={() => openInspectModal(item.name, item.imgPath, item.maskPath)}
                  className="bg-white border border-gray-150 rounded-xl overflow-hidden p-2 flex flex-col gap-2 hover:border-[#0091AD] transition-all cursor-pointer group shadow-sm hover:shadow-md"
                >
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center relative">
                    <img 
                      src={cleanImgUrl} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full text-white/90">
                      <Eye className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-700 truncate text-center px-1" title={item.name}>{item.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LIGHTWEIGHT INTERACTIVE COMPARISON OVERLAY MODAL */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-[#393E41] p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#0091AD]" />
                <h3 className="text-lg font-bold truncate max-w-[450px]" title={previewTitle}>{previewTitle}</h3>
              </div>
              <button 
                onClick={() => {
                  setPreviewImage(null);
                  setPreviewMask(null);
                }}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Viewer Workspace */}
            <div className="p-8 overflow-y-auto flex-1 flex flex-col gap-6 items-center justify-center min-h-[350px]">
              
              {/* Dual Presentation Grid */}
              <div className="grid grid-cols-2 gap-8 w-full max-w-3xl items-center justify-center">
                
                {/* Side-by-Side: Original image */}
                <div className="flex flex-col gap-2 items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Original Scan</span>
                  <div className="border border-gray-200 rounded-2xl overflow-hidden aspect-square bg-black flex items-center justify-center w-full max-w-[320px] max-h-[320px]">
                    <img src={previewImage} alt="Original Scan" className="max-w-full max-h-full object-contain pointer-events-none" />
                  </div>
                </div>

                {/* Side-by-Side: Opacity Overlay */}
                <div className="flex flex-col gap-2 items-center">
                  <span className="text-xs font-bold text-[#0091AD] uppercase tracking-wide">Mask Overlay</span>
                  <div className="border border-gray-200 rounded-2xl overflow-hidden aspect-square bg-black flex items-center justify-center relative w-full max-w-[320px] max-h-[320px]">
                    <img src={previewImage} alt="Original Scan" className="max-w-full max-h-full object-contain absolute inset-0 m-auto pointer-events-none" />
                    {previewMask ? (
                      <img 
                        src={previewMask} 
                        alt="Segmented Mask" 
                        className="max-w-full max-h-full object-contain absolute inset-0 m-auto pointer-events-none transition-opacity"
                        style={{ 
                          opacity: overlayOpacity / 100,
                          // Optional tinting based on custom header color
                          filter: `drop-shadow(0 0 1px ${previewMaskColor})`
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 gap-1.5">
                        <Loader2 className="w-4 h-4 animate-spin text-[#0091AD]" /> Rendering mask...
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Slider Controller */}
              <div className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col gap-2 mt-4">
                <div className="flex justify-between items-center text-xs text-gray-600 font-bold">
                  <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5" /> Mask Opacity</span>
                  <span>{overlayOpacity}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={overlayOpacity} onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                  className="w-full accent-[#0091AD] cursor-pointer"
                />
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <Button 
                onClick={() => {
                  setPreviewImage(null);
                  setPreviewMask(null);
                }}
                className="bg-[#393E41] hover:bg-[#2d3133] text-white px-6"
              >
                Close Viewer
              </Button>
            </div>

          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
