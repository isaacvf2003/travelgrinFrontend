import React from "react";
import { ChevronDown } from "lucide-react";
export default function Select() {
  return (
    <button className=" hidden sm:flex items-center gap-2 px-4 py-2 border-2 border-white border-opacity-50 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-all duration-200">
      <span className="text-sm font-medium">País de tu pasaporte</span>
      <ChevronDown className="w-4 h-4" />
    </button>
  );
}
