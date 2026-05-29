"use client"
import { Mail } from "lucide-react";
import type { ChangeEvent } from "react";

type Props = {
  value: string;
  setValue: (text: string) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  isEmpty: boolean;
  setEmailError?: (error: string) => void;
  emailError?: string;
  isDemandante?: boolean;
  textPorfavor?: string;
  textCampoRequerido?: string;
};

const EmailInput = ({
  value,
  setValue,
  label,
  required = false,
  disabled = false,
  isEmpty,
  setEmailError,
  emailError = "",
  isDemandante = false,
  textPorfavor = "",
  textCampoRequerido = "",
}: Props) => {
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const email = e.target.value;
    setValue(email);
    
    // Validación en tiempo real
    if (email.length > 0 && !validateEmail(email)) {
      setEmailError?.("Formato de email inválido");
    } else {
      setEmailError?.("");
    }
  };
  return (
    <div className="relative w-full flex flex-col ">
      <div className={`absolute ${value.length > 0 ? "top-9" : "top-7"} left-3 z-10`}>
        <Mail className="w-4 h-4 text-black" />
      </div>
      <input
        type="email"
        value={value}
        pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
        title={textPorfavor}
        onChange={handleEmailChange}
        required={required}
        disabled={disabled}
        className="w-full p-4 pt-6 pl-12 text-black pb-6 rounded-xl transition-all duration-300 bg-white outline-none transform hover:scale-[1.02] focus:scale-[1.02] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:hover:scale-100 disabled:focus:scale-100"
        style={{
          boxShadow: isEmpty
            ? "0 8px 25px -8px rgba(220, 38, 38, 0.4), 0 4px 12px -4px rgba(220, 38, 38, 0.2)"
            : "0 8px 32px -12px rgba(8, 217, 189, 0.3), 0 4px 16px -6px rgba(4, 181, 189, 0.25), 0 2px 8px -3px rgba(0, 154, 188, 0.2)",
          filter: isEmpty
            ? "drop-shadow(0 4px 8px rgba(220, 38, 38, 0.15))"
            : "drop-shadow(0 4px 12px rgba(8, 217, 189, 0.2))",
            height:  isDemandante ? "90px" : "",
        }}
      />

      {value.length === 0 && (
        <label
          className={`absolute left-10 transition-all duration-200 pointer-events-none ${
            isEmpty ? "text-red-600 top-6" : "text-gray-500 top-6"
          }`}
        >
          {required && " *"}
          {label}
        </label>
      )}

      {isEmpty && (
        <div className="flex items-center gap-1 mt-2 text-red-600 text-sm px-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {textCampoRequerido}
        </div>
      )}
      {emailError && (
        <div className="flex items-center gap-1 mt-2 text-red-600 text-sm px-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {emailError}
        </div>
      )}
    </div>
  );
};

export default EmailInput;
