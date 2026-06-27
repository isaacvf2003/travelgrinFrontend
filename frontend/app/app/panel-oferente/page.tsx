"use client";

import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProviderPortalPanel from "@/components/provider-portal/ProviderPortalPanel";

export default function PanelOferentePage() {
  return (
    <div className="min-h-screen bg-[#F3F5F7]">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <ProviderPortalPanel />
      </main>
      <Footer />
    </div>
  );
}
