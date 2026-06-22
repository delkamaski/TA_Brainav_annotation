import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import DashboardLayout from '../components/layout/dashboard';
import { ItemCard } from '../components/layout/itemcard';
import { CreateModal } from '../components/layout/createmodal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, ArrowUpDown, X, Eye, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function DataPage() {
  const navigate = useNavigate();
  const { projectId, groupId } = useParams();
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); 

  const [projectName, setProjectName] = useState(projectId);
  const [groupName, setGroupName] = useState(groupId);
  const [dataItems, setDataItems] = useState<any[]>([]);

  // Segmentation indicators & mapping
  const [segmentedDataIds, setSegmentedDataIds] = useState<Set<number>>(new Set());
  const [dataMaskPaths, setDataMaskPaths] = useState<{[key: number]: string}>({});

  // Active Mask Preview States
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewMask, setPreviewMask] = useState<string | null>(null);
  const [previewMaskColor, setPreviewMaskColor] = useState('#ff0000');
  const [previewTitle, setPreviewTitle] = useState('');
  const [overlayOpacity, setOverlayOpacity] = useState(60);

  useEffect(() => {
    const fetchBreadcrumbNames = async () => {
      try {
        if (projectId && projectId !== 'undefined') {
          const pRes = await api.get(`/project/${projectId}`);
          if (pRes.data.success) setProjectName(pRes.data.data.name);
        }
        if (groupId && groupId !== 'undefined') {
          const gRes = await api.get(`/group/${groupId}`);
          if (gRes.data.success) setGroupName(gRes.data.data.name);
        }
      } catch (err) {}
    };
    fetchBreadcrumbNames();
  }, [projectId, groupId]);

  const fetchData = async () => {
    try {
      const res = await api.get(`/data/groups/${groupId}`);
      if (res.data.success) {
        setDataItems(res.data.data || []);
      }

      // Fetch segmentations for the group
      const segRes = await api.get(`/segmentationclass/group/${groupId}`);
      if (segRes.data.success) {
        const segs = segRes.data.data || [];
        const segSet = new Set<number>();
        const pathMap: {[key: number]: string} = {};
        
        segs.forEach((s: any) => {
          segSet.add(s.data_id);
          pathMap[s.data_id] = s.mask_path;
        });
        
        setSegmentedDataIds(segSet);
        setDataMaskPaths(pathMap);
      }
    } catch (err) { 
      toast.error("Failed to fetch data"); 
    }
  };

  useEffect(() => { if (groupId && groupId !== 'undefined') fetchData(); }, [groupId]);

  const handleCreateData = async (payload: File[]) => {
    if (!Array.isArray(payload) || payload.length === 0) return;
    
    // Show a loading toast that will persist until uploads finish
    const toastId = toast.loading(`Uploading ${payload.length} file(s)...`);
    
    try {
      for (const file of payload) {
        const formData = new FormData();
        formData.append("image", file, file.name); 
        formData.append("group_id", String(groupId || '0'));
        
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        let dataType = "jpeg"; 
        if (fileExt === "png") dataType = "png";
        if (fileExt === "dcm" || fileExt === "dicom") dataType = "dicom";
        formData.append("type", dataType);

        await api.post('/data/', formData, { 
          headers: { 'Content-Type': 'multipart/form-data' } 
        });
      }
      
      fetchData(); 
      toast.success("All files uploaded successfully!", { id: toastId });
    } catch (err: any) {
      toast.error(`Upload failed: ${err.response?.data?.message || 'Server error'}`, { id: toastId });
    }
  };
  
  const handleDeleteData = async (id: number) => {
    if(!window.confirm("Are you sure you want to delete this image?")) return;
    try { 
      await api.delete(`/data/${id}`); 
      toast.success("Image deleted");
      fetchData(); 
    } catch (err) { 
      toast.error("Failed to delete data"); 
    }
  };

  // Inspect existing mask
  const openInspectModal = async (title: string, imgPath: string, maskPath: string) => {
    const backendUrl = api.defaults.baseURL || 'http://localhost:8080';
    const cleanImgPath = imgPath.startsWith('http') ? imgPath : `${backendUrl.replace(/\/$/, '')}/${imgPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    const cleanMaskPath = maskPath.startsWith('http') ? maskPath : `${backendUrl.replace(/\/$/, '')}/${maskPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;

    setPreviewImage(cleanImgPath);
    setPreviewTitle(title);
    setPreviewMask(null);

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
      console.error("Error loading mask bin file:", e);
      toast.error("Failed to parse segmentation mask data.");
    }
  };

  const displayedData = dataItems
    .filter((data) => `Data #${data.id} (${data.type})`.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => sortBy === 'newest' ? b.id - a.id : a.id - b.id);

  return (
    <DashboardLayout>
      <div className="mb-4 text-[#747677] text-sm">
        <Link to="/home" className="hover:text-[#0091AD] hover:underline">Dashboard</Link> /{' '}
        <Link to="/projects" className="hover:text-[#0091AD] hover:underline">{projectName}</Link> /{' '}
        <Link to={`/projects/${projectId}/groups`} className="hover:text-[#0091AD] hover:underline">{groupName}</Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[32px] font-bold text-[var(--foreground)]">Data</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Total data: {dataItems.length} images</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              type="text" placeholder="Search data..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white rounded-xl"
            />
          </div>
          
          <Button variant="outline" onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')} className="gap-2">
            <ArrowUpDown className="w-4 h-4" /> {sortBy}
          </Button>

          <Button onClick={() => setCreateModalOpen(true)} className="gap-2 px-6 bg-[#0091AD] hover:bg-[#007a94] text-white">
            <Plus className="w-5 h-5" /> New Data
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-[16px]">
        {displayedData.length === 0 ? (
          <div className="w-full text-center py-20 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
            {dataItems.length === 0 ? 'No data yet. Click "+ New Data" to upload images!' : 'No data matches your search.'}
          </div>
        ) : (
          displayedData.map((data) => {
            const fileName = data.img_path?.split(/[\\/]/).pop() || `Data #${data.id}`;
            const normalizedPath = data.img_path?.replace(/\\/g, '/');
            
            const backendUrl = api.defaults.baseURL || 'http://localhost:8080';
            const imgUrl = normalizedPath ? `${backendUrl.replace(/\/$/, '')}/${normalizedPath}` : undefined;

            const isSegmented = segmentedDataIds.has(data.id);

            return (
              <ItemCard
                key={data.id}
                name={`${fileName} (${data.type})`}
                dateCreated={
                  isSegmented 
                    ? `🟢 Segmented | ${new Date(data.created_at || Date.now()).toLocaleDateString()}` 
                    : new Date(data.created_at || Date.now()).toLocaleDateString()
                }
                thumbnailSrc={imgUrl}
                onClick={() => navigate(`/projects/${projectId}/groups/${groupId}/data/${data.id}`)}
                onRename={() => toast.info('Renaming individual images is not supported.')}
                onExport={() => alert(`Exporting data #${data.id}`)}
                onDelete={() => handleDeleteData(data.id)}
                onViewMask={
                  isSegmented 
                    ? () => openInspectModal(fileName, data.img_path, dataMaskPaths[data.id])
                    : undefined
                }
              />
            );
          })
        )}
      </div>

      <CreateModal
        isOpen={createModalOpen} 
        onClose={() => setCreateModalOpen(false)}
        onConfirm={handleCreateData} 
        type="data"
      />

      {/* LIGHTWEIGHT INTERACTIVE COMPARISON OVERLAY MODAL */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-[#393E41] p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#0091AD]" />
                <h3 className="text-lg font-bold truncate max-w-[450px]" title={previewTitle}>Segmented Mask Preview: {previewTitle}</h3>
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
                          filter: `drop-shadow(0 0 1px ${previewMaskColor})`
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 gap-1.5">
                        <span className="animate-spin text-[#0091AD] text-lg font-bold">...</span> Loading mask...
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Slider Controller */}
              <div className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col gap-2 mt-4">
                <div className="flex justify-between items-center text-xs text-gray-600 font-bold">
                  <span className="flex items-center gap-1">Mask Opacity</span>
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