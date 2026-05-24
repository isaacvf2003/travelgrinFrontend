"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ButtonSolid from "../ButtonSolid";
import SelectCountry from "../SelectCountry";
import { Heart, Home, Menu, Search, X } from "lucide-react";
import PaisPasaporte from "../PaisPasaporte";
import CountrySelectionModal from "../SelectCountryModal";
import { useCountry } from "@/app/context/CountryProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const {
    selectedCountry,
    setSelectedCountry,
    isOpenModal,
    setIsOpenModal,
    hideCountryOnOpenModal,
    setHideCountryOnOpenModal,
  } = useCountry();


  const { t } = useTranslation()
  const pathname = usePathname();
  const isBuscarPage = pathname === "/buscar";
  const [menuOpen, setMenuOpen] = useState(false);
  const [planCount, setPlanCount] = useState(0);
  const [isNavVisible, setIsNavVisible] = useState(true);

  useEffect(() => {
    const loadPlanCount = () => {
      try {
        const raw = window.localStorage.getItem("tg_plan_items");
        if (!raw) {
          setPlanCount(0);
          return;
        }
        const parsed = JSON.parse(raw);
        setPlanCount(Array.isArray(parsed) ? parsed.length : 0);
      } catch {
        setPlanCount(0);
      }
    };

    loadPlanCount();
    window.addEventListener("storage", loadPlanCount);
    window.addEventListener("tg-plan-updated", loadPlanCount as EventListener);
    return () => {
      window.removeEventListener("storage", loadPlanCount);
      window.removeEventListener("tg-plan-updated", loadPlanCount as EventListener);
    };
  }, []);

  useEffect(() => {
    if (isOpenModal) {
      setMenuOpen(false);
      setIsOpenModal?.(false);
    }
  }, [isOpenModal]);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const onScroll = () => {
      const currentY = window.scrollY;
      const goingDown = currentY > lastScrollY;
      const isMobileBuscarPage = isBuscarPage && window.matchMedia("(max-width: 767px)").matches;

      if (isBuscarPage && !isMobileBuscarPage) {
        setIsNavVisible(true);
        lastScrollY = currentY;
        return;
      }

      const hideThreshold = isMobileBuscarPage ? Math.round(window.innerHeight * 0.65) : 90;

      if (goingDown && currentY > hideThreshold) {
        setIsNavVisible(false);
      } else {
        setIsNavVisible(true);
      }
      lastScrollY = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isBuscarPage]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = () => setMenuOpen(false);
    window.addEventListener("scroll", closeMenu, { passive: true });
    window.addEventListener("wheel", closeMenu, { passive: true });
    window.addEventListener("touchmove", closeMenu, { passive: true });
    return () => {
      window.removeEventListener("scroll", closeMenu);
      window.removeEventListener("wheel", closeMenu);
      window.removeEventListener("touchmove", closeMenu);
    };
  }, [menuOpen]);

  const handleHideCountryOnOpenModal = (hide: boolean) => {
    setHideCountryOnOpenModal?.(hide);
  };
  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[220] h-[5rem] px-6 py-4 transition-transform duration-300 ${
          isNavVisible || menuOpen ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{
          background:
            "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)",
        }}
      >
        <div className="max-w-6xl flex justify-between items-center mx-auto relative -top-[6px]">
          <div className="mt-2 sm:mt-0">
            <Link href="/" aria-label="TravelGrin">
              <Image
                width={123}
                height={51}
                src="/logo-navbar.png"
                alt="Logo TravelGrin navbar"
                className="w-[90px] sm:w-[140px] sm:h-[58px] object-contain"
              />
            </Link>
          </div>

          {!isOpenModal && !hideCountryOnOpenModal && (
            <div className={`md:hidden z-50`}>
              <PaisPasaporte
                setSelectedCountry={(country: string) =>
                  setSelectedCountry(country)
                }
                selectedCountry={selectedCountry}
                isMobile
              />
            </div>
          )}

          {/* Desktop Menu */}
          <div className="hidden md:flex flex-row items-center space-x-3 mt-1">
            <PaisPasaporte
              setSelectedCountry={(country: string) =>
                setSelectedCountry(country)
              }
              selectedCountry={selectedCountry}
            />
            {/* 240x52 */}
            <Link href="/quienes-somos" className="hidden lg:flex h-[52px] shrink-0 items-center whitespace-nowrap rounded-full border border-white/50 bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/20">{t("quienes_somos")}</Link>
            <ButtonSolid title={t("publicarGratis")} isDesktopHeader={true} hexButton="#273166" classStyle="w-[100%] h-[52px]" />

            {/* Mi plan (solo UI por ahora) */}
            <Link
              href="/mi-plan"
              className="relative flex h-[52px] items-center gap-2 rounded-full border border-white/50 bg-white/10 px-4 text-white transition hover:bg-white/20"
              aria-label={t("mi_plan")}
            >
              <Heart className="h-5 w-5" />
              <span className="text-sm font-semibold">{t("mi_plan")}</span>
              {planCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#273166] px-1 text-[11px] font-bold leading-none text-white">
                  {planCount}
                </span>
              ) : null}
            </Link>
            <SelectCountry isMobile />
          </div>

          {/* Mobile Menu Button */}
          <div
            className="md:hidden flex mt-1 cursor-pointer"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? (
              <X className="w-8 h-8 text-white" />
            ) : (
              <Menu className="w-8 h-8 text-white" />
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Cerrar menú"
              className="fixed inset-0 z-[210] bg-black/20 md:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <div
              style={{
                background:
                  "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)",
              }}
              className="md:hidden fixed left-0 right-0 top-[5rem] z-[215] border-t shadow-2xl"
            >
              <div className="flex flex-col p-4 space-y-3">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white hover:bg-white/20"
              >
                <Home className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("inicio") || "Inicio"}</span>
              </Link>
              <Link
                href="/quienes-somos"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white hover:bg-white/20"
              >
                <Home className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("quienes_somos")}</span>
              </Link>
              <Link
                href="/buscar"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white hover:bg-white/20"
              >
                <Search className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("buscar") || "Buscar / Explorar"}</span>
              </Link>
              <Link
                href="/mi-plan"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white hover:bg-white/20"
              >
                <Heart className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("mi_plan")}</span>
                {planCount > 0 ? (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#273166] px-1 text-[11px] font-bold leading-none text-white">
                    {planCount}
                  </span>
                ) : null}
              </Link>
              <div onClick={() => setMenuOpen(false)}>
              <ButtonSolid
                title={t("publicarGratis")}
                hexButton="#273166"
                classStyle="w-full text-center"
                isHeaderButton
                setHideCountryOnOpenModal={handleHideCountryOnOpenModal}
              />
              </div>
              <div className="flex justify-center">
                <SelectCountry isMobile />
              </div>
            </div>
            </div>
          </>
        )}
      </header>
      <div className="h-[5rem]" />

      <CountrySelectionModal
        setSelectedCountry={(country: string) => setSelectedCountry(country)}
        selectedCountry={selectedCountry}
      />
    </>
  );
}
