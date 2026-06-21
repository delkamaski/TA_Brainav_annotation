import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Handle, Position, applyNodeChanges, applyEdgeChanges, Node, Edge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import DashboardLayout from '../components/layout/dashboard';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

// --- CUSTOM LAYER NODE DESIGN ---
const LayerNode = ({ data, selected }: { data: any, selected: boolean }) => {
  const getColors = () => {
    switch (data.type) {
      case 'Input': return 'bg-gray-200 border-gray-500 text-gray-800';
      case 'Conv2D': return 'bg-blue-100 border-blue-500 text-blue-800';
      case 'MaxPool2D': return 'bg-red-100 border-red-500 text-red-800';
      case 'UpConv2D': return 'bg-green-100 border-green-500 text-green-800';
      case 'Concat': return 'bg-purple-100 border-purple-500 text-purple-800';
      case 'Output': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      default: return 'bg-white border-gray-400';
    }
  };

  return (
    <div className={`px-4 py-2 rounded-lg border-2 shadow-sm min-w-[120px] text-center transition-all ${getColors()} ${selected ? 'ring-4 ring-[#0091AD] shadow-lg' : ''}`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-gray-600" />
      {data.type === 'Concat' && <Handle type="target" id="top" position={Position.Top} className="w-3 h-3 !bg-purple-600" />}
      
      <div className="font-bold text-sm">{data.label as string}</div>
      <div className="text-[10px] opacity-80 mt-1 flex flex-col">
        {Object.entries(data.params || {}).map(([k, v]) => (
          <span key={k}>{k}: {String(v)}</span>
        ))}
      </div>
      
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-gray-600" />
    </div>
  );
};

export default function ModelEditorPage() {
  const { modelId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const nodeTypes = useMemo(() => ({ layer: LayerNode }), []);
  
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes]);
  const onEdgesChange = useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);
  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  useEffect(() => {
    if (modelId && modelId !== 'new') {
      api.get(`/parameters/model/${modelId}`).then(res => {
        if (res.data.success && res.data.data.layers) {
          const loadedLayers = res.data.data.layers;
          
          const loadedNodes: Node[] = loadedLayers.map((layer: any, index: number) => ({
            id: `node-${index}`,
            type: 'layer',
            position: { x: 250 * index, y: 200 },
            data: { label: layer.function_name, type: layer.function_name, params: layer.parameters }
          }));
          
          const loadedEdges: Edge[] = loadedLayers.slice(0, -1).map((_: any, index: number) => ({
            id: `edge-${index}`,
            source: `node-${index}`,
            target: `node-${index + 1}`
          }));

          setNodes(loadedNodes);
          setEdges(loadedEdges);
        }
      }).catch(err => toast.error("Failed to load model architecture"));
    } else {
      setNodes([{
        id: `Input-${Date.now()}`,
        type: 'layer',
        position: { x: 100, y: 200 },
        data: { label: 'Input', type: 'Input', params: { shape: '256,256,3' } },
      }]);
    }
  }, [modelId, setNodes, setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
    const position = reactFlowBounds 
      ? { x: event.clientX - reactFlowBounds.left - 60, y: event.clientY - reactFlowBounds.top - 20 }
      : { x: 100, y: 100 };
    
    let defaultParams = {};
    if (type === 'Conv2D') defaultParams = { filters: 64, kernel_size: 3, activation: 'relu', padding: 'same' };
    if (type === 'MaxPool2D') defaultParams = { pool_size: 2, strides: 2 };
    if (type === 'Input') defaultParams = { shape: '256,256,3' };
    if (type === 'Output') defaultParams = { filters: 1, kernel_size: 1, activation: 'sigmoid' };

    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type: 'layer',
      position,
      data: { label: type, type: type, params: defaultParams },
    };

    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const onNodeClick = (event: React.MouseEvent, node: Node) => setSelectedNode(node);
  const onPaneClick = () => setSelectedNode(null);

  const updateNodeParam = (key: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (selectedNode && n.id === selectedNode.id) {
          const updatedNode = { ...n, data: { ...n.data, params: { ...(n.data as any).params, [key]: value } } };
          setSelectedNode(updatedNode);
          return updatedNode;
        }
        return n;
      })
    );
  };

  const handleSaveToBackend = async () => {
    if (!user?.id) return toast.error("User session not found.");
    setIsLoading(true);

    // ==========================================
    // TOPOLOGICAL SORT: Read cables, not array history
    // ==========================================
    const inDegree: Record<string, number> = {};
    const adjList: Record<string, string[]> = {};

    nodes.forEach(n => {
      inDegree[n.id] = 0;
      adjList[n.id] = [];
    });

    edges.forEach(e => {
      if (adjList[e.source] !== undefined) {
        adjList[e.source].push(e.target);
        inDegree[e.target] = (inDegree[e.target] || 0) + 1;
      }
    });

    const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0);
    const sortedNodeIds: string[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      sortedNodeIds.push(currentId);

      adjList[currentId].forEach(neighbor => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Safety check: Did they leave a node floating without cables?
    if (sortedNodeIds.length !== nodes.length) {
      setIsLoading(false);
      return toast.error("Validation Failed: Ensure all layers are fully connected with cables and there are no circular loops.");
    }

    // Map them back to the full Node objects in the perfect execution order
    const sortedNodes = sortedNodeIds.map(id => nodes.find(n => n.id === id)!);
    // ==========================================

    const payload = {
      user_id: user.id,
      layers: sortedNodes.map(n => {
        const params = { ...(n.data as any).params };
        if (params.filters) params.filters = Number(params.filters);
        if (params.kernel_size) params.kernel_size = Number(params.kernel_size);
        if (params.pool_size) params.pool_size = Number(params.pool_size);

        return {
          function_name: n.data.type,
          parameters: params
        };
      })
    };
    
    try {
      if (modelId === 'new') {
        await api.post('/parameters/model', payload);
        toast.success("Architecture compiled and saved successfully!");
      } else {
        await api.put(`/parameters/model/${modelId}`, payload);
        toast.success("Architecture updated successfully!");
      }
      navigate('/models'); 
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save architecture");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
        
        <div className="flex flex-col bg-white p-4 rounded-[16px] shadow-sm border border-gray-200">
           <div className="mb-2 text-[#747677] text-sm">
             <Link to="/home" className="hover:text-[#0091AD] hover:underline">Dashboard</Link> /{' '}
             <Link to="/models" className="hover:text-[#0091AD] hover:underline">Models</Link> /{' '}
             <span className="text-gray-400">Editor</span>
           </div>
           
           <div className="flex justify-between items-center">
             <h1 className="text-[#393E41] text-[24px] font-bold">
               {modelId === 'new' ? 'Design New Architecture' : `Viewing Architecture #${modelId}`}
             </h1>
             <Button onClick={handleSaveToBackend} disabled={isLoading} className="bg-[#0091AD] hover:bg-[#007a94]">
               {isLoading ? 'Saving...' : modelId === 'new' ? 'Save & Compile Baseline' : 'Update Architecture'}
             </Button>
           </div>
        </div>

        <div className="flex h-full gap-4 min-h-0">
          <div className="w-[200px] bg-white border border-gray-200 rounded-[16px] p-4 flex flex-col gap-3 shadow-sm shrink-0 overflow-y-auto">
             <h3 className="font-bold text-[#393E41] border-b pb-2">Layers Library</h3>
             <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'Input')} className="bg-gray-200 border-gray-500 text-gray-800 p-2 rounded cursor-grab text-sm text-center font-bold">Input</div>
             <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'Conv2D')} className="bg-blue-100 border-blue-500 text-blue-800 p-2 rounded cursor-grab text-sm text-center font-bold">Conv2D</div>
             <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'MaxPool2D')} className="bg-red-100 border-red-500 text-red-800 p-2 rounded cursor-grab text-sm text-center font-bold">MaxPool2D</div>
             <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'UpConv2D')} className="bg-green-100 border-green-500 text-green-800 p-2 rounded cursor-grab text-sm text-center font-bold">UpConv2D</div>
             <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'Concat')} className="bg-purple-100 border-purple-500 text-purple-800 p-2 rounded cursor-grab text-sm text-center font-bold">Concat (Skip)</div>
             <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'Output')} className="bg-yellow-100 border-yellow-500 text-yellow-800 p-2 rounded cursor-grab text-sm text-center font-bold">Output (Sigmoid)</div>
          </div>

          <div className="flex-1 bg-[#f9fafb] border-2 border-dashed border-gray-300 rounded-[16px] overflow-hidden relative" onDrop={onDrop} onDragOver={onDragOver}>
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onConnect={onConnect} nodeTypes={nodeTypes}
              onNodeClick={onNodeClick} onPaneClick={onPaneClick}
              fitView deleteKeyCode={['Backspace', 'Delete']}
            >
              <Controls />
              <MiniMap />
              <Background color="#ccc" gap={16} />
            </ReactFlow>
          </div>

          {selectedNode && (
            <div className="w-[250px] bg-white border border-[#0091AD] rounded-[16px] p-4 flex flex-col gap-4 shadow-lg shrink-0">
              <h3 className="font-bold text-[#0091AD] border-b pb-2">Layer Properties</h3>
              <p className="text-sm font-bold text-gray-700">{selectedNode.data.label as string}</p>
              
              {Object.entries((selectedNode.data as any).params || {}).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 capitalize">{key.replace('_', ' ')}</label>
                  <Input 
                    value={value as string} 
                    onChange={(e) => updateNodeParam(key, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
              <p className="text-[10px] text-gray-400 mt-4 leading-tight italic">
                Note: Numeric parameters (filters, kernel_size) are automatically cast to numbers on save.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}