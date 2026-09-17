"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function GoUpArrow() {
  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Image
      className="w-[63px] h-[63px] cursor-pointer"
      width={100}
      height={100}
      alt="icono arrow go top"
      src={"/arrow-up.png"}
      onClick={handleScrollToTop}
    />
  );
}
