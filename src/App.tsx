import { useEffect, useRef, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { TopBar } from "@/components/layout/TopBar";
import { LoginDialog } from "@/components/dialogs/LoginDialog";
import { SettingsDialog } from "@/components/dialogs/SettingsDialog";
import { ProfileSetupDialog } from "@/components/dialogs/ProfileSetupDialog";
import { useProjects } from "@/hooks/useProjects";
import { loadProject } from "@/lib/projectStorage";
import { shouldAskForProfile, type ProjectProfile } from "@/lib/projectProfile";
import { TutorialPanel } from "@/components/tutorials/TutorialPanel";
import { TutorialLauncher } from "@/components/tutorials/TutorialLauncher";
import HomePage from "@/pages/HomePage";
import StudioPage from "@/pages/StudioPage";
import CharacterPage from "@/pages/CharacterPage";
import QuickPage from "@/pages/QuickPage";
import ChatPage from "@/pages/ChatPage";
import ViewsPage from "@/pages/ViewsPage";
import PosesPage from "@/pages/PosesPage";
import StoryPage from "@/pages/StoryPage";
import PricingPage from "@/pages/PricingPage";
import LegalPage from "@/pages/LegalPage";
import AdminPage from "@/pages/AdminPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Profil-Setup einmalig anbieten, sobald ein Projekt (noch) kein Profil hat.
  // Storage wird SYNCHRON gelesen (nicht der reaktive Hook), damit der Dialog bei
  // Projekten MIT Profil nicht kurz aufblitzt.
  const { current } = useProjects();
  const promptedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!current || promptedFor.current === current.id) return;
    promptedFor.current = current.id;
    const stored = (loadProject(current.id)?.state as { values?: Record<string, unknown> } | undefined)?.values?.profile;
    if (shouldAskForProfile(stored as ProjectProfile | null | undefined)) setProfileOpen(true);
  }, [current?.id]);

  return (
    <>
      <TopBar onLogin={() => setLoginOpen(true)} onSettings={() => setSettingsOpen(true)} settingsOpen={settingsOpen} />
      <TutorialLauncher />
      <Shell>
        <Routes>
          <Route path="/"        element={<HomePage onLogin={() => setLoginOpen(true)} onSettings={() => setSettingsOpen(true)} />} />
          <Route path="/studio"    element={<StudioPage />} />
          <Route path="/character" element={<CharacterPage />} />
          <Route path="/story"     element={<StoryPage />} />
          {/* Legacy direct-link routes — kept for backward compatibility */}
          <Route path="/quick" element={<QuickPage />} />
          <Route path="/chat"  element={<ChatPage />} />
          <Route path="/views" element={<ViewsPage />} />
          <Route path="/poses" element={<PosesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/legal"   element={<LegalPage />} />
          <Route path="/admin"   element={<AdminPage />} />
          <Route path="*"        element={<NotFoundPage />} />
        </Routes>
      </Shell>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProfileSetupDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      <TutorialPanel onOpenSettings={() => setSettingsOpen(true)} />
    </>
  );
}
