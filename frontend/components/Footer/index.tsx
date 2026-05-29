"use client";
import Link from "next/link";
import React from "react";
import Image from "next/image";
import ButtonSolid from "../ButtonSolid";
import GoUpArrow from "../GoUpArrow";
import ModalOferente from "../ModalOferente";
import { useTranslation } from "@/app/hooks/useTranslation";
import toast from "react-hot-toast";

export default function Footer() {
  const [email, setEmail] = React.useState("");
  const [isOpenOferente, setIsOpenOferente] = React.useState(false);
  const { t } = useTranslation();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const currentYear = new Date().getFullYear();

  const goToSection = (sectionPage: string) => {
    const section = document.querySelector(sectionPage);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  const onSaveEmail = async () => {
    try {
      if (email.length === 0 || !validateEmail(email)) {
        toast.error(t("por_favor"));
        setEmail("");
        return;
      }

      const response = await fetch("/api/save-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, source: "newsletter" }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar email");
      }

      toast.success(t("success_form"));

      const res = await response.json();
      return res;
    } catch (error) {
      console.error("Error:", error);
      toast.error(t("error_form"));
      throw error;
    } finally {
      setEmail("");
    }
  };

  return (
    <>
      <div
        className=" lg:px-[4rem] xl:px-[11rem] py-6 hidden lg:flex flex-col"
        style={{
          background:
            "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)",
        }}
      >
        <div
          className="flex justify-between items-start border-b-1 py-6"
          style={{ borderColor: "#F9F9F9" }}
        >
          <div>
            <Image
              width={200}
              height={200}
              src={"/logo-phrase.png"}
              alt="logo travel grin"
            />
          </div>
          <div>
            <ul className="text-[#F9F9F9] space-y-4">
              <li
                className="cursor-pointer"
                onClick={() => goToSection("#home")}
              >
                {t("inicio")}
              </li>
              <li className="cursor-pointer"><Link href="/buscar">{t("explorar_oportunidades")}</Link></li>
              <li
                className="cursor-pointer"
                onClick={() => setIsOpenOferente(true)}
              >
                {t("registra_ong")}
              </li>
              <li className="cursor-pointer text-white/90"><Link href="/panel-oferente">Portal oferente</Link></li>
              <li className="cursor-pointer"><Link href="/quienes-somos#HowDoesItWork">{t("como_funciona_publicar")}</Link></li>
              <li className="cursor-pointer"><Link href="/quienes-somos">{t("sobre_travelgrin")}</Link></li>
              <li className="cursor-pointer text-white/90"><Link href="/term-condicion">{t("terminos_condiciones")}</Link></li>
            </ul>
          </div>
          <div className="flex flex-col items-start justify-center ">
            <div className="flex flex-col text-[#F9F9F9] mb-4">
              <h1 className="text-[22px] md:text-[25.76px]">{t("querer_conectar_viajar")}</h1>
              <p className="text-[15px] md:text-[18px] mt-2">
                {t("sentirse_ciudadano_del_mundo")}
              </p>
              <a href="mailto:travelgrin@travelgrin.com" className="text-[14px] md:text-[16px] mt-4 hover:underline">
                travelgrin@travelgrin.com
              </a>
            </div>
            <div className="flex flex-row text-center items-center justify-center space-y-2">
              <input
                placeholder={t("ingresa_tu_correo")}
                className="p-2 rounded-md bg-white border-none m-0"
                type="text"
                onChange={(e) => setEmail(e.target.value)}
              />
              <ButtonSolid
                title={t("enviar")}
                hexButton="#15A4AE"
                classStyle="ml-2"
                onSubmit={onSaveEmail}
                hasSubmit
              />
            </div>
            <p className="text-[0.8rem] text-[#F9F9F9] mt-2">
              {t("oportunidades_directas_en_tu_correo")}
            </p>
          </div>
        </div>
        <div className="flex flex-row justify-between items-center text-[#F9F9F9] mt-8">
          <div className="flex flex-row space-x-4">
          <a target="_blank" href="https://www.facebook.com/share/1EyrbTsYZ6/">
            <Image
              className="md:w-[63px] md:h-[63px] w-[55px] h-[55px] hover:scale-110 transition-transform duration-300 hover:bg-white/30 rounded-full"
              width={100}
              height={100}
              alt="icono facebook"
              src={"/facebook.png"}
            />
            </a>
            <a target="_blank" href="https://www.instagram.com/travelgrinok?igsh=M3p4czY3Y3k1ZHoz">
            <Image
              className="md:w-[63px] md:h-[63px] w-[55px] h-[55px] hover:scale-110 transition-transform duration-300 hover:bg-white/30 rounded-full"
              width={100}
              height={100}
              alt="icono instagram"
              src={"/instagram.png"}
            />
            </a>
          </div>
          <p className="text-[12px] sm:text-[20px]">
            {t("copy_year")} {currentYear} {t("copyright_2025_todos")}
          </p>
          <Image
            className="w-[63px] h-[63px] cursor-pointer"
            width={100}
            height={100}
            alt="icono arrow go top"
            src={"/arrow-up.png"}
            onClick={() => goToSection("#home")}
          />
        </div>
      </div>
      {/* // tablet */}
      <div
        style={{
          background:
            "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)",
        }}
        className="flex-col px-[1rem] md:px-[1.8rem] lg:px-[2rem] xl:px-[19rem] py-6 lg:hidden flex"
      >
        <div className="flex justify-start items-start w-full">
          <Image
            width={200}
            height={200}
            src={"/logo-phrase.png"}
            alt="logo travel grin"
          />
        </div>
        <div
          className="flex justify-between items-start border-b-1 py-6"
          style={{ borderColor: "#F9F9F9" }}
        >
          <div className="hidden sm:flex">
            <ul className="text-[#F9F9F9] space-y-4">
              <li
                className="cursor-pointer"
                onClick={() => goToSection("#home")}
              >
                {t("inicio")}
              </li>
              <li className="cursor-pointer"><Link href="/buscar">{t("explorar_oportunidades")}</Link></li>
              <li
                className="cursor-pointer"
                onClick={() => setIsOpenOferente(true)}
              >
                {t("registra_ong")}
              </li>
              <li className="cursor-pointer"><Link href="/panel-oferente">Portal oferente</Link></li>
              <li className="cursor-pointer"><Link href="/quienes-somos#HowDoesItWork">{t("como_funciona_publicar")}</Link></li>
              <li className="cursor-pointer"><Link href="/quienes-somos">{t("sobre_travelgrin")}</Link></li>
              <li className="cursor-pointer text-white/90">{t("terminos_condiciones")}</li>
            </ul>
          </div>
          <div className="flex flex-col items-start justify-center ">
            <div className="flex flex-col text-[#F9F9F9] mb-4">
              <h1 className="text-[22px] md:text-[25.76px]">{t("querer_conectar_viajar")}</h1>
              <p className="text-[15px] md:text-[18px] mt-2">
                {t("sentirse_ciudadano_del_mundo")}
              </p>
              <a href="mailto:travelgrin@travelgrin.com" className="text-[14px] md:text-[16px] mt-4 hover:underline">
                travelgrin@travelgrin.com
              </a>
            </div>
            <div className="flex flex-row text-center items-center justify-center space-y-2">
              <input
                placeholder={t("ingresa_tu_correo")}
                className="p-2 rounded-md bg-white border-none m-0"
                type="text"
                onChange={(e) => setEmail(e.target.value)}
              />
              {/* <ButtonSolid
                title="Enviar"
                hexButton="transparent"
                classStyle="ml-2 bg-transparent border-1 border-white"
              /> */}
              <ButtonSolid
                title={t("enviar")}
                hexButton="#15A4AE"
                classStyle="ml-2"
                onSubmit={onSaveEmail}
                hasSubmit
              />
            </div>
            <p className="text-[0.8rem] text-[#F9F9F9] mt-2">
              {t("oportunidades_directas_en_tu_correo")}
            </p>
          </div>
        </div>
        <p className="text-[#F9F9F9] text-start my-6 ">
          {t("copy_year")} {currentYear} {t("copyright_2025_todos")}
        </p>
        <div className="flex flex-row justify-between items-center text-[#F9F9F9] ">
          <div className="flex flex-row space-x-4">
            <a target="_blank" href="https://www.facebook.com/share/1EyrbTsYZ6/">
            <Image
              className="w-[55px] h-[55px] hover:scale-110 transition-transform duration-300 hover:bg-white/30 rounded-full"
              width={100}
              height={100}
              alt="icono facebook"
              src={"/facebook.png"}
            />
            </a>
            <a target="_blank" href="https://www.instagram.com/travelgrinok?igsh=M3p4czY3Y3k1ZHoz">
            <Image
              className="w-[55px] h-[55px] hover:scale-110 transition-transform duration-300 hover:bg-white/30 rounded-full"
              width={100}
              height={100}
              alt="icono instagram"
              src={"/instagram.png"}
            />
            </a>

          </div>

          <GoUpArrow />
        </div>
      </div>
      {isOpenOferente && (
        <ModalOferente onClose={() => setIsOpenOferente(false)} />
      )}
    </>
  );
}
