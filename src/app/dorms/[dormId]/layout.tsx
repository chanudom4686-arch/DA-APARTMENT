'use client';
import { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function DormLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const dormId = params.dormId as string;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar dormId={dormId} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
