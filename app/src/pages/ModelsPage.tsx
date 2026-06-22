import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import DashboardLayout from '../components/layout/dashboard';
import { ItemCard } from '../components/layout/itemcard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

export default function ModelsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [models, setModels] = useState<any[]>([]);

  const fetchModels = async () => {
    try {
      // FIX: Changed from '/model/user' to point to our newly created endpoint
      const res = await api.get('/model/user');
      
      if (res.data.success) {
        setModels(res.data.data || []);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to fetch models");
    }
  };

  useEffect(() => {
    fetchModels();

    const token = localStorage.getItem('access_token');
    if (!token) return;

    let ws: WebSocket;
    let reconnectTimeout: any;

    const connectWS = () => {
      const backendUrl = api.defaults.baseURL || 'http://localhost:8080';
      const wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws/notifications';
      
      ws = new WebSocket(wsUrl, [token]);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'model_status_update') {
            fetchModels();
          }
        } catch (err) {
          console.error("Models ws error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleDeleteModel = async (id: number) => {
    if (!window.confirm(`Are you sure you want to delete Model #${id}?`)) return;
    
    try {
      await api.delete(`/model/${id}`);
      toast.success("Model deleted successfully!");
      fetchModels(); // Refresh the grid
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete model");
    }
  };

  const displayedModels = models
    .filter((m) => `Model #${m.id}`.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'newest') return b.id - a.id;
      if (sortBy === 'oldest') return a.id - b.id;
      return 0;
    });

  return (
    <DashboardLayout>
      <div className="mb-4 text-[#747677] text-sm">
        <Link to="/home" className="hover:text-[#0091AD] hover:underline">Dashboard</Link> /{' '}
        <Link to="/models" className="hover:text-[#0091AD] hover:underline">Models</Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[32px] font-bold text-[var(--foreground)]">Model Architectures</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Design and manage U-Net structures</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              type="text" placeholder="Search models..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white rounded-xl"
            />
          </div>
          
          <Button variant="outline" onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')} className="gap-2">
            <ArrowUpDown className="w-4 h-4" /> {sortBy}
          </Button>

          {/* Navigates to a "new" ID to spawn a blank canvas */}
          <Button onClick={() => navigate('/models/new/editor')} className="gap-2 px-6 bg-[#0091AD] hover:bg-[#007a94] text-white">
            <Plus className="w-5 h-5" /> New Architecture
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-[16px]">
        {displayedModels.length === 0 ? (
          <div className="w-full text-center py-20 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
            {models.length === 0 ? 'No models yet. Click "+ New Architecture" to build a U-Net!' : 'No models match your search.'}
          </div>
        ) : (
          displayedModels.map((model) => (
            <ItemCard
              key={model.id}
              name={`U-Net Architecture #${model.id}`}
              dateCreated={`Status: ${model.status || 'baseline'}`}
              onClick={() => navigate(`/models/${model.id}/editor`)}
              onRename={() => toast.info('Models cannot be renamed')}
              onExport={() => alert(`Exporting Model #${model.id} Weights...`)}
              onDelete={() => handleDeleteModel(model.id)}
            />
          ))
        )}
      </div>
    </DashboardLayout>
  );
}