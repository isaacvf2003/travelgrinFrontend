import type { Metadata } from "next";

import "./globals.css";
import { CountryProvider } from "./context/CountryProvider";
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from "./context/LanguageContext";
import GlobalActionModals from "@/components/GlobalActionModals";

export const metadata: Metadata = {
  title: "TravelGrin - Viajar por oportunidades | Conecta con el mundo",
  description: "Plataforma que conecta viajeros con oportunidades únicas alrededor del mundo. Descubre experiencias auténticas, trabaja remotamente y viaja con propósito. Únete a la comunidad de nómadas digitales.",
  keywords: "viajes con propósito, oportunidades internacionales, visas y migraciones, estudiar en el extranjero, trabajo temporal exterior, voluntariado internacional, emprender en el extranjero, salud en el extranjero",
  authors: [{ name: "TravelGrin" }],
  creator: "TravelGrin",
  publisher: "TravelGrin",
  //
  // Open Graph para redes sociales
  openGraph: {
    title: "TravelGrin - Viajar por oportunidades",
    description: "Conecta con el mundo por oportunidades y viaja con propósito",
    url: "https://travelgrin.com",
    siteName: "TravelGrin",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "TravelGrin - Plataforma de viajes y oportunidades",
      },
    ],
    locale: "es_ES",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      <script 
      type="text/javascript"
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "syw6vrucog");
        `
      }}
    />
      </head>
      <body
        suppressHydrationWarning
        className="antialiased"
        style={{backgroundColor: "#F9F9F9"}}
      >
        <LanguageProvider>
        <CountryProvider>
        {children}
        <GlobalActionModals />
        <Toaster 
        containerClassName="z-[99999999999]"
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
              zIndex: 99999999999,
            },
          }}
        />
        </CountryProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
