import Hero from "@/components/Hero";
import NavBar from "@/components/NavBar";
import SearchDestination from "@/components/SearchDestination";
import { Viewport } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import FeaturedPaymentFlash from "@/components/FeaturedPaymentFlash";
import ActiveDestinationCountriesStrip from "@/components/ActiveDestinationCountriesStrip";
import Phrase from "@/components/Phrase";

const TravelTypes = dynamic(() => import("@/components/TravelTypes"), {
  loading: () => <section className="mt-10 h-80 w-full animate-pulse rounded-3xl bg-slate-200/70" />,
});
const FeaturedPublicationsSection = dynamic(() => import("@/components/FeaturedPublicationsSection"), {
  loading: () => <section className="mt-8 h-72 w-full animate-pulse rounded-3xl bg-slate-200/70" />,
});
const CardsDemandante = dynamic(() => import("@/components/CardsDemandante"), {
  loading: () => <section className="mt-8 h-80 w-full animate-pulse rounded-3xl bg-slate-200/70" />,
});
const HomeHowItWorksSection = dynamic(() => import("@/components/HomeHowItWorksSection"), {
  loading: () => <section className="mt-8 h-96 w-full animate-pulse rounded-3xl bg-slate-200/70" />,
});
const TravelgrinFAQ = dynamic(() => import("@/components/Questions"), {
  loading: () => <section className="mx-auto mt-8 h-72 max-w-6xl animate-pulse rounded-3xl bg-slate-200/70" />,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Also supported but less commonly used
  // interactiveWidget: 'resizes-visual',
};




export default function Home() {
  return (
    <>
    <FeaturedPaymentFlash />
    <div id="home">
      <NavBar  />
      </div>
      <main className="overflow-x-hidden">
        
        <div className="hero-320 xl:max-w-6xl max-w-[730px] lg:max-w-[990px] mx-auto">
          <section className="-mx-4 sm:-mx-5 md:-mx-6 lg:mx-0">
            <Hero />
          </section>
          <section className="px-4 md:px-0">
            <SearchDestination />
          </section>
          <ActiveDestinationCountriesStrip />
          <section id="categories" className="px-4 sm:px-5 md:px-6 lg:px-0">
            <TravelTypes />
          </section>
          <section>
            <FeaturedPublicationsSection />
          </section>
          <section className="px-4 md:px-0">
            <CardsDemandante />
          </section>
          <HomeHowItWorksSection />
          <section className="px-4 md:px-0">
            <Phrase />
          </section>
        </div>
        <section id="preguntas-frecuentes">
          <TravelgrinFAQ/>
        </section>
        <footer>
          <Footer />
        </footer>
      </main>
    </>
  );
}
