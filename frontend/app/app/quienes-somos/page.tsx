import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import WhyTravel from "@/components/WhyTravel";
import PharseWithBackground from "@/components/PharseWithBackground";
import HowDoesItWork from "@/components/HowDoesItWork";
import WeAreTravelGrin from "@/components/WeAreTravelGrin";
import OneTrip from "@/components/OneTrip";

export default function QuienesSomosPage() {
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
          <section className="mt-8 flex flex-col items-center justify-center text-center font-bold">
            <PharseWithBackground onlyOne />
          </section>
        </div>
        <footer>
          <Footer />
        </footer>
      </main>
    </>
  );
}
