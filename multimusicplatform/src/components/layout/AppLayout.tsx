'use client';

import React from 'react';
import LeftSidebar, { LeftSidebarProps } from './LeftSidebar';
// import RightPanel from '../music/RightPanel'; // We will build this next!

interface AppLayoutProps {
  children: React.ReactNode;
  sidebarProps?: LeftSidebarProps; // Allow pages to pass data to the sidebar
}

export default function AppLayout({ children, sidebarProps }: AppLayoutProps) {
  return (
    <div className="h-screen w-full flex bg-base text-text-primary overflow-hidden">
      
      {/* PANE 1: Left Sidebar */}
      <LeftSidebar {...sidebarProps} />

      {/* PANE 2: Main Content (Fluid, Scrollable) */}
      <main className="flex-1 overflow-y-auto relative bg-base">
        {children}
      </main>

      {/* PANE 3: Right Panel / Player */}
      <div className="w-80 flex-shrink-0 bg-surface border-l border-white/5 flex flex-col hidden lg:flex">
        {/* <RightPanel /> */}
        <div className="p-4 text-text-secondary text-sm italic">
          Right Panel (Coming in Step 5)
        </div>
      </div>

    </div>
  );
}