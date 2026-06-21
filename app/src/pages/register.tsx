import React, { useState } from 'react';
import { api } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Must exactly match the struct expected by Go handler
      const payload = { name, username, password, role: 'superAdmin' };
      const response = await api.post('/api/auth/signupForSuperAdmin', payload);
      
      if (response.data.success) {
        toast.success('Account created successfully! Please log in.');
        navigate('/login');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to create account.';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#fff4e4]">
      <Card className="w-full max-w-sm shadow-md border-2 border-[#393E41]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-[#0091AD]">Create Account</CardTitle>
          <CardDescription>Join the platform to get started</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-1">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name" type="text"
                value={name} onChange={(e) => setName(e.target.value)} required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username" type="text"
                value={username} onChange={(e) => setUsername(e.target.value)} required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password" type="password"
                value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full mt-2 bg-[#0091AD] hover:bg-[#007a94] text-white">
              {isLoading ? 'Processing...' : 'Register'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 text-center">
          <Link to="/login" className="text-sm text-[#0091AD] hover:underline font-bold">
            Already have an account? Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}