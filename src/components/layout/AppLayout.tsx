import { ReactNode } from "react";
import TopNavbar from "./TopNavbar";
import BottomNav from "./BottomNav";
import { DemoModeBanner } from "./DemoModeBanner";
import { isDemoMode } from "@/lib/mockData";
import JobProgressIndicator from "./JobProgressIndicator";
import ChatWidget from "@/components/chat/ChatWidget";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const showDemoBanner = isDemoMode();

  return (
    <div className="min-h-screen bg-background flex flex-col w-full relative">
      {/* Grid background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      {/* Golden glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 z-0 pointer-events-none"
        style={{
          width: "800px",
          height: "600px",
          background: "radial-gradient(ellipse at center, rgba(252,202,70,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen w-full">
        {showDemoBanner && <DemoModeBanner />}
        <TopNavbar />
        <main className="flex-1 w-full pb-20 md:pb-0">
          {children}
        </main>
        <BottomNav />
        <JobProgressIndicator />
        <ChatWidget />
      </div>
    </div>
  );
};

export default AppLayout;
