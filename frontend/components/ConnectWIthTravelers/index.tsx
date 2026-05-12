import React from "react";
import ButtonSolid from "../ButtonSolid";
import Image from "next/image";
export default function ConnectWithTravelers() {
  return (
    <div className="space-y-6">
      <h1 className="text-[25.76px] text-center">
        En Travelgrin, tu propuesta se muestra a viajeros segmentados según su
        país, su propósito y su necesidad real.
      </h1>
      <div className="text-center  flex flex-row items-center justify-center">
        <Image
          src="/persons-2.webp"
          alt="User Placeholder"
          width={200}
          height={100}
          className="w-[6rem] h-14 rounded-full border-2 border-white object-cover"
        />
        <p className="text-[16px] font-bold ml-2">+100 propuestas son parte</p>
      </div>
      <div className="flex flex-col justify-center items-center">
        <ButtonSolid
          hexButton="#273166"
          title="Publica gratis ahora"
          classStyle="mt-8 w-[15rem] md:w-auto text-sm lg:text-lg bg-teal-500 hover:bg-teal-600 text-white lg:px-12 py-3 rounded-lg font-medium text-lg transition-colors"
        />
      </div>
    </div>
  );
}
