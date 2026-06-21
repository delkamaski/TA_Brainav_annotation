import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Using the exact endpoint from your documentation
      const res = await api.post('/api/auth/login', { username, password });
      
      if (res.data.success) {
        // Extracting tokens strictly based on the backend response JSON format
        const { access_token, refresh_token } = res.data.data;
        login(access_token, refresh_token);
        
        toast.success('Logged in successfully!');
        navigate('/home');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#fff4e4]">
      <div className="w-[400px] bg-white p-8 rounded-2xl shadow-lg border-2 border-[#393E41]">
        <h1 className="text-2xl font-bold text-[#393E41] mb-6">Login</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input 
            type="text" placeholder="Username" required
            className="p-3 border-2 border-[#0091AD] rounded-xl outline-none focus:border-[#007a94]"
            value={username} onChange={e => setUsername(e.target.value)} 
          />
          <input 
            type="password" placeholder="Password" required
            className="p-3 border-2 border-[#0091AD] rounded-xl outline-none focus:border-[#007a94]"
            value={password} onChange={e => setPassword(e.target.value)} 
          />
          <button type="submit" disabled={isLoading} className="bg-[#0091AD] text-white p-3 rounded-xl font-bold hover:bg-[#007a94] disabled:opacity-50 transition-opacity">
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[#747677]">
          Don't have an account? <Link to="/register" className="text-[#0091AD] font-bold hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}