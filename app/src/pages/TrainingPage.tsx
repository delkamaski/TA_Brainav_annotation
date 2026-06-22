import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/layout/dashboard';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, X, Search, Activity, Play, CheckCircle2, AlertTriangle, Eye, ArrowUpDown, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TrainingPage() {
  const { user } = useAuth();
  
  // View Toggle State
  const [showForm, setShowForm] = useState(false);
  const [trainingJobs, setTrainingJobs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Modal / Detail Inspector State
  const [inspectJob, setInspectJob] = useState<any>(null);

  // Form Data States
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

  // Load User's Training Jobs
  const fetchTrainingJobs = async () => {
    if (!user?.id) return;
    try {
      const res = await api.get('/training/user');
      if (res.data.success) {
        setTrainingJobs(res.data.data || []);
      }
    } catch (err: any) {
      toast.error("Failed to load training jobs");
    }
  };

  useEffect(() => {
    fetchTrainingJobs();

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
          if (data.type === 'training_status_update' || data.type === 'training_epoch_update') {
            fetchTrainingJobs();
            
            // If the user currently has this job open in the logs inspector modal, reload its details
            if (inspectJob && (inspectJob.id === data.job_id || inspectJob.id === data.JobID)) {
              api.get(`/training/train/${inspectJob.id}`).then(res => {
                if (res.data.success) {
                  setInspectJob(res.data.data);
                }
              }).catch(err => console.error("Failed to inspect training update", err));
            }
          }
        } catch (err) {
          console.error("Training ws error:", err);
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
  }, [user?.id, inspectJob?.id]);

  // Load Form Data when showing Form
  useEffect(() => {
    if (!showForm || !user?.id) return;

    // 1. Fetch User's Projects
    api.get(`/project/user/${user.id}`).then(res => {
      if (res.data.success) setProjects(res.data.data || []);
    }).catch(() => toast.error("Failed to load projects"));

    // 2. Fetch User's Compiled Models
    api.get(`/model/user`).then(res => {
      if (res.data.success) setModels(res.data.data || []);
    }).catch(() => toast.error("Failed to load architectures"));
    
  }, [showForm, user?.id]);

  // Fetch groups dynamically when project selection changes
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

  const handleStartTraining = async () => {
    if (!selectedGroup) return toast.error("Please select a data group containing your dataset.");
    if (!selectedModel) return toast.error("Please select a U-Net model architecture to train.");

    const payload = {
      user_id: user?.id,
      group_id: parseInt(selectedGroup),
      model_id: parseInt(selectedModel),
      preprocessing: {
        resize: {
          target_height: parseInt(resize),
          target_width: parseInt(resize)
        },
        normalize: {
          method: normalizeMethod
        }
      },
      compile_config: {
        optimizer: {
          name: "adam",
          learning_rate: 0.001
        },
        loss: {
          name: "dice_loss"
        },
        metrics: {
          names: ["accuracy", "iou"]
        }
      },
      train_config: {
        epochs: parseInt(epochs),
        batch_size: parseInt(batchSize),
        validation_split: 0.2
      }
    };

    try {
      const toastId = toast.loading("Submitting training job to the ML queue...");
      await api.post('/training/train', payload); 
      toast.success("Training sequence initiated! Check the Dashboard for progress logs.", { id: toastId });
      
      // Reset selection and return to table view
      setSelectedProject('');
      setSelectedGroup('');
      setSelectedModel('');
      setShowForm(false);
      fetchTrainingJobs();
    } catch (err: any) {
      toast.error(`Training failed to start: ${err.response?.data?.message || err.message}`);
    }
  };

  // Filter & Sort Jobs
  const displayedJobs = trainingJobs
    .filter((job) => 
      `Job #${job.id}`.toLowerCase().includes(searchQuery.toLowerCase()) || 
      `Model #${job.model_id}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.status.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'newest') return b.id - a.id;
      if (sortBy === 'oldest') return a.id - b.id;
      return 0;
    });

  // Render Status Pill
  const renderStatus = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case 'training':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Activity className="w-3.5 h-3.5 animate-spin" /> Training
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-gray-50 text-gray-700 border border-gray-200">
            <Play className="w-3.5 h-3.5" /> Pending
          </span>
        );
    }
  };

  // Safe JSON Parser for detail display
  const safeParseJSON = (jsonVal: any, defaultValue: any = {}) => {
    if (!jsonVal) return defaultValue;
    if (typeof jsonVal === 'object') return jsonVal;
    try {
      return JSON.parse(jsonVal);
    } catch (e) {
      return defaultValue;
    }
  };

  const getResizeText = (preprocessing: any) => {
    const prep = safeParseJSON(preprocessing);
    if (!prep || !prep.resize) return '256 px';
    if (typeof prep.resize === 'object') {
      return `${prep.resize.target_height || 256} px`;
    }
    return `${prep.resize} px`;
  };

  const getNormalizeText = (preprocessing: any) => {
    const prep = safeParseJSON(preprocessing);
    if (!prep || !prep.normalize) return 'None';
    let method = '';
    if (typeof prep.normalize === 'object') {
      method = prep.normalize.method || 'None';
    } else {
      method = prep.normalize;
    }
    return method === 'divide_255' ? '1/255' : method;
  };

  return (
    <DashboardLayout>
      <div className="mb-4 text-[#747677] text-sm">
        <Link to="/home" className="hover:text-[#0091AD] hover:underline">Dashboard</Link> /{' '}
        <Link to="/training" className="hover:text-[#0091AD] hover:underline">Training</Link>
      </div>

      {!showForm ? (
        /* TABLE LISTING VIEW */
        <>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-[32px] font-bold text-[var(--foreground)]">Model Training Runs</h2>
              <p className="text-[var(--muted)] text-sm mt-1">Submit, monitor, and inspect model training parameters and weights</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  type="text" placeholder="Search training runs..." 
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[250px] bg-white rounded-xl"
                />
              </div>
              
              <Button variant="outline" onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')} className="gap-2">
                <ArrowUpDown className="w-4 h-4" /> {sortBy}
              </Button>

              <Button onClick={() => setShowForm(true)} className="gap-2 px-6 bg-[#0091AD] hover:bg-[#007a94] text-white">
                <Plus className="w-5 h-5" /> Train Model
              </Button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-[24px] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 font-bold text-xs uppercase tracking-wider">
                    <th className="py-4 px-6">Job ID</th>
                    <th className="py-4 px-6">Model Architecture</th>
                    <th className="py-4 px-6">Dataset Group</th>
                    <th className="py-4 px-6">Preprocessing</th>
                    <th className="py-4 px-6">Epochs / Batch</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-center">Logs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                  {displayedJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-gray-400 bg-white">
                        No training runs found. Click "+ Train Model" to configure and launch a new job!
                      </td>
                    </tr>
                  ) : (
                    displayedJobs.map((job) => {
                      const trainConfig = safeParseJSON(job.train_config);
                      
                      return (
                        <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-6 font-bold text-[#0091AD]">Job #{job.id}</td>
                          <td className="py-4 px-6 font-semibold">Model Architecture #{job.model_id}</td>
                          <td className="py-4 px-6">Group #{job.group_id}</td>
                          <td className="py-4 px-6">
                            <span className="bg-gray-100 px-2.5 py-1 rounded text-xs text-gray-600">
                              {getResizeText(job.preprocessing)} ({getNormalizeText(job.preprocessing)})
                            </span>
                          </td>
                          <td className="py-4 px-6 font-mono text-xs">
                            {trainConfig.epochs || 50} Epochs / Batch size {trainConfig.batch_size || 16}
                          </td>
                          <td className="py-4 px-6">{renderStatus(job.status)}</td>
                          <td className="py-4 px-6 text-center">
                            <Button 
                              variant="ghost" 
                              onClick={() => setInspectJob(job)}
                              className="text-[#0091AD] hover:text-[#007a94] hover:bg-[#0091AD]/5 gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                            >
                              <Eye className="w-3.5 h-3.5" /> Inspect Logs
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* TRAINING CONFIGURATION FORM VIEW */
        <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-[24px] shadow-sm overflow-hidden">
          <div className="bg-[#0091AD] p-6 flex justify-between items-center">
            <div>
              <h2 className="text-white text-[28px] font-bold">Configure Model Training</h2>
              <p className="text-[#fff4e4] opacity-90">Select your dataset, architecture, and hyperparameters</p>
            </div>
            <button 
              onClick={() => setShowForm(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-8 flex flex-col gap-8">
            {/* Inputs Selection */}
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

            <div className="pt-4 flex justify-end gap-4">
              <Button 
                variant="outline"
                onClick={() => setShowForm(false)}
                className="text-lg px-8 py-6 rounded-2xl"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleStartTraining} 
                disabled={!selectedGroup || !selectedModel}
                className="bg-[#0091AD] hover:bg-[#007a94] text-white text-lg px-8 py-6 rounded-2xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Launch Training Sequence
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL INSPECTOR MODAL */}
      {inspectJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#393E41] p-5 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-bold">Job #{inspectJob.id} Run Details</h3>
                <p className="text-xs text-gray-300 mt-0.5">Status: <span className="font-semibold uppercase text-yellow-400">{inspectJob.status}</span></p>
              </div>
              <button 
                onClick={() => setInspectJob(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 text-sm">
              {/* Configurations Summary */}
              <div>
                <h4 className="font-bold text-[#393E41] uppercase tracking-wider text-xs border-b pb-1.5 mb-3">Parameters</h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl text-xs">
                  <div>
                    <span className="text-gray-500 block mb-0.5">Model Architecture</span>
                    <span className="font-semibold text-gray-800">Model #{inspectJob.model_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Dataset Group</span>
                    <span className="font-semibold text-gray-800">Group #{inspectJob.group_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Preprocessing config</span>
                    <span className="font-semibold text-gray-800">
                      Resize {getResizeText(inspectJob.preprocessing)} | Normalize: {getNormalizeText(inspectJob.preprocessing)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Hyperparameters</span>
                    <span className="font-semibold text-gray-800">
                      Epochs: {safeParseJSON(inspectJob.train_config).epochs || 50} | Batch Size: {safeParseJSON(inspectJob.train_config).batch_size || 16}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weights Path (If Available) */}
              {inspectJob.result_path && (
                <div>
                  <h4 className="font-bold text-[#393E41] uppercase tracking-wider text-xs border-b pb-1.5 mb-2">Trained Weights Output</h4>
                  <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl font-mono text-xs truncate">
                    {inspectJob.result_path}
                  </div>
                </div>
              )}

              {/* Training Logs History */}
              <div className="flex-1 flex flex-col min-h-[200px]">
                <h4 className="font-bold text-[#393E41] uppercase tracking-wider text-xs border-b pb-1.5 mb-3 shrink-0">Training History / Epoch Metrics</h4>
                <div className="bg-black rounded-2xl p-4 font-mono text-xs text-green-400 overflow-y-auto flex-1 max-h-[300px]">
                  {(() => {
                    const parsedLogs = safeParseJSON(inspectJob.logs, null);
                    if (!parsedLogs) {
                      return <p className="text-gray-500 italic">&gt; No history data found for this run.</p>;
                    }

                    // Check if it is an array
                    if (Array.isArray(parsedLogs)) {
                      return parsedLogs.map((log: any, idx: number) => (
                        <p key={idx}>
                          &gt; Epoch {log.epoch || idx + 1}: loss: {typeof log.loss === 'number' ? log.loss.toFixed(4) : log.loss || 'N/A'} - acc: {typeof log.accuracy === 'number' ? log.accuracy.toFixed(4) : log.accuracy || 'N/A'} - val_loss: {typeof log.val_loss === 'number' ? log.val_loss.toFixed(4) : log.val_loss || 'N/A'}
                        </p>
                      ));
                    }

                    // Check if it is an object with array values
                    if (typeof parsedLogs === 'object') {
                      // Maybe key loss, accuracy exist
                      const keys = Object.keys(parsedLogs);
                      const length = Array.isArray(parsedLogs[keys[0]]) ? parsedLogs[keys[0]].length : 0;
                      if (length > 0) {
                        const list = [];
                        for (let i = 0; i < length; i++) {
                          const parts = [];
                          for (const key of keys) {
                            const val = parsedLogs[key][i];
                            parts.push(`${key}: ${typeof val === 'number' ? val.toFixed(4) : val}`);
                          }
                          list.push(<p key={i}>&gt; Epoch {i + 1}: {parts.join(' - ')}</p>);
                        }
                        return list;
                      }

                      // Print raw key values
                      return (
                        <pre className="text-green-300 whitespace-pre-wrap font-sans">
                          {JSON.stringify(parsedLogs, null, 2)}
                        </pre>
                      );
                    }

                    return <p className="text-gray-500 italic">&gt; Logs format not recognized: {String(parsedLogs)}</p>;
                  })()}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <Button 
                onClick={() => setInspectJob(null)}
                className="bg-[#393E41] hover:bg-[#2d3133] text-white rounded-xl"
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}