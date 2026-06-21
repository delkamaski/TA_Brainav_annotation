import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/layout/dashboard';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';

export default function TrainingPage() {
  const { user } = useAuth();
  
  // Data States
  const [projects, setProjects] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  
  // Selection States
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  // Configuration States
  const [resize, setResize] = useState('256');
  const [normalizeMethod, setNormalizeMethod] = useState('divide_255');
  const [epochs, setEpochs] = useState('50');
  const [batchSize, setBatchSize] = useState('16');

  useEffect(() => {
    if (!user?.id) return;

    // 1. Fetch User's Projects
    api.get(`/project/user/${user.id}`).then(res => {
      if (res.data.success) setProjects(res.data.data || []);
    }).catch(() => toast.error("Failed to load projects"));

    // 2. Fetch User's Compiled Models
    api.get(`/parameters/model/user`).then(res => {
      if (res.data.success) setModels(res.data.data || []);
    }).catch(() => toast.error("Failed to load architectures"));
    
  }, [user?.id]);

  useEffect(() => {
    // 3. Fetch Groups dynamically with the Bulletproof Fallback
    if (selectedProject) {
      api.get(`/group/`).then(res => {
        if (res.data.success) {
          const allGroups = res.data.data || [];
          
          // Filter groups to only show the ones belonging to the selected project
          const projectGroups = allGroups.filter((g: any) => 
            String(g.project_id) === String(selectedProject) || String(g.ProjectID) === String(selectedProject)
          );
          
          // Fallback: If the backend drops the ProjectID, just show all groups
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

  const handleStartTraining = async () => {
    if (!selectedGroup) return toast.error("Please select a data group containing your dataset.");
    if (!selectedModel) return toast.error("Please select a U-Net model architecture to train.");

    const payload = {
      user_id: user?.id,
      group_id: parseInt(selectedGroup),
      model_id: parseInt(selectedModel),
      preprocessing: {
        resize: parseInt(resize),
        normalize: normalizeMethod
      },
      compile_config: {
        optimizer: "adam",
        learning_rate: 0.001,
        loss: "dice_loss",
        metrics: ["accuracy", "iou"]
      },
      train_config: {
        epochs: parseInt(epochs),
        batch_size: parseInt(batchSize),
        validation_split: 0.2
      }
    };

    try {
      const toastId = toast.loading("Submitting training job to the ML queue...");
      
      await api.post('/training/train/start', payload); 
      
      toast.success("Training sequence initiated! Check the Dashboard for progress logs.", { id: toastId });
    } catch (err: any) {
      toast.error(`Training failed to start: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-[24px] shadow-sm overflow-hidden">
        
        <div className="bg-[#0091AD] p-6">
          <h2 className="text-white text-[28px] font-bold">Configure Model Training</h2>
          <p className="text-[#fff4e4] opacity-90">Select your dataset, architecture, and hyperparameters</p>
        </div>

        <div className="p-8 flex flex-col gap-8">
          
          {/* Data & Architecture Selection */}
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-lg text-[#393E41] border-b pb-2">1. Select Inputs</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-600">Project Workspace</label>
                <select 
                  className="p-3 border-2 border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#0091AD] focus:bg-white transition-colors"
                  value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id || p.ID} value={p.id || p.ID}>{p.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-600">Dataset Group</label>
                <select 
                  className="p-3 border-2 border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-[#0091AD] focus:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}
                  disabled={!selectedProject}
                >
                  <option value="">-- Select Group --</option>
                  {groups.map(g => <option key={g.id || g.ID} value={g.id || g.ID}>{g.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[#0091AD]">U-Net Architecture</label>
                <select 
                  className="p-3 border-2 border-[#0091AD] rounded-xl bg-[#0091AD]/5 outline-none focus:border-[#0091AD] focus:bg-white transition-colors"
                  value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
                >
                  <option value="">-- Select Model --</option>
                  {models.map(m => (
                    <option key={m.id || m.ID} value={m.id || m.ID}>
                      Model #{m.id || m.ID} ({m.status || 'baseline'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Preprocessing */}
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-lg text-[#393E41] border-b pb-2">2. Preprocessing & Parameters</h3>
            <div className="grid grid-cols-4 gap-6">
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-600">Resize (H x W)</label>
                <select className="p-3 border border-gray-200 rounded-xl" value={resize} onChange={(e) => setResize(e.target.value)}>
                  <option value="128">128 x 128</option>
                  <option value="256">256 x 256</option>
                  <option value="512">512 x 512</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-600">Normalization</label>
                <select className="p-3 border border-gray-200 rounded-xl" value={normalizeMethod} onChange={(e) => setNormalizeMethod(e.target.value)}>
                  <option value="divide_255">Divide by 255</option>
                  <option value="standardize">Z-Score</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-600">Batch Size</label>
                <select className="p-3 border border-gray-200 rounded-xl" value={batchSize} onChange={(e) => setBatchSize(e.target.value)}>
                  <option value="8">8</option>
                  <option value="16">16</option>
                  <option value="32">32</option>
                  <option value="64">64</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-600">Epochs</label>
                <input 
                  type="number" min="1" max="500" 
                  className="p-3 border border-gray-200 rounded-xl outline-none focus:border-[#0091AD]" 
                  value={epochs} onChange={(e) => setEpochs(e.target.value)} 
                />
              </div>

            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button 
              onClick={handleStartTraining} 
              disabled={!selectedGroup || !selectedModel}
              className="bg-[#0091AD] hover:bg-[#007a94] text-lg px-8 py-6 rounded-2xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Launch Training Sequence
            </Button>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}