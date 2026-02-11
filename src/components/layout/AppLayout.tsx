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
    <div className="min-h-screen bg-background flex flex-col w-full">
      {showDemoBanner && <DemoModeBanner />}
      <TopNavbar />
      <main className="flex-1 w-full pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav />
      <JobProgressIndicator />
      <ChatWidget />
    </div>
  );
};

export default AppLayout;
