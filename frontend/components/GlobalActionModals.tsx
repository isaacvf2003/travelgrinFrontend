"use client";

import { useCountry } from "@/app/context/CountryProvider";
import ModalDemandante from "./ModalDemandante";
import ModalOferente from "./ModalOferente";

export default function GlobalActionModals() {
  const {
    selectedCountry,
    setSelectedCountry,
    isOpenModalOferente,
    setIsOpenModalOferente,
    isOpenModalDemandante,
    setIsOpenModalDemandante,
    setIsOpenModal,
  } = useCountry();

  if (isOpenModalOferente) {
    return (
      <ModalOferente
        compactPlanCards
        onClose={() => {
          setIsOpenModalOferente(false);
          setIsOpenModal(false);
        }}
      />
    );
  }

  if (isOpenModalDemandante) {
    return (
      <ModalDemandante
        selectedCountry={selectedCountry}
        setSelectedCountry={setSelectedCountry}
        onClose={() => {
          setIsOpenModalDemandante(false);
          setIsOpenModal(false);
        }}
      />
    );
  }

  return null;
}
