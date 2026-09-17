/**
 * Microsoft Clarity Helper & Utilities
 * Permite registrar eventos personalizados, tags (país, idioma, usuario) y gestionar consentimientos.
 */

declare global {
  interface Window {
    clarity?: (action: string, ...args: any[]) => void;
  }
}

export const CLARITY_PROJECT_ID = "syw6vrucog";

/**
 * Registra un evento personalizado en Microsoft Clarity
 * @param eventName Nombre del evento (ej: 'search_destination', 'click_contact', 'filter_applied')
 */
export function clarityEvent(eventName: string) {
  if (typeof window !== "undefined" && typeof window.clarity === "function") {
    try {
      window.clarity("event", eventName);
    } catch (e) {
      console.warn("[Clarity] Error enviando evento:", e);
    }
  }
}

/**
 * Asigna una etiqueta personalizada (Custom Tag) a la sesión actual
 * @param key Clave de la etiqueta (ej: 'selected_country', 'language', 'user_role')
 * @param value Valor de la etiqueta
 */
export function claritySetTag(key: string, value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return;
  if (typeof window !== "undefined" && typeof window.clarity === "function") {
    try {
      window.clarity("set", key, String(value));
    } catch (e) {
      console.warn("[Clarity] Error asignando tag:", e);
    }
  }
}

/**
 * Identifica un usuario específico en Clarity (sin enviar datos sensibles)
 * @param customId Identificador único anónimo del usuario (ej: user_id)
 * @param friendlyName Nombre o rol legible (opcional)
 */
export function clarityIdentify(customId: string, friendlyName?: string) {
  if (!customId) return;
  if (typeof window !== "undefined" && typeof window.clarity === "function") {
    try {
      window.clarity("identify", customId, undefined, undefined, friendlyName);
    } catch (e) {
      console.warn("[Clarity] Error identificando usuario:", e);
    }
  }
}

/**
 * Actualiza el consentimiento de cookies para Clarity
 * @param granted true si el usuario aceptó cookies de telemetría/análisis
 */
export function clarityConsent(granted: boolean = true) {
  if (typeof window !== "undefined" && typeof window.clarity === "function") {
    try {
      window.clarity("consent", granted);
    } catch (e) {
      console.warn("[Clarity] Error actualizando consentimiento:", e);
    }
  }
}

/**
 * Fuerza a Clarity a priorizar la grabación de una sesión con alta relevancia
 * @param reason Motivo (ej: 'checkout_process', 'error_detected')
 */
export function clarityUpgrade(reason: string) {
  if (typeof window !== "undefined" && typeof window.clarity === "function") {
    try {
      window.clarity("upgrade", reason);
    } catch (e) {
      console.warn("[Clarity] Error haciendo upgrade de sesión:", e);
    }
  }
}
