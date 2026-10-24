import { AnimatePresence, motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { ToastHost } from "@/components/ui";
import { AppProvider, useApp } from "@/lib/store";
import AdminPage from "@/pages/AdminPage";
import AuthPage from "@/pages/AuthPage";
import PlansPage from "@/pages/PlansPage";
import SettingsPage from "@/pages/SettingsPage";
import WorkspacePage from "@/pages/WorkspacePage";

function Router() {
  const { user, page, toast } = useApp();

  if (!user) {
    return (
      <>
        <AuthPage />
        <ToastHost toast={toast} />
      </>
    );
  }

  return (
    <>
      <AppShell>
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="h-full"
          >
            {(page === "home" || page === "chat" || page === "agent") && <WorkspacePage />}
            {page === "plans" && <PlansPage />}
            {page === "settings" && <SettingsPage />}
            {page === "admin" && <AdminPage />}
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <ToastHost toast={toast} />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
