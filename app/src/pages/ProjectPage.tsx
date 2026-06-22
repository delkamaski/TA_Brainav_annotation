import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/layout/dashboard';
import { ItemCard } from '../components/layout/itemcard';
import { CreateModal } from '../components/layout/createmodal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth(); // Safely retrieve user session from Context
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [projects, setProjects] = useState<any[]>([]);

  const fetchProjects = async () => {
    if (!user?.id) return;
    try {
      const res = await api.get(`/project/user/${user.id}`);
      if (res.data.success) {
        setProjects(res.data.data || []);
      }
    } catch (err: any) {
      console.error("Fetch projects error:", err);
      toast.error(err.response?.data?.message || "Failed to fetch projects");
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchProjects();
    }
  }, [user?.id]);

  const handleCreateProject = async (name: string) => {
    if (!user?.id) return;
    try {
      // POST to /project/ 
      await api.post(`/project/`, {
        name: name,
        user_id: user.id, 
      });
      
      toast.success("Project created successfully!");
      setCreateModalOpen(false); // Close the modal on success
      fetchProjects(); // Refresh the list
      
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to create project";
      toast.error(`Error: ${errorMsg}`);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if(!window.confirm("Are you sure you want to delete this project? All groups and datasets will be permanently lost.")) return;
    try {
      await api.delete(`/project/${projectId}`);
      toast.success("Project deleted successfully");
      fetchProjects();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete project");
    }
  };

  const handleRenameProject = async (projectId: number, newName: string) => {
    if (!user?.id) return;
    try {
      await api.put(`/project/${projectId}`, {
        name: newName,
        user_id: user.id
      });
      toast.success("Project renamed successfully");
      fetchProjects();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to rename project");
    }
  };

  const displayedProjects = projects
    .filter((p) => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const idA = a.id || a.ID || 0;
      const idB = b.id || b.ID || 0;
      if (sortBy === 'newest') return idB - idA;
      if (sortBy === 'oldest') return idA - idB;
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

  return (
    <DashboardLayout>
      
      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[32px] font-bold text-[var(--foreground)]">Projects</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Manage your annotation workspaces</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              type="text" 
              placeholder="Search projects..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white rounded-xl"
            />
          </div>
          
          <Button variant="outline" onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')} className="gap-2">
            <ArrowUpDown className="w-4 h-4" /> {sortBy}
          </Button>

          <Button onClick={() => setCreateModalOpen(true)} className="gap-2 px-6 bg-[#0091AD] hover:bg-[#007a94] text-white">
            <Plus className="w-5 h-5" /> New Project
          </Button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex flex-wrap gap-[16px]">
        {displayedProjects.length === 0 ? (
          <div className="w-full text-center py-20 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
            {projects.length === 0 
              ? 'No projects yet. Click "+ New Project" to get started!' 
              : 'No projects match your search.'}
          </div>
        ) : (
          displayedProjects.map((project) => {
            const projectId = project.id || project.ID;
            return (
              <ItemCard
                key={projectId}
                name={project.name || 'Unnamed Project'}
                dateCreated={new Date(project.CreatedAt || project.created_at || Date.now()).toLocaleDateString()}
                onClick={() => navigate(`/projects/${projectId}/groups`)}
                onRename={() => {
                  const newName = window.prompt("Enter new project name:", project.name || "");
                  if (newName && newName.trim() !== "") {
                    handleRenameProject(projectId, newName);
                  }
                }}
                onExport={() => alert(`Exporting project "${project.name}"...`)}
                onDelete={() => handleDeleteProject(projectId)}
              />
            );
          })
        )}
      </div>

      <CreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onConfirm={handleCreateProject}
        type="project"
      />

    </DashboardLayout>
  );
}