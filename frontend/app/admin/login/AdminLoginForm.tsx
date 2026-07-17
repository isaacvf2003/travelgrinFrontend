"use client";

import Image from "next/image";
import { FormEvent, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";

type AdminLoginFormProps = {
  nextPath?: string;
  defaultEmail: string;
};

type ViewMode = "login" | "verify-otp" | "request-reset" | "confirm-reset";

function normalizeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  if (value.startsWith("/admin/login")) {
    return "/admin";
  }

  return value;
}

async function postJson(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "No se pudo completar la solicitud.");
  }

  return data;
}

export default function AdminLoginForm({ nextPath, defaultEmail }: AdminLoginFormProps) {
  const destination = normalizeNextPath(nextPath);

  const [mode, setMode] = useState<ViewMode>("login");
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const submittingRef = useRef(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!turnstileToken) {
        setError("Completa la verificacion.");
        return;
      }
      const data = await postJson("/api/admin/auth/login", {
        email: email.trim(),
        password,
        turnstileToken,
      });

      if (data?.otpRequired && data?.otpToken) {
        setOtpToken(String(data.otpToken));
        setOtpCode("");
        setMode("verify-otp");
        setTurnstileToken("");
        setTurnstileResetKey((value) => value + 1);
        setSuccess(data?.message || "Te enviamos un codigo al correo admin.");
        return;
      }

      setSuccess("Acceso verificado. Entrando al panel...");
      window.location.assign(destination);
    } catch (err) {
      setError("No se pudo iniciar sesion. Intenta nuevamente.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await postJson("/api/admin/auth/verify-otp", {
        otpToken,
        code: otpCode.trim(),
      });

      setSuccess("Acceso verificado. Entrando al panel...");
      window.location.assign(destination);
    } catch (err) {
      setError("No se pudo verificar el codigo.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleRequestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const data = await postJson("/api/admin/auth/request-reset", {
        email: email.trim(),
      });
      setSuccess(data?.message || "Te enviamos un codigo al correo.");
      setMode("confirm-reset");
    } catch (err) {
      setError("No se pudo enviar el codigo.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleConfirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (newPassword !== confirmPassword) {
        setError("Las contrasenas no coinciden.");
        return;
      }
      const data = await postJson("/api/admin/auth/reset-password", {
        email: email.trim(),
        code: resetCode.trim(),
        password: newPassword,
      });
      setSuccess(data?.message || "Contrasena actualizada correctamente.");
      setMode("login");
      setPassword("");
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError("No se pudo cambiar la contrasena.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dff6fb_0%,#ffffff_42%,#e2e8f0_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <div className="w-full rounded-[32px] border border-white/70 bg-white/90 p-7 shadow-[0_30px_100px_rgba(15,23,42,0.14)] backdrop-blur sm:p-10">
          <div className="flex justify-center">
            <Image src="/logo-navbar.png" alt="TravelGrin" width={210} height={56} className="h-12 w-auto" priority />
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
              <ShieldCheck className="h-4 w-4" />
              Inicio de sesion
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">Panel de administracion</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Ingresá con el correo autorizado y tu contrasena.
            </p>
          </div>

          {mode !== "login" ? (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
                setOtpCode("");
                setOtpToken("");
              }}
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesion
            </button>
          ) : null}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Mail className="h-4 w-4 text-slate-400" />
                  Correo admin
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  placeholder={defaultEmail}
                />
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <LockKeyhole className="h-4 w-4 text-slate-400" />
                  Contrasena
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    minLength={10}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-11 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                    placeholder="Tu contrasena segura"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <TurnstileWidget
                resetKey={turnstileResetKey}
                onTokenChange={setTurnstileToken}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-2"
              />

              <button
                type="submit"
                disabled={submitting || !turnstileToken}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Verificando acceso..." : "Entrar al panel"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("request-reset");
                  setError("");
                  setSuccess("");
                }}
                className="w-full text-sm font-medium text-cyan-700 transition hover:text-cyan-900"
              >
                Olvide mi contrasena
              </button>
            </form>
          ) : null}

          {mode === "verify-otp" ? (
            <form onSubmit={handleVerifyOtp} className="mt-8 space-y-5">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                Ingresá el código de 6 dígitos que enviamos a <b>{email.trim()}</b>. La sesión admin se abre recién después de este paso.
              </div>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  Codigo de acceso
                </span>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-center text-sm tracking-[0.45em] text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  placeholder="123456"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || otpCode.length !== 6}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Verificando codigo..." : "Verificar y entrar"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setOtpCode("");
                  setOtpToken("");
                  setSuccess("Para reenviar el codigo, volve a ingresar la contrasena.");
                }}
                className="w-full text-sm font-medium text-cyan-700 transition hover:text-cyan-900"
              >
                Reenviar codigo
              </button>
            </form>
          ) : null}

          {mode === "request-reset" ? (
            <form onSubmit={handleRequestReset} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Mail className="h-4 w-4 text-slate-400" />
                  Correo del administrador
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Enviando codigo..." : "Enviar codigo al correo"}
              </button>
            </form>
          ) : null}

          {mode === "confirm-reset" ? (
            <form onSubmit={handleConfirmReset} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Mail className="h-4 w-4 text-slate-400" />
                  Correo del administrador
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  Codigo de 6 digitos
                </span>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm tracking-[0.4em] text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  placeholder="123456"
                />
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <LockKeyhole className="h-4 w-4 text-slate-400" />
                  Nueva contrasena
                </span>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={10}
                    required
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-11 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                    placeholder="Minimo 10 caracteres"
                  />
                  <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <LockKeyhole className="h-4 w-4 text-slate-400" />
                  Confirmar contrasena
                </span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={10}
                    required
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-11 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                    placeholder="Repeti la nueva contrasena"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Actualizando..." : "Guardar nueva contrasena"}
              </button>
            </form>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
