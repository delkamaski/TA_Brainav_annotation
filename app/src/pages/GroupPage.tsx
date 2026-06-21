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

export default function GroupPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [projectName, setProjectName] = useState(projectId);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        const res = await api.get(`/project/${projectId}`);
        if (res.data.success && res.data.data) {
          setProjectName(res.data.data.name);
        }
      } catch (err) {
        console.error("Failed to fetch project details");
      }
    };
    if (projectId) fetchProjectDetails();
  }, [projectId]);

  const fetchGroups = async () => {
    try {
      const res = await api.get(`/group/`);
      if (res.data.success) {
        // FIX 1: Safely default to an empty array so JavaScript doesn't crash on null
        const allGroups = res.data.data || [];
        
        // Safely filter by project ID
        const projectGroups = allGroups.filter((g: any) => 
          String(g.project_id) === String(projectId) || String(g.ProjectID) === String(projectId)
        );
        
        // FIX 2: If the backend drops the ProjectID, bypass the filter so your group still shows up!
        if (projectGroups.length === 0 && allGroups.length > 0) {
          console.warn("Backend didn't send ProjectID! Showing all groups as a fallback.");
          setGroups(allGroups);
        } else {
          setGroups(projectGroups);
        }
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      toast.error("Failed to fetch groups");
    }
  };

  useEffect(() => {
    if (projectId) fetchGroups();
  }, [projectId]);

  const handleCreateGroup = async (name: string) => {
    try {
      await api.post('/group/', { name: name, project_id: parseInt(projectId || '0', 10) });
      
      toast.success("Group created!");
      setCreateModalOpen(false); // Close the modal smoothly
      fetchGroups(); // Refresh the grid
      
    } catch (err) {
      toast.error("Failed to create group");
    }
  };

  const handleDeleteGroup = async (id: number) => {
    if (!window.confirm("Delete this group?")) return;
    try {
      await api.delete(`/group/${id}`);
      toast.success("Group deleted!");
      fetchGroups();
    } catch (err) {
      toast.error("Failed to delete group");
    }
  };

  const handleRenameGroup = async (id: number, newName: string) => {
    try {
      await api.put(`/group/${id}`, { name: newName, project_id: parseInt(projectId || '0', 10) });
      toast.success("Group renamed!");
      fetchGroups();
    } catch (err) {
      toast.error("Failed to rename group");
    }
  };

  const displayedGroups = groups
    .filter((group) => group.name?.toLowerCase().includes(searchQuery.toLowerCase()))
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
      <div className="mb-4 text-[#747677] text-sm">
        <Link to="/home" className="hover:text-[#0091AD] hover:underline">Dashboard</Link> /{' '}
        <Link to="/projects" className="hover:text-[#0091AD] hover:underline">{projectName}</Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[32px] font-bold text-[var(--foreground)]">Groups</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Total groups: {groups.length}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              type="text" placeholder="Search groups..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white rounded-xl"
            />
          </div>
          
          <Button variant="outline" onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')} className="gap-2">
            <ArrowUpDown className="w-4 h-4" /> {sortBy}
          </Button>

          <Button onClick={() => setCreateModalOpen(true)} className="gap-2 px-6 bg-[#0091AD] hover:bg-[#007a94] text-white">
            <Plus className="w-5 h-5" /> New Group
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-[16px]">
        {displayedGroups.length === 0 ? (
          <div className="w-full text-center py-20 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200">
            {groups.length === 0 ? 'No groups yet. Click "+ New Group"!' : 'No groups match your search.'}
          </div>
        ) : (
          displayedGroups.map((group) => {
            const groupId = group.id || group.ID;
            return (
              <ItemCard
                key={groupId}
                name={group.name || 'Unnamed Group'}
                dateCreated={new Date(group.CreatedAt || group.created_at || Date.now()).toLocaleDateString()}
                onClick={() => navigate(`/projects/${projectId}/groups/${groupId}/data`)}
                onRename={() => {
                  const newName = window.prompt("Enter new group name:", group.name || "");
                  if (newName && newName.trim() !== "") {
                    handleRenameGroup(groupId, newName);
                  }
                }}
                onExport={() => alert(`Exporting group...`)}
                onDelete={() => handleDeleteGroup(groupId)}
              />
            );
          })
        )}
      </div>

      <CreateModal
        isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)}
        onConfirm={handleCreateGroup} type="group"
      />
    </DashboardLayout>
  );
}