"use client";

import React, { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import WhyTravel from "@/components/WhyTravel";
import PharseWithBackground from "@/components/PharseWithBackground";
import HowDoesItWork from "@/components/HowDoesItWork";
import WeAreTravelGrin from "@/components/WeAreTravelGrin";
import OneTrip from "@/components/OneTrip";
import { ArrowUp } from "lucide-react";

export default function QuienesSomosPage() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowTop(true);
      } else {
        setShowTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <NavBar />
      <main>
        <div className="hero-320 mx-auto w-full max-w-[730px] px-4 sm:px-6 lg:max-w-[990px] lg:px-8 xl:max-w-6xl">
          <section id="WeAreTravelGrin" className="mt-8">
            <WeAreTravelGrin />
          </section>
          <section>
            <OneTrip />
          </section>
          <section id="HowDoesItWork" className="mt-8 -mx-4 sm:-mx-6 lg:mx-0">
            <HowDoesItWork />
          </section>
          <section className="mt-8">
            <PharseWithBackground />
          </section>
          <section className="mt-8">
            <WhyTravel />
          </section>
          <section className="mt-8 mb-12 flex flex-col items-center justify-center text-center font-bold">
            <PharseWithBackground onlyOne />
          </section>
        </div>
        <footer>
          <Footer />
        </footer>
      </main>

      {/* Back to top floating button */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#075965] text-white shadow-[0_14px_30px_rgba(7,89,101,0.28)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-[#08aeba]"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </>
  );
}
