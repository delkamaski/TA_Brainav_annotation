import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import DashboardLayout from '../components/layout/dashboard';
import { toast } from 'sonner';

export default function HomePage() {
  const navigate = useNavigate();
  const [recentGroups, setRecentGroups] = useState<any[]>([]);
  const [trainingLogs, setTrainingLogs] = useState<string[]>([
    'Initializing training log stream...',
  ]);
  const [inferenceLogs, setInferenceLogs] = useState<string[]>([
    'Initializing inference log stream...',
  ]);

  const trainingEndRef = useRef<HTMLDivElement>(null);
  const inferenceEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    trainingEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [trainingLogs]);

  useEffect(() => {
    inferenceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [inferenceLogs]);

  useEffect(() => {
    // Fetch recent groups
    const fetchGroups = async () => {
      try {
        const res = await api.get('/group/');
        if (res.data.success) {
          // Sort by newest and take top 4
          const allGroups = res.data.data || [];
          const sorted = allGroups.sort((a: any, b: any) => b.ID - a.ID).slice(0, 4);
          setRecentGroups(sorted);
        }
      } catch (err: any) {
        toast.error('Failed to load recent groups');
      }
    };
    fetchGroups();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    let ws: WebSocket;
    let reconnectTimeout: any;

    const connectWS = () => {
      const backendUrl = api.defaults.baseURL || 'http://localhost:8080';
      const wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws/notifications';
      
      ws = new WebSocket(wsUrl, [token]);

      ws.onopen = () => {
        setTrainingLogs(prev => [...prev, 'Connected to notification server.']);
        setInferenceLogs(prev => [...prev, 'Connected to notification server.']);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'training_epoch_update') {
            const logStr = `[Job #${data.job_id}] Epoch ${data.epoch}: ` + 
              Object.entries(data.logs || {})
                .map(([k, v]: [string, any]) => `${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`)
                .join(' | ');
            setTrainingLogs(prev => [...prev, logStr]);
          } else if (data.type === 'training_status_update') {
            let logStr = `[Job #${data.job_id}] Status: ${data.status.toUpperCase()}`;
            if (data.result_path) logStr += ` | Result: ${data.result_path}`;
            if (data.error) logStr += ` | Error: ${data.error}`;
            setTrainingLogs(prev => [...prev, logStr]);
          } else if (data.type === 'prediction_started') {
            const logStr = `[Inference] Queue started for Data ID: ${data.data_id} (Status: ${data.status})`;
            setInferenceLogs(prev => [...prev, logStr]);
          } else if (data.type === 'prediction_completed') {
            let logStr = `[Inference] Queue completed for Data ID: ${data.data_id} (Status: ${data.status})`;
            if (data.mask_path) logStr += ` | Mask Path: ${data.mask_path}`;
            if (data.error) logStr += ` | Error: ${data.error}`;
            setInferenceLogs(prev => [...prev, logStr]);
          }
        } catch (err) {
          console.error("Failed to parse websocket message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      ws.onclose = () => {
        setTrainingLogs(prev => [...prev, 'Disconnected from notification server. Reconnecting...']);
        setInferenceLogs(prev => [...prev, 'Disconnected from notification server. Reconnecting...']);
        reconnectTimeout = setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        
        {/* Top Widgets */}
        <div className="flex gap-8 items-stretch">
          
          {/* Training Logs Terminal */}
          <div className="flex-1 bg-[#393e41] border-[6px] border-black rounded-[16px] h-[350px] flex flex-col overflow-hidden shadow-lg">
            <div className="bg-black/50 px-4 py-2 border-b border-black flex items-center justify-between">
              <span className="text-white font-bold tracking-wider text-xs">TRAINING_LOGS_STREAM</span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
            </div>
            <div className="p-4 font-mono text-xs text-green-400 overflow-y-auto h-full flex flex-col gap-1 select-text">
              {trainingLogs.map((log, i) => (
                <p key={i}>&gt; {log}</p>
              ))}
              <div ref={trainingEndRef} />
            </div>
          </div>

          {/* Inference Logs Terminal */}
          <div className="flex-1 bg-[#393e41] border-[6px] border-black rounded-[16px] h-[350px] flex flex-col overflow-hidden shadow-lg">
            <div className="bg-black/50 px-4 py-2 border-b border-black flex items-center justify-between">
              <span className="text-white font-bold tracking-wider text-xs">INFERENCE_LOGS_STREAM</span>
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse"></span>
            </div>
            <div className="p-4 font-mono text-xs text-cyan-400 overflow-y-auto h-full flex flex-col gap-1 select-text">
              {inferenceLogs.map((log, i) => (
                <p key={i}>&gt; {log}</p>
              ))}
              <div ref={inferenceEndRef} />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="w-[350px] bg-[#393e41] rounded-[16px] h-[350px] p-6 shadow-lg flex flex-col justify-between shrink-0">
            <h3 className="text-white text-2xl font-bold mb-4">Overview</h3>
            <div className="flex flex-col gap-4 flex-1 justify-center">
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