'use client';

import React from 'react';
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { ArrowUp } from 'lucide-react';
import TermsHeader from '@/components/terms/TermsHeader';
import TermsNav from '@/components/terms/TermsNav';
import SectionHeading from '@/components/terms/SectionHeading';
import SubHeading from '@/components/terms/SubHeading';
import CalloutBox from '@/components/terms/CalloutBox';
import DefinitionTable from '@/components/terms/DefinitionTable';
import PassportTable from '@/components/terms/PassportTable';
import ImportantBox from '@/components/terms/ImportantBox';
import TermsFooter from '@/components/terms/TermsFooter';

const definitions = [
  { term: 'Plataforma', definition: 'El entorno digital de Travelgrin, incluyendo sitio web, formularios, canales y futuras integraciones.' },
  { term: 'Usuario oferente', definition: 'Persona o entidad que publica oportunidades, recursos o servicios en la plataforma.' },
  { term: 'Usuario viajero / demandante', definition: 'Persona que explora, consulta o contacta oportunidades publicadas por terceros.' },
  { term: 'Partner o aliado', definition: 'Entidad que, además de operar como oferente, puede brindar beneficios o acuerdos de colaboración con Travelgrin.' },
  { term: 'Contenido', definition: 'Textos, imágenes, enlaces, formularios, descripciones y todo material incorporado a una publicación.' },
  { term: 'Datos personales', definition: 'Toda información que identifique o pueda razonablemente identificar a una persona.' },
];

export default function TermsAndConditions() {
  const [showTop, setShowTop] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5fbfb] text-[#173238]">
      <NavBar />
      <TermsHeader />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 md:px-8 lg:py-14">
        <div className="pointer-events-none absolute inset-x-4 top-8 -z-0 h-72 rounded-full bg-[#08d9bd]/10 blur-3xl" />
        <div className="relative grid items-start gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)]">
          {/* Sidebar nav */}
          <aside className="hidden lg:block">
            <TermsNav />
          </aside>

          {/* Main content */}
          <main className="min-w-0 rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_24px_70px_rgba(9,93,104,0.12)] backdrop-blur sm:p-8 lg:p-10 xl:p-12 [&_a]:text-[#0799aa] [&_a]:underline-offset-4 [&_a:hover]:underline [&_p]:text-[#40535a] [&_p]:leading-8">
            {/* Intro - ¿Qué es Travelgrin? */}
            <div id="que-es" className="scroll-mt-8">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#075965] md:text-3xl">
                ¿Qué es Travelgrin?
              </h2>
              <p className="mb-5 text-base">
                Travelgrin es una plataforma digital que conecta a personas interesadas en viajes no vacacionales —migración, educación, trabajo temporal, salud, voluntariado y más— con oferentes que publican oportunidades y recursos relevantes. En esta etapa actuamos como plataforma de difusión y visibilidad, no como proveedor directo de los servicios publicados.
              </p>

              <CalloutBox>
                Al acceder, navegar, registrarte o utilizar Travelgrin aceptás la totalidad de este documento. Si no estás de acuerdo con alguna de sus disposiciones, por favor no utilices la plataforma.
              </CalloutBox>

              <p className="rounded-2xl border border-[#bfeeed] bg-[#f0fbfa] p-5 text-sm italic shadow-sm">
                Travelgrin se encuentra en etapa de producto mínimo viable (MVP). Sus funcionalidades, categorías, flujos y condiciones podrán evolucionar conforme al desarrollo del proyecto y la validación de mercado.
              </p>
            </div>

            {/* 1 DEFINICIONES CLAVE */}
            <SectionHeading number="1" title="Definiciones Clave" id="definiciones" />
            <p className="mb-5 text-base">
              Para que todos entendamos lo mismo, usamos estos términos a lo largo del documento:
            </p>
            <DefinitionTable items={definitions} />

            {/* 2 NATURALEZA DEL SERVICIO */}
            <SectionHeading number="2" title="Naturaleza del Servicio" id="naturaleza" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              Travelgrin actúa como intermediario digital de difusión. Esto significa que:
            </p>
            <ul className="mb-6 space-y-3 rounded-2xl border border-[#d7f1f0] bg-[#f7fdfd] p-5">
              {[
                'No somos proveedor directo de los servicios publicados por terceros.',
                'No garantizamos el contenido publicado por oferentes ni somos responsables de los acuerdos entre partes.',
                'No actuamos como representante legal de los oferentes.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-7 text-[#40535a]">
                  <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#08d9bd] shadow-[0_0_0_4px_rgba(8,217,189,0.12)]" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              La plataforma se orienta principalmente a oportunidades vinculadas con viajes no vacacionales: gestiones migratorias y visas, educación, empleo temporal, salud y bienestar, voluntariados, deporte y emprendimiento, entre otras categorías que podrán incorporarse o reorganizarse según el desarrollo del producto.
            </p>

            {/* 3 REGISTRO Y ELEGIBILIDAD */}
            <SectionHeading number="3" title="Registro y Elegibilidad" id="registro" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              Pueden utilizar Travelgrin personas mayores de 18 años. Al registrarte declarás, bajo tu responsabilidad, cumplir con los requisitos de capacidad y legitimación según la normativa que te sea aplicable.
            </p>
            <PassportTable />
            <p className="text-muted-foreground leading-relaxed">
              Travelgrin podrá solicitar información adicional —datos de contacto, identidad o documentación— cuando lo considere necesario por razones operativas, de seguridad o de prevención de fraude.
            </p>

            {/* 4 OBLIGACIONES OFERENTES */}
            <SectionHeading number="4" title="Obligaciones de los Usuarios Oferentes" id="oferentes" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              Si publicás contenido en Travelgrin, te comprometés a:
            </p>
            <ul className="mb-6 space-y-3 rounded-2xl border border-[#d7f1f0] bg-[#f7fdfd] p-5">
              {[
                'Proporcionar información veraz, clara y suficientemente precisa sobre la oportunidad o servicio ofrecido.',
                'Contar con las licencias, habilitaciones y autorizaciones legales necesarias para publicar y prestar el servicio anunciado.',
                'No incorporar contenido ilícito, discriminatorio, engañoso, fraudulento o incompatible con la finalidad de la plataforma.',
                'Colaborar con las verificaciones o rectificaciones que Travelgrin pueda solicitar razonablemente.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-7 text-[#40535a]">
                  <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#08d9bd] shadow-[0_0_0_4px_rgba(8,217,189,0.12)]" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="rounded-2xl border border-[#bfeeed] bg-[#f0fbfa] p-5 text-sm shadow-sm">
              Travelgrin podrá moderar, pausar, editar, desindexar o eliminar publicaciones cuando lo considere necesario por razones técnicas, operativas, de calidad o de cumplimiento normativo, lo que incluye la facultad de aplicar procesos de curaduría, selección o verificación previa de la idoneidad de las ofertas, con o sin previo aviso.
            </p>

            {/* 5 REGLAS VIAJEROS */}
            <SectionHeading number="5" title="Reglas de Uso para Usuarios Viajeros" id="viajeros" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              Como usuario viajero podés explorar publicaciones, usar filtros, completar formularios, manifestar intereses y contactar a terceros a través de los canales habilitados. Al hacerlo, te comprometés a:
            </p>
            <ul className="mb-6 space-y-3 rounded-2xl border border-[#d7f1f0] bg-[#f7fdfd] p-5">
              {[
                'Utilizar la plataforma de buena fe, sin afectar la seguridad ni la experiencia de otros usuarios.',
                'No recopilar datos de terceros sin autorización, hacer scraping no autorizado ni enviar comunicaciones masivas no solicitadas.',
                'No suplantar identidades, manipular métricas ni distribuir software malicioso.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-7 text-[#40535a]">
                  <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#08d9bd] shadow-[0_0_0_4px_rgba(8,217,189,0.12)]" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Podés reportar contenido sospechoso o publicaciones que te generen dudas. Cada reporte será evaluado individualmente.
            </p>

            {/* 6 PRIVACIDAD */}
            <SectionHeading number="6" title="Privacidad y Tratamiento de Datos" id="privacidad" />

            <SubHeading>¿Qué información recopilamos?</SubHeading>
            <ul className="mb-6 space-y-3 rounded-2xl border border-[#d7f1f0] bg-[#f7fdfd] p-5">
              {[
                { label: 'Datos de identificación y contacto:', detail: 'nombre, correo, teléfono, país, ciudad, organización.' },
                { label: 'Datos de contexto del viajero:', detail: 'país de pasaporte, destino de interés, categorías consultadas.' },
                { label: 'Datos de uso:', detail: 'páginas visitadas, filtros aplicados, tiempos de permanencia, interacciones con formularios.' },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-7 text-[#40535a]">
                  <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#08d9bd] shadow-[0_0_0_4px_rgba(8,217,189,0.12)]" />
                  <span><strong className="text-[#173238]">{item.label}</strong> {item.detail}</span>
                </li>
              ))}
            </ul>

            <SubHeading>¿Para qué usamos esa información?</SubHeading>
            <ul className="mb-6 space-y-3 rounded-2xl border border-[#d7f1f0] bg-[#f7fdfd] p-5">
              {[
                'Operar la plataforma y gestionar publicaciones.',
                'Personalizar la experiencia según perfil y preferencias.',
                'Detectar fraudes y proteger la seguridad del ecosistema.',
                'Mejorar el producto a partir del comportamiento de uso.',
                'Enviar comunicaciones operativas, informativas o promocionales relevantes.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-7 text-[#40535a]">
                  <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#08d9bd] shadow-[0_0_0_4px_rgba(8,217,189,0.12)]" />
                  {item}
                </li>
              ))}
            </ul>

            <SubHeading>¿Cómo protegemos tu información?</SubHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Adoptamos medidas razonables de organización y resguardo acordes con la etapa del proyecto. Ningún entorno digital garantiza seguridad absoluta, pero trabajamos para minimizar riesgos. Podemos apoyarnos en proveedores e infraestructuras técnicas de terceros.
            </p>

            <SubHeading>Automatización e inteligencia artificial</SubHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Travelgrin podrá incorporar herramientas de recomendación, clasificación, detección de fraude o analítica avanzada —propias o de terceros— para mejorar la experiencia y la calidad del servicio. Su implementación podrá ser total, parcial o experimental según la etapa del producto.
            </p>

            <SubHeading>Tus derechos sobre tus datos</SubHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Podés solicitar revisión, rectificación, actualización o baja de tu información escribiendo a{' '}
              <a href="mailto:travelgrin@travelgrin.com" className="text-secondary font-medium hover:underline">
                travelgrin@travelgrin.com
              </a>{' '}
              con el asunto "Legal". La recepción de tu solicitud no implica eliminación inmediata, ya que cada caso puede requerir verificación previa.
            </p>

            <SubHeading>¿Cuánto tiempo conservamos tus datos?</SubHeading>
            <p className="text-muted-foreground leading-relaxed">
              Conservamos información mientras sea necesaria para operar la plataforma, gestionar reclamos, prevenir fraude o cumplir obligaciones legales. Cuando ya no sea necesaria, procedemos a su eliminación o anonimización.
            </p>

            {/* 7 PROPIEDAD INTELECTUAL */}
            <SectionHeading number="7" title="Propiedad Intelectual" id="propiedad" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              Los elementos propios de Travelgrin —marca, diseño, estructura, selección de contenido y bases organizativas— están protegidos por la normativa de propiedad intelectual aplicable.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Al publicar contenido en la plataforma, el oferente autoriza a Travelgrin, de manera no exclusiva y sin compensación adicional, a reproducir, adaptar y difundir dicho contenido dentro y fuera de la plataforma —incluyendo materiales institucionales, presentaciones y canales vinculados al proyecto.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              El oferente garantiza tener derechos suficientes sobre el contenido aportado y mantendrá indemne a Travelgrin frente a reclamos de terceros derivados del uso autorizado de ese contenido.
            </p>

            {/* 8 LIMITACIÓN DE RESPONSABILIDAD */}
            <SectionHeading number="8" title="Limitación de Responsabilidad" id="responsabilidad" />
            <ImportantBox>
              <p className="mb-3">
                Travelgrin no garantiza resultados específicos del uso de la plataforma: obtención de empleo, aprobación de visados, acceso a beneficios, aceptación en instituciones educativas u otros resultados individuales. La plataforma conecta partes pero no interviene en los acuerdos que se generen entre ellas.
              </p>
            </ImportantBox>
            <p className="text-muted-foreground leading-relaxed">
              La plataforma no es responsable por acuerdos celebrados directamente entre usuarios y terceros, pagos efectuados fuera de sus entornos controlados, errores atribuibles a oferentes o partners, ni por la disponibilidad o legalidad de servicios externos enlazados. En la medida permitida por la normativa aplicable, Travelgrin no responderá por daños indirectos, pérdida de oportunidad, pérdida de datos o interrupciones del servicio que excedan su control razonable.
            </p>

            {/* 9 MODELO COMERCIAL */}
            <SectionHeading number="9" title="Modelo Comercial y Evolución del Servicio" id="modelo" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              En la etapa actual, Travelgrin puede ofrecer publicaciones destacadas u otros mecanismos de mayor visibilidad. Las condiciones específicas se informarán en el momento correspondiente.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              En etapas posteriores podrán incorporarse modelos de negocio adicionales: comisiones, suscripciones, servicios premium, pagos por leads, membresías, espacios patrocinados u otras modalidades compatibles con el desarrollo del proyecto. La mención de una funcionalidad futura en este documento no obliga a Travelgrin a implementarla ni genera expectativas exigibles sobre fechas, alcances o condiciones económicas.
            </p>

            {/* 10 MODIFICACIONES */}
            <SectionHeading number="10" title="Modificaciones, Ley Aplicable y Contacto" id="modificaciones" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              Travelgrin puede modificar este documento, sus políticas y las funcionalidades de la plataforma en cualquier momento. Los cambios podrán implementarse con o sin previo aviso. La continuidad en el uso de la plataforma después de una actualización implica aceptación de la versión vigente. Si una disposición fuera considerada inválida por autoridad competente, el resto del documento continuará vigente en todo lo que sea compatible con esa decisión.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Este documento se rige provisionalmente por la normativa de la República Argentina. El acceso a la plataforma desde el exterior se realiza por cuenta y riesgo del usuario, sin garantizar que el contenido sea adecuado o legal en otras jurisdicciones. Travelgrin podrá actualizar esta referencia jurisdiccional conforme a su expansión internacional. En caso de traducción, prevalece la versión en español.
            </p>

            <TermsFooter />

          </main>
        </div>
      </div>

      <Footer />

      {/* Back to top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#075965] text-white shadow-[0_14px_30px_rgba(7,89,101,0.28)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-[#08aeba]"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
