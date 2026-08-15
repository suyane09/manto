import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
