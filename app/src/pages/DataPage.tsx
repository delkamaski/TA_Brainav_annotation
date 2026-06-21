import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import DashboardLayout from '../components/layout/dashboard';
import { ItemCard } from '../components/layout/itemcard';
import { CreateModal } from '../components/layout/createmodal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, ArrowUpDown } from 'lucide-react';
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

  useEffect(() => {
    const fetchBreadcrumbNames = async () => {
      try {
        if (projectId) {
          const pRes = await api.get(`/project/${projectId}`);
          if (pRes.data.success) setProjectName(pRes.data.data.name);
        }
        if (groupId) {
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
    } catch (err) { 
      toast.error("Failed to fetch data"); 
    }
  };

  useEffect(() => { if (groupId) fetchData(); }, [groupId]);

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
            
            // FIX: Point directly to your Go backend port (Change 8080 if your Go server uses a different port)
            const backendUrl = api.defaults.baseURL || 'http://localhost:8080';
            const imgUrl = normalizedPath ? `${backendUrl.replace(/\/$/, '')}/${normalizedPath}` : undefined;

            return (
              <ItemCard
                key={data.id}
                name={`${fileName} (${data.type})`}
                dateCreated={new Date(data.created_at || Date.now()).toLocaleDateString()}
                thumbnailSrc={imgUrl}
                onClick={() => navigate(`/projects/${projectId}/groups/${groupId}/data/${data.id}`)}
                onRename={() => toast.info('Renaming individual images is not supported.')}
                onExport={() => alert(`Exporting data #${data.id}`)}
                onDelete={() => handleDeleteData(data.id)}
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
    </DashboardLayout>
  );
}