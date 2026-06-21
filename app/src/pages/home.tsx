import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import DashboardLayout from '../components/layout/dashboard';
import { toast } from 'sonner';

export default function HomePage() {
  const navigate = useNavigate();
  const [recentGroups, setRecentGroups] = useState<any[]>([]);

  useEffect(() => {
    // Fetch recent groups
    const fetchGroups = async () => {
      try {
        const res = await api.get('/group/');
        if (res.data.success) {
          // Sort by newest and take top 4
          const sorted = res.data.data.sort((a: any, b: any) => b.ID - a.ID).slice(0, 4);
          setRecentGroups(sorted);
        }
      } catch (err: any) {
        toast.error('Failed to load recent groups');
      }
    };
    fetchGroups();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        
        {/* Top Widgets */}
        <div className="flex gap-8">
          {/* Terminal / Training Progress */}
          <div className="flex-1 bg-[#393e41] border-[6px] border-black rounded-[16px] h-[350px] flex flex-col overflow-hidden shadow-lg">
            <div className="bg-black/50 px-4 py-2 border-b border-black flex items-center">
              <span className="text-white font-bold tracking-wider text-sm">TRAINING_PROGRESS_LOG</span>
            </div>
            <div className="p-4 font-mono text-xs text-green-400 overflow-y-auto h-full flex flex-col gap-1">
              <p>&gt; Initializing U-Net Model Architecture...</p>
<p>&gt; Loading dataset from Project_ID: 12, Group_ID: 45...</p>
<p>&gt; Preprocessing: Resize (256x256), Normalize (divide_255)...</p>
<p>&gt; Starting Epoch 1/50</p>
<p className="text-yellow-400">&gt; Epoch 1: loss: 0.6841 - accuracy: 0.6421 - val_loss: 0.6521 - val_accuracy: 0.6912</p>
<p className="text-yellow-400">&gt; Epoch 2: loss: 0.5121 - accuracy: 0.7812 - val_loss: 0.5812 - val_accuracy: 0.7512</p>
<p className="animate-pulse">&gt; Epoch 3: Training in progress [=====&gt;............] 34%</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="w-[350px] bg-[#393e41] rounded-[16px] h-[350px] p-6 shadow-lg flex flex-col">
            <h3 className="text-white text-2xl font-bold mb-6">Overview</h3>
            <div className="flex flex-col gap-4">
              <div className="bg-white/10 p-4 rounded-xl flex justify-between items-center text-white">
                <span>Total Projects</span>
                <span className="font-bold text-xl text-[#0091AD]">12</span>
              </div>
              <div className="bg-white/10 p-4 rounded-xl flex justify-between items-center text-white">
                <span>Total Datasets</span>
                <span className="font-bold text-xl text-[#0091AD]">1,248</span>
              </div>
              <div className="bg-white/10 p-4 rounded-xl flex justify-between items-center text-white">
                <span>Trained Models</span>
                <span className="font-bold text-xl text-[#0091AD]">3</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Groups */}
        <div>
          <h2 className="text-[#393E41] text-[28px] font-bold mb-4">Recent Workspaces</h2>
          <div className="flex gap-4 flex-wrap">
            {recentGroups.length === 0 ? (
              <p className="text-[#747677]">No recent groups found.</p>
            ) : (
              recentGroups.map((group) => (
                <div 
                  key={group.ID} 
                  onClick={() => navigate(`/projects/${group.project_id}/groups/${group.ID}/data`)}
                  className="w-[250px] bg-white border-2 border-transparent hover:border-[#0091AD] shadow-sm rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md"
                >
                  <h4 className="font-bold text-[#393E41] text-lg truncate">{group.name}</h4>
                  <p className="text-xs text-[#747677] mt-2">Project ID: {group.project_id}</p>
                  <p className="text-xs text-[#747677] mt-1">Modified: {new Date(group.UpdatedAt).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}