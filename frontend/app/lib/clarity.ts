/**
 * Microsoft Clarity Helper & Utilities (Deshabilitado en entorno de pruebas)
 */

declare global {
  interface Window {
    clarity?: (action: string, ...args: any[]) => void;
  }
}

export const CLARITY_PROJECT_ID = "";

export function clarityEvent(_eventName: string) {
  // Deshabilitado en entorno de pruebas
}

export function claritySetTag(_key: string, _value: string | number | boolean | null | undefined) {
  // Deshabilitado en entorno de pruebas
}

export function clarityIdentify(_customId: string, _friendlyName?: string) {
  // Deshabilitado en entorno de pruebas
}

export function clarityConsent(_granted: boolean = true) {
  // Deshabilitado en entorno de pruebas
}

export function clarityUpgrade(_reason: string) {
  // Deshabilitado en entorno de pruebas
}
