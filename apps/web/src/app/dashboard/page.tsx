'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface MeResponse {
  id: string;
  name: string;
  email: string;
  workspaceId: string;
  emailVerified?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/login');
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          localStorage.removeItem('accessToken');
          router.replace('/login');
          return;
        }
        const data: MeResponse = await response.json();
        setUser(data);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <main className="container">Checking auth...</main>;
  }

  if (!user) {
    return null;
  }

  return (
    <main className="container">
      <h1>Dashboard</h1>
      <p>
        <Link href="/dashboard/contacts">Contacts</Link>
        {' · '}
        <Link href="/dashboard/templates">Templates</Link>
        {' · '}
        <Link href="/dashboard/campaigns">Campaigns</Link>
        {' · '}
        <Link href="/dashboard/sequences">Sequences</Link>
        {' · '}
        <Link href="/dashboard/billing">Billing</Link>
      </p>
      <p>Welcome, {user.name}</p>
      <p>Email: {user.email}</p>
      <p>Workspace: {user.workspaceId}</p>
      {user.emailVerified === false ? (
        <p className="muted">Email not verified — check your inbox or use the banner above.</p>
      ) : null}
      <button
        className="button"
        onClick={() => {
          localStorage.removeItem('accessToken');
          router.push('/login');
        }}
        type="button"
      >
        Logout
      </button>
    </main>
  );
}
