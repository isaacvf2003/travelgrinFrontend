"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function GoUpArrow() {
  const goToSection = (sectionPage: string) => {
    const section = document.querySelector(sectionPage);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
     
      <Image
        className="w-[63px] h-[63px] "
        width={100}
        height={100}
        alt="icono arrow go top"
        src={"/arrow-up.png"}
        onClick={() => goToSection("#home")}
      />
  );
}
