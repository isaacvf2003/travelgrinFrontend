// Test script to simulate AI scraper and taxonomy resolution on Garrahan and UBA

const KNOWN_INSTITUTIONS_MAP = {
  "garrahan.gov.ar": {
    name: "Hospital Garrahan",
    startYear: "1987",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Organismo público",
    additionalCities: [],
  },
  "uba.ar": {
    name: "Universidad de Buenos Aires",
    startYear: "1821",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Organismo público",
    additionalCities: [],
  },
  "21.edu.ar": {
    name: "Universidad Siglo 21",
    startYear: "1995",
    primaryCity: "Córdoba",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Institución privada",
    additionalCities: ["Río Cuarto", "Buenos Aires", "Villa María"],
  }
};

function cleanTitleString(title) {
  let decoded = title;
  decoded = decoded
    .replace(/\s*[-–—|]\s*(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*$/i, "")
    .replace(/^(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*[-–—|]\s*/i, "")
    .trim();
  const parts = decoded.split(/\s*[-–—|]\s*/);
  if (parts.length >= 2 && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
    return parts[0].trim();
  }
  return decoded;
}

function test() {
  console.log('--- Test cleanTitleString ---');
  console.log('Garrahan:', cleanTitleString('Hospital Garrahan - Home'));
  console.log('UBA:', cleanTitleString('Universidad de Buenos Aires - Inicio'));
  console.log('Clínica:', cleanTitleString('Clínica Las Condes | Sitio Oficial'));

  console.log('--- Test Garrahan resolution ---');
  const garrahanInfo = KNOWN_INSTITUTIONS_MAP['garrahan.gov.ar'];
  console.log('Garrahan Benchmark:', garrahanInfo);
}

test();
