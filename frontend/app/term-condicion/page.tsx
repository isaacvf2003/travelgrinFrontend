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
import { useTranslation } from '@/app/hooks/useTranslation';

const translations: Record<string, any> = {
  es: {
    title: "¿Qué es Travelgrin?",
    intro: "Travelgrin es una plataforma digital que conecta a personas interesadas en viajes no vacacionales —migración, educación, trabajo temporal, salud, voluntariado y más— con oferentes que publican oportunidades y recursos relevantes. En esta etapa actuamos como plataforma de difusión y visibilidad, no como proveedor directo de los servicios publicados.",
    callout: "Al acceder, navegar, registrarte o utilizar Travelgrin aceptás la totalidad de este documento. Si no estás de acuerdo con alguna de sus disposiciones, por favor no utilices la plataforma.",
    mvp: "Travelgrin se encuentra en etapa de producto mínimo viable (MVP). Sus funcionalidades, categorías, flujos y condiciones podrán evolucionar conforme al desarrollo del proyecto y la validación de mercado.",
    defIntro: "Para que todos entendamos lo mismo, usamos estos términos a lo largo del documento:",
    natureIntro: "Travelgrin actúa como intermediario digital de difusión. Esto significa que:",
    natureBullets: [
      "No somos proveedor directo de los servicios publicados por terceros.",
      "No garantizamos el contenido publicado por oferentes ni somos responsables de los acuerdos entre partes.",
      "No actuamos como representante legal de los oferentes."
    ],
    natureFooter: "La plataforma se orienta principalmente a oportunidades vinculadas con viajes no vacacionales: gestiones migratorias y visas, educación, empleo temporal, salud y bienestar, voluntariados, deporte y emprendimiento, entre otras categorías que podrán incorporarse o reorganizarse según el desarrollo del producto.",
    eligibilityIntro: "Pueden utilizar Travelgrin personas mayores de 18 años. Al registrarte declarás, bajo tu responsabilidad, cumplir con los requisitos de capacidad y legitimación según la normativa que te sea aplicable.",
    eligibilityFooter: "Travelgrin podrá solicitar información adicional —datos de contacto, identidad o documentación— cuando lo considere necesario por razones operativas, de seguridad o de prevención de fraude.",
    obligationsIntro: "Si publicás contenido en Travelgrin, te comprometés a:",
    obligationsBullets: [
      "Proporcionar información veraz, clara y suficientemente precisa sobre la oportunidad o servicio ofrecido.",
      "Contar con las licencias, habilitaciones y autorizaciones legales necesarias para publicar y prestar el servicio anunciado.",
      "No incorporar contenido ilícito, discriminatorio, engañoso, fraudulento o incompatible con la finalidad de la plataforma.",
      "Colaborar con las verificaciones o rectificaciones que Travelgrin pueda solicitar razonablemente."
    ],
    obligationsFooter: "Travelgrin podrá moderar, pausar, editar, desindexar o eliminar publicaciones cuando lo considere necesario por razones técnicas, operativas, de calidad o de cumplimiento normativo, lo que incluye la facultad de aplicar procesos de curaduría, selección o verificación previa de la idoneidad de las ofertas, con o sin previo aviso.",
    rulesIntro: "Como usuario viajero podés explorar publicaciones, usar filtros, completar formularios, manifestar intereses y contactar a terceros a través de los canales habilitados. Al hacerlo, te comprometés a:",
    rulesBullets: [
      "Utilizar la plataforma de buena fe, sin afectar la seguridad ni la experiencia de otros usuarios.",
      "No recopilar datos de terceros sin autorización, hacer scraping no autorizado ni enviar comunicaciones masivas no solicitadas.",
      "No suplantar identidades, manipular métricas ni distribuir software malicioso."
    ],
    rulesFooter: "Podés reportar contenido sospechoso o publicaciones que te generen dudas. Cada reporte será evaluado individualmente.",
    privTitle1: "¿Qué información recopilamos?",
    privBullets1: [
      { label: "Datos de identificación y contacto:", detail: "nombre, correo, teléfono, país, ciudad, organización." },
      { label: "Datos de contexto del viajero:", detail: "país de pasaporte, destino de interés, categorías consultadas." },
      { label: "Datos de uso:", detail: "páginas visitadas, filtros aplicados, tiempos de permanencia, interacciones con formularios." }
    ],
    privTitle2: "¿Para qué usamos esa información?",
    privBullets2: [
      "Operar la plataforma y gestionar publicaciones.",
      "Personalizar la experiencia según perfil y preferencias.",
      "Detectar fraudes y proteger la seguridad del ecosistema.",
      "Mejorar el producto a partir del comportamiento de uso.",
      "Enviar comunicaciones operativas, informativas o promocionales relevantes."
    ],
    privTitle3: "¿Cómo protegemos tu información?",
    privText3: "Adoptamos medidas razonables de organización y resguardo acordes con la etapa del proyecto. Ningún entorno digital garantiza seguridad absoluta, pero trabajamos para minimizar riesgos. Podemos apoyarnos en proveedores e infraestructuras técnicas de terceros.",
    privTitle4: "Automatización e inteligencia artificial",
    privText4: "Travelgrin podrá incorporar herramientas de recomendación, clasificación, detección de fraude o analítica avanzada —propias o de terceros— para mejorar la experiencia y la calidad del servicio. Su implementación podrá ser total, parcial o experimental según la etapa del producto.",
    privTitle5: "Tus derechos sobre tus datos",
    privText5: 'Podés solicitar revisión, rectificación, actualización o baja de tu información escribiendo a <a href="mailto:travelgrin@travelgrin.com" className="text-secondary font-medium hover:underline">travelgrin@travelgrin.com</a> con el asunto "Legal". La recepción de tu solicitud no implica eliminación inmediata, ya que cada caso puede requerir verificación previa.',
    privTitle6: "¿Cuánto tiempo conservamos tus datos?",
    privText6: "Conservamos información mientras sea necesaria para operar la plataforma, gestionar reclamos, prevenir fraude o cumplir obligaciones legales. Cuando ya no sea necesaria, procedemos a su eliminación o anonimización.",
    intellectualText1: "Los elementos propios de Travelgrin —marca, diseño, estructura, selección de contenido y bases organizativas— están protegidos por la normativa de propiedad intelectual aplicable.",
    intellectualText2: "Al publicar contenido en la plataforma, el oferente autoriza a Travelgrin, de manera no exclusiva y sin compensación adicional, a reproducir, adaptar y difundir dicho contenido dentro y fuera de la plataforma —incluyendo materiales institucionales, presentaciones y canales vinculados al proyecto.",
    intellectualText3: "El oferente garantiza tener derechos suficientes sobre el contenido aportado y mantendrá indemne a Travelgrin frente a reclamos de terceros derivados del uso autorizado de ese contenido.",
    liabilityCallout: "Travelgrin no garantiza resultados específicos del uso de la plataforma: obtención de empleo, aprobación de visados, acceso a beneficios, aceptación en instituciones educativas u otros resultados individuales. La plataforma conecta partes pero no interviene en los acuerdos que se generen entre ellas.",
    liabilityText: "La plataforma no es responsable por acuerdos celebrados directamente entre usuarios y terceros, pagos efectuados fuera de sus entornos controlados, errores atribuibles a oferentes o partners, ni por la disponibilidad o legalidad de servicios externos enlazados. En la medida permitida por la normativa aplicable, Travelgrin no responderá por daños indirectos, pérdida de oportunidad, pérdida de datos o interrupciones del servicio que excedan su control razonable.",
    commercialText1: "En la etapa actual, Travelgrin puede ofrecer publicaciones destacadas u otros mecanismos de mayor visibilidad. Las condiciones específicas se informarán en el momento correspondiente.",
    commercialText2: "En etapas posteriores podrán incorporarse modelos de negocio adicionales: comisiones, suscripciones, servicios premium, pagos por leads, membresías, espacios patrocinados u otras modalidades compatibles con el desarrollo del proyecto. La mención de una funcionalidad futura en este documento no obliga a Travelgrin a implementarla ni genera expectativas exigibles sobre fechas, alcances o condiciones económicas.",
    modificationsText1: "Travelgrin puede modificar este documento, sus políticas y las funcionalidades de la plataforma en cualquier momento. Los cambios podrán implementarse con o sin previo aviso. La continuidad en el uso de la plataforma después de una actualización implica aceptación de la versión vigente. Si una disposición fuera considerada inválida por autoridad competente, el resto del documento continuará vigente en todo lo que sea compatible con esa decisión.",
    modificationsText2: "Este documento se rige provisionalmente por la normativa de la República Argentina. El acceso a la plataforma desde el exterior se realiza por cuenta y riesgo del usuario, sin garantizar que el contenido sea adecuado o legal en otras jurisdicciones. Travelgrin podrá actualizar esta referencia jurisdiccional conforme a su expansión internacional. En caso de traducción, prevalece la versión en español.",
    definitions: [
      { term: 'Plataforma', definition: 'El entorno digital de Travelgrin, incluyendo sitio web, formularios, canales y futuras integraciones.' },
      { term: 'Usuario oferente', definition: 'Persona o entidad que publica oportunidades, recursos o servicios en la plataforma.' },
      { term: 'Usuario viajero / demandante', definition: 'Persona que explora, consulta o contacta oportunidades publicadas por terceros.' },
      { term: 'Partner o aliado', definition: 'Entidad que, además de operar como oferente, puede brindar beneficios o acuerdos de colaboración con Travelgrin.' },
      { term: 'Contenido', definition: 'Textos, imágenes, enlaces, formularios, descripciones y todo material incorporado a una publicación.' },
      { term: 'Datos personales', definition: 'Toda información que identifique o pueda razonablemente identificar a una persona.' }
    ]
  },
  en: {
    title: "What is Travelgrin?",
    intro: "Travelgrin is a digital platform that connects people interested in non-vacational travel—migration, education, seasonal work, health, volunteering, and more—with providers who publish relevant opportunities and resources. At this stage, we act as a distribution and visibility platform, not as a direct provider of the published services.",
    callout: "By accessing, browsing, registering, or using Travelgrin, you accept this document in its entirety. If you do not agree with any of its provisions, please do not use the platform.",
    mvp: "Travelgrin is currently in the minimum viable product (MVP) phase. Its features, categories, flows, and conditions may evolve based on project development and market validation.",
    defIntro: "To ensure we are all on the same page, we use these terms throughout this document:",
    natureIntro: "Travelgrin acts as a digital distribution intermediary. This means that:",
    natureBullets: [
      "We are not a direct provider of services published by third parties.",
      "We do not guarantee the content published by providers, nor are we responsible for agreements between parties.",
      "We do not act as a legal representative of the providers."
    ],
    natureFooter: "The platform focuses primarily on opportunities related to non-vacational travel: immigration and visa procedures, education, temporary employment, health and wellness, volunteering, sports, and entrepreneurship, among other categories that may be added or restructured according to product development.",
    eligibilityIntro: "People over 18 years of age may use Travelgrin. By registering, you declare, under your responsibility, that you meet the capacity and authorization requirements under the regulations applicable to you.",
    eligibilityFooter: "Travelgrin may request additional information—contact details, identity, or documentation—when deemed necessary for operational, security, or fraud prevention reasons.",
    obligationsIntro: "If you publish content on Travelgrin, you commit to:",
    obligationsBullets: [
      "Providing true, clear, and sufficiently precise information about the offered opportunity or service.",
      "Having the licenses, credentials, and legal authorizations necessary to publish and perform the advertised service.",
      "Not incorporating illegal, discriminatory, misleading, fraudulent content or content incompatible with the platform's purpose.",
      "Cooperating with verification or rectification requests that Travelgrin may reasonably make."
    ],
    obligationsFooter: "Travelgrin may moderate, pause, edit, de-index, or remove publications when deemed necessary for technical, operational, quality, or compliance reasons, including the right to apply curatorial, selection, or pre-verification processes, with or without prior notice.",
    rulesIntro: "As a traveler user, you can browse listings, use filters, fill out forms, express interest, and contact third parties through the enabled channels. In doing so, you commit to:",
    rulesBullets: [
      "Using the platform in good faith, without affecting the security or experience of other users.",
      "Not collecting third-party data without authorization, performing unauthorized scraping, or sending unsolicited bulk communications.",
      "Not impersonating identities, manipulating metrics, or distributing malicious software."
    ],
    rulesFooter: "You can report suspicious content or publications that raise concerns. Each report will be evaluated individually.",
    privTitle1: "What information do we collect?",
    privBullets1: [
      { label: "Identification and contact data:", detail: "name, email, phone, country, city, organization." },
      { label: "Traveler context data:", detail: "passport country, destination of interest, categories consulted." },
      { label: "Usage data:", detail: "pages visited, filters applied, duration of stay, form interactions." }
    ],
    privTitle2: "What do we use this information for?",
    privBullets2: [
      "To operate the platform and manage publications.",
      "To personalize the experience according to profile and preferences.",
      "To detect fraud and protect the security of the ecosystem.",
      "To improve the product based on usage behavior.",
      "To send relevant operational, informational, or promotional communications."
    ],
    privTitle3: "How do we protect your information?",
    privText3: "We adopt reasonable organizational and security measures aligned with the current phase of the project. No digital environment guarantees absolute security, but we work to minimize risks. We may rely on third-party technical providers and infrastructures.",
    privTitle4: "Automation and artificial intelligence",
    privText4: "Travelgrin may integrate recommendation, classification, fraud detection, or advanced analytics tools—proprietary or third-party—to improve the experience and quality of service. Their implementation may be total, partial, or experimental based on the product phase.",
    privTitle5: "Your rights over your data",
    privText5: 'You can request review, correction, update, or deletion of your information by writing to <a href="mailto:travelgrin@travelgrin.com" className="text-secondary font-medium hover:underline">travelgrin@travelgrin.com</a> with the subject line "Legal". The receipt of your request does not imply immediate deletion, as each case may require prior verification.',
    privTitle6: "How long do we retain your data?",
    privText6: "We retain information for as long as necessary to operate the platform, handle claims, prevent fraud, or comply with legal obligations. When no longer needed, we proceed to delete or anonymize it.",
    intellectualText1: "The elements specific to Travelgrin—brand, design, structure, content selection, and organizational bases—are protected by applicable intellectual property regulations.",
    intellectualText2: "By publishing content on the platform, the provider authorizes Travelgrin, non-exclusively and without additional compensation, to reproduce, adapt, and distribute said content inside and outside the platform—including institutional materials, presentations, and channels related to the project.",
    intellectualText3: "The provider guarantees having sufficient rights over the contributed content and will hold Travelgrin harmless from third-party claims arising from the authorized use of that content.",
    liabilityCallout: "Travelgrin does not guarantee specific results from the use of the platform: obtaining employment, visa approval, access to benefits, acceptance into educational institutions, or other individual results. The platform connects parties but does not intervene in any agreements generated between them.",
    liabilityText: "The platform is not responsible for agreements made directly between users and third parties, payments made outside its controlled environments, errors attributable to providers or partners, or the availability or legality of linked external services. To the extent permitted by applicable law, Travelgrin will not be liable for indirect damages, loss of opportunity, loss of data, or service interruptions beyond its reasonable control.",
    commercialText1: "At the current stage, Travelgrin may offer featured publications or other mechanisms for higher visibility. Specific conditions will be communicated at the appropriate time.",
    commercialText2: "At later stages, additional business models may be incorporated: commissions, subscriptions, premium services, payment per lead, memberships, sponsored spaces, or other modalities compatible with the project's development. The mention of future functionality in this document does not obligate Travelgrin to implement it, nor does it create enforceable expectations regarding dates, scopes, or economic conditions.",
    modificationsText1: "Travelgrin may modify this document, its policies, and the platform's functionalities at any time. Changes may be implemented with or without prior notice. Continued use of the platform after an update implies acceptance of the current version. If any provision is deemed invalid by a competent authority, the remainder of the document will remain in force in all aspects compatible with that decision.",
    modificationsText2: "This document is provisionally governed by the laws of the Argentine Republic. Accessing the platform from abroad is at the user's own risk, with no guarantee that the content is appropriate or legal in other jurisdictions. Travelgrin may update this jurisdictional reference in accordance with its international expansion. In case of translation, the Spanish version shall prevail.",
    definitions: [
      { term: 'Platform', definition: 'The digital environment of Travelgrin, including website, forms, channels, and future integrations.' },
      { term: 'Provider user', definition: 'A person or entity that publishes opportunities, resources, or services on the platform.' },
      { term: 'Traveler / demanding user', definition: 'A person who explores, views, or contacts opportunities published by third parties.' },
      { term: 'Partner or ally', definition: 'An entity that, in addition to operating as a provider, may offer benefits or collaboration agreements with Travelgrin.' },
      { term: 'Content', definition: 'Texts, images, links, forms, descriptions, and all material incorporated into a publication.' },
      { term: 'Personal data', definition: 'Any information that identifies or can reasonably identify a person.' }
    ]
  },
  pt: {
    title: "O que é o Travelgrin?",
    intro: "Travelgrin é uma plataforma digital que conecta pessoas interessadas em viagens não vacacionais —migração, educação, trabalho temporário, saúde, voluntariado e mais— com ofertantes que publicam oportunidades e recursos relevantes. Nesta etapa, atuamos como plataforma de difusão e visibilidade, não como fornecedor direto dos serviços publicados.",
    callout: "Ao acessar, navegar, registrar-se ou usar o Travelgrin, você aceita este documento na íntegra. Se você não concordar com alguma de suas disposições, por favor não use a plataforma.",
    mvp: "O Travelgrin está na fase de produto mínimo viável (MVP). Suas funcionalidades, categorias, fluxos e condições poderão evoluir de acordo com o desenvolvimento do projeto e a validação do mercado.",
    defIntro: "Para que todos entendamos o mesmo, usamos estes termos ao longo deste documento:",
    natureIntro: "O Travelgrin atua como intermediário digital de difusão. Isso significa que:",
    natureBullets: [
      "Não somos fornecedor direto dos serviços publicados por terceiros.",
      "Não garantimos o conteúdo publicado pelos ofertantes nem somos responsáveis pelos acordos entre as partes.",
      "Não atuamos como representante legal dos ofertantes."
    ],
    natureFooter: "A plataforma orienta-se principalmente a oportunidades vinculadas a viagens não vacacionais: processos migratórios e vistos, educação, emprego temporário, saúde e bem-estar, voluntariados, esporte e empreendedorismo, entre outras categorias que possam ser incorporadas ou reorganizadas segundo o desenvolvimento do produto.",
    eligibilityIntro: "Pessoas maiores de 18 anos podem usar o Travelgrin. Ao registrar-se, declara, sob sua responsabilidade, cumprir com os requisitos de capacidade e legitimação de acordo com as leis aplicáveis a você.",
    eligibilityFooter: "O Travelgrin poderá solicitar informações adicionais —dados de contato, identidade ou documentação— quando considerar necessário por motivos operacionais, de segurança ou de prevenção de fraudes.",
    obligationsIntro: "Se você publicar conteúdo no Travelgrin, compromete-se a:",
    obligationsBullets: [
      "Fornecer informações verdadeiras, claras e suficientemente precisas sobre a oportunidade ou serviço oferecido.",
      "Contar com as licenças, habilitações e autorizações legais necessárias para publicar e prestar o serviço anunciado.",
      "Não incorporar conteúdo ilícito, discriminatório, enganoso, fraudulento ou incompatível com a finalidade da plataforma.",
      "Colaborar com as verificações ou retificações que o Travelgrin possa solicitar de forma razoável."
    ],
    obligationsFooter: "O Travelgrin poderá moderar, pausar, editar, desindexar ou remover publicações quando considerar necessário por razões técnicas, operacionais, de qualidade ou de conformidade regulatória, o que inclui a faculdade de aplicar processos de curadoria, seleção ou verificação prévia de adequação das ofertas, com ou sem aviso prévio.",
    rulesIntro: "Como usuário viajante você pode explorar publicações, usar filtros, preencher formulários, manifestar interesses e contatar terceiros através dos canais ativados. Ao fazê-lo, compromete-se a:",
    rulesBullets: [
      "Utilizar a plataforma de boa-fé, sem afetar a segurança ou a experiência de outros usuários.",
      "Não coletar dados de terceiros sem autorização, realizar scraping não autorizado ou enviar comunicações em massa não solicitadas.",
      "Não personificar identidades, manipular métricas nem distribuir software malicioso."
    ],
    rulesFooter: "Você pode denunciar conteúdo suspeito ou publicações que gerem dúvidas. Cada denúncia será avaliada individualmente.",
    privTitle1: "Que informações coletamos?",
    privBullets1: [
      { label: "Dados de identificação e contato:", detail: "nome, email, telefone, país, cidade, organização." },
      { label: "Dados de contexto do viajante:", detail: "país do passaporte, destino de interesse, categorias consultadas." },
      { label: "Dados de uso:", detail: "páginas visitadas, filtros aplicados, tempo de permanência, interações com formulários." }
    ],
    privTitle2: "Para que usamos essas informações?",
    privBullets2: [
      "Operar a plataforma e gerenciar publicações.",
      "Personalizar a experiência de acordo com o perfil e preferências.",
      "Detectar fraudes e proteger a segurança do ecossistema.",
      "Melhorar o produto a partir do comportamento de uso.",
      "Enviar comunicações operativas, informativas ou promocionais relevantes."
    ],
    privTitle3: "Como protegemos suas informações?",
    privText3: "Adotamos medidas organizacionais e de segurança razoáveis de acordo com a fase do projeto. Nenhum ambiente digital garante segurança absoluta, mas trabalhamos para minimizar riscos. Podemos contar com fornecedores e infraestruturas técnicas de terceiros.",
    privTitle4: "Automação e inteligência artificial",
    privText4: "O Travelgrin poderá incorporar ferramentas de recomendação, classificação, detecção de fraude ou análise avançada —próprias ou de terceiros— para melhorar a experiência e a qualidade do serviço. Sua implementação poderá ser total, parcial ou experimental, conforme a fase do produto.",
    privTitle5: "Seus direitos sobre seus dados",
    privText5: 'Você pode solicitar revisão, retificação, atualização ou exclusão de suas informações escrevendo para <a href="mailto:travelgrin@travelgrin.com" className="text-secondary font-medium hover:underline">travelgrin@travelgrin.com</a> com o assunto "Legal". A recepção da sua solicitação não implica eliminação imediata, pois cada caso pode requerer verificação prévia.',
    privTitle6: "Por quanto tempo conservamos seus dados?",
    privText6: "Conservamos informações enquanto forem necessárias para operar a plataforma, gerenciar reclamações, prevenir fraudes ou cumprir obrigações legais. Quando não forem mais necessárias, procedemos à sua eliminação ou anonimização.",
    intellectualText1: "Os elementos próprios do Travelgrin —marca, design, estrutura, seleção de conteúdo e bases organizacionais— estão protegidos pelas leis de propriedade intelectual aplicáveis.",
    intellectualText2: "Ao publicar conteúdo na plataforma, o ofertante autoriza o Travelgrin, de forma não exclusiva e sem compensação adicional, a reproduzir, adaptar e divulgar tal conteúdo dentro e fora da plataforma —incluindo materiais institucionais, apresentações e canais vinculados ao projeto.",
    intellectualText3: "O ofertante garante ter direitos suficientes sobre o conteúdo fornecido e manterá o Travelgrin indene contra reclamações de terceiros decorrentes do uso autorizado desse conteúdo.",
    liabilityCallout: "O Travelgrin não garante resultados específicos do uso da plataforma: obtenção de emprego, aprovação de vistos, acesso a benefícios, aceitação em instituições de ensino ou outros resultados individuais. A plataforma conecta partes, mas não intervém nos acordos gerados entre elas.",
    liabilityText: "A plataforma não é responsável por acordos celebrados diretamente entre usuários e terceiros, pagamentos efetuados fora de seus ambientes controlados, erros atribuíveis a ofertantes ou parceiros, nem pela disponibilidade ou legalidade de serviços externos vinculados. Na medida permitida pelas leis aplicáveis, o Travelgrin não responderá por danos indiretos, perda de oportunidade, perda de dados ou interrupções do serviço fora do seu controle razoável.",
    commercialText1: "Na fase atual, o Travelgrin pode oferecer publicações destacadas ou outros mecanismos de maior visibilidade. As condições específicas serão informadas no momento correspondente.",
    commercialText2: "Em etapas posteriores, poderão ser incorporados modelos de negócios adicionais: comissões, assinaturas, serviços premium, pagamentos por leads, associações, espaços patrocinados ou outras modalidades compatíveis com o desenvolvimento do projeto. A menção de uma funcionalidade futura neste documento não obriga o Travelgrin a implementá-la, nem gera expectativas exigíveis sobre datas, escopos ou condições econômicas.",
    modificationsText1: "O Travelgrin pode modificar este documento, suas políticas e as funcionalidades da plataforma a qualquer momento. As alterações poderão ser implementadas com ou sem aviso prévio. A continuidade no uso da plataforma após uma atualização implica a aceitação da versão vigente. Se alguma disposição for considerada inválida por autoridade competente, o restante do documento continuará em vigor em tudo o que for compatível com essa decisão.",
    modificationsText2: "Este documento é regido provisoriamente pelas leis da República Argentina. O acesso à plataforma a partir do exterior é feito por conta e risco do usuário, sem garantir que o conteúdo seja adequado ou legal em outras jurisdições. O Travelgrin poderá atualizar esta referência jurisdicional de acordo com sua expansão internacional. Em caso de tradução, a versão em espanhol prevalecerá.",
    definitions: [
      { term: 'Plataforma', definition: 'O ambiente digital do Travelgrin, incluindo website, formulários, canais e futuras integrações.' },
      { term: 'Usuário ofertante', definition: 'Pessoa ou entidade que publica oportunidades, recursos ou serviços na plataforma.' },
      { term: 'Usuário viajante / demandante', definition: 'Pessoa que explora, consulta ou contata oportunidades publicadas por terceiros.' },
      { term: 'Parceiro ou aliado', definition: 'Entidade que, além de operar como ofertante, pode oferecer benefícios ou acordos de colaboração com o Travelgrin.' },
      { term: 'Conteúdo', definition: 'Textos, imagens, links, formulários, descrições e todo material incorporado a uma publicação.' },
      { term: 'Dados pessoais', definition: 'Qualquer informação que identifique ou possa razoavelmente identificar uma pessoa.' }
    ]
  },
  it: {
    title: "Cos'è Travelgrin?",
    intro: "Travelgrin è una piattaforma digitale che connette persone interessate a viaggi non vacanzieri —migrazione, istruzione, lavoro stagionale, salute, volontariato e altro— con fornitori che pubblicano opportunità e risorse rilevanti. In questa fase agiamo come piattaforma di diffusione e visibilità, non come fornitore diretto dei servizi pubblicati.",
    callout: "Accedendo, navigando, registrandoti o utilizzando Travelgrin, accetti questo documento nella sua interezza. Se non concordi con alcuna delle sue disposizioni, ti preghiamo di non utilizzare la piattaforma.",
    mvp: "Travelgrin si trova attualmente nella fase di prodotto minimo funzionante (MVP). Le sue funzionalità, categorie, flussi e condizioni potranno evolvere in base allo sviluppo del progetto e alla validazione del mercato.",
    defIntro: "Per essere sicuri di intenderci, utilizziamo questi termini all'interno del documento:",
    natureIntro: "Travelgrin agisce come intermediario digitale di diffusione. Ciò significa che:",
    natureBullets: [
      "Non siamo fornitori diretti dei servizi pubblicati da terzi.",
      "Non garantiamo il contenuto pubblicato dai fornitori, né siamo responsabili degli accordi tra le parti.",
      "Non agiamo come rappresentante legale dei fornitori."
    ],
    natureFooter: "La piattaforma si orienta principalmente verso opportunità legate a viaggi non vacanzieri: procedure migratorie e visti, istruzione, lavoro temporaneo, salute e benessere, volontariato, sport e imprenditorialità, tra le altre categorie che potranno essere aggiunte o ristrutturate in base allo sviluppo del prodotto.",
    eligibilityIntro: "Le persone di età superiore ai 18 anni possono utilizzare Travelgrin. Registrandoti, dichiari sotto la tua responsabilità di soddisfare i requisiti di capacità e legittimazione secondo le normative applicabili.",
    eligibilityFooter: "Travelgrin può richiedere informazioni aggiuntive —dati di contatto, identità o documentazione— qualora ritenuto necessario per motivi operativi, di sicurezza o di prevenzione delle frodi.",
    obligationsIntro: "Se pubblichi contenuti su Travelgrin, ti impegni a:",
    obligationsBullets: [
      "Fornire informazioni veritiere, chiare e sufficientemente precise sull'opportunità o sul servizio offerto.",
      "Disporre di licenze, credenziali e autorizzazioni legali necessarie per pubblicare ed eseguire il servizio pubblicizzato.",
      "Non inserire contenuti illegali, discriminatori, ingannevoli, fraudolenti o incompatibili con lo scopo della piattaforma.",
      "Collaborare con le verifiche o rettifiche che Travelgrin possa ragionevolmente richiedere."
    ],
    obligationsFooter: "Travelgrin può moderare, sospendere, modificare, de-indicizzare o rimuovere pubblicazioni qualora ritenuto necessario per motivi tecnici, operativi, di qualità o di conformità, incluso il diritto di applicare processi di cura, selezione o pre-verifica delle offerte, con o senza preavviso.",
    rulesIntro: "Come utente viaggiatore, puoi sfogliare gli annunci, utilizzare i filtri, compilare moduli, esprimere interesse e contattare terze parti attraverso i canali abilitati. In tal modo, ti impegni a:",
    rulesBullets: [
      "Utilizzare la piattaforma in buona fede, senza compromettere la sicurezza o l'esperienza di altri utenti.",
      "Non raccogliere dati di terze parti senza autorizzazione, non effettuare scraping non autorizzato e non inviare comunicazioni di massa non richieste.",
      "Non impersonare identità, non manipolare metriche e non distribuire software dannosi."
    ],
    rulesFooter: "Puoi segnalare contenuti sospetti o pubblicazioni che destano preoccupazione. Ciascuna segnalazione sarà valutata individualmente.",
    privTitle1: "Quali informazioni raccogliamo?",
    privBullets1: [
      { label: "Dati di identificazione e contatto:", detail: "nome, email, telefono, paese, città, organizzazione." },
      { label: "Dati di contesto del viaggiatore:", detail: "paese del passaporto, destinazione di interesse, categorie consultate." },
      { label: "Dati di utilizzo:", detail: "pagine visitate, filtri applicati, tempo di permanenza, interazioni con i moduli." }
    ],
    privTitle2: "Per cosa utilizziamo queste informazioni?",
    privBullets2: [
      "Operare la piattaforma e gestire le pubblicazioni.",
      "Personalizzare l'esperienza in base al profilo e alle preferenze.",
      "Rilevare frodi e proteggere la sicurezza dell'ecosistema.",
      "Migliorare il prodotto in base al comportamento d'uso.",
      "Inviare comunicazioni operative, informative o promozionali rilevanti."
    ],
    privTitle3: "Come proteggiamo le tue informazioni?",
    privText3: "Adottiamo ragionevoli misure organizzative e di sicurezza in linea con la fase attuale del progetto. Nessun ambiente digitale garantisce la sicurezza assoluta, ma riduciamo al minimo i rischi. Possiamo affidarci a fornitori e infrastrutture tecniche di terze parti.",
    privTitle4: "Automazione e intelligenza artificiale",
    privText4: "Travelgrin può integrare strumenti di raccomandazione, classificazione, rilevamento frodi o analisi avanzata —proprietari o di terze parti— per migliorare l'esperienza e la qualità del servizio. La loro implementazione può essere totale, parziale o sperimentale in base alla fase del prodotto.",
    privTitle5: "I tuoi diritti sui tuoi dati",
    privText5: 'Puoi richiedere la revisione, correzione, aggiornamento o cancellazione delle tue informazioni scrivendo a <a href="mailto:travelgrin@travelgrin.com" className="text-secondary font-medium hover:underline">travelgrin@travelgrin.com</a> con oggetto "Legal". La ricezione della richiesta non implica la cancellazione immediata, poiché ciascun caso potrebbe richiedere una verifica preliminare.',
    privTitle6: "Per quanto tempo conserviamo i tuoi dati?",
    privText6: "Conserviamo le informazioni per il tempo necessario per operare la piattaforma, gestire reclami, prevenire frodi o rispettare gli obblighi di legge. Quando non sono più necessarie, procediamo alla loro eliminazione o anonimizzazione.",
    intellectualText1: "Gli elementi specifici di Travelgrin—marchio, design, struttura, selezione dei contenuti e basi organizzative—sono protetti dalle normative applicabili in materia di proprietà intellettuale.",
    intellectualText2: "Pubblicando contenuti sulla piattaforma, il fornitore autorizza Travelgrin, in modo non esclusivo e senza compenso aggiuntivo, a riprodurre, adattare e distribuire tali contenuti all'interno e all'esterno della piattaforma—compresi materiali istituzionali, presentazioni e canali collegati al progetto.",
    intellectualText3: "Il fornitore garantisce di disporre di diritti sufficienti sui contenuti forniti e terrà Travelgrin indenne da pretese di terzi derivanti dall'uso autorizzato di tali contenuti.",
    liabilityCallout: "Travelgrin non garantisce risultati specifici dall'uso della piattaforma: ottenimento di un impiego, approvazione del visto, accesso a benefici, ammissione a istituzioni educative o altri risultati individuali. La piattaforma connette le parti ma non interviene negli accordi generati tra loro.",
    liabilityText: "La piattaforma non è responsabile per gli accordi presi direttamente tra utenti e terze parti, pagamenti effettuati al di fuori dei suoi ambienti controllati, errori attribuibili a fornitori o partner, o la disponibilità o legalità di servizi esterni collegati. Nella misura consentita dalla legge applicabile, Travelgrin non sarà responsabile per danni indiretti, perdita di opportunità, perdita di dati o interruzioni del servizio al di fuori del suo ragionevole controllo.",
    commercialText1: "Allo stadio attuale, Travelgrin può offrire pubblicazioni in evidenza o altri meccanismi per una maggiore visibilità. Condizioni specifiche verranno comunicate al momento opportuno.",
    commercialText2: "In fasi successive, potranno essere integrati modelli di business aggiuntivi: commissioni, abbonamenti, servizi premium, pagamento per lead, iscrizioni, spazi sponsorizzati o altre modalità compatibili con lo sviluppo del progetto. La menzione di funzionalità future in questo documento non obbliga Travelgrin a implementarla, né crea aspettative esigibili riguardo a date, ambiti o condizioni economiche.",
    modificationsText1: "Travelgrin può modificare questo documento, le sue politiche e le funzionalità della piattaforma in qualsiasi momento. Le modifiche possono essere implementate con o senza preavviso. L'uso continuato della piattaforma dopo un aggiornamento comporta l'accettazione della versione corrente. Se una disposizione è ritenuta non valida da un'autorità competente, la parte restante del documento rimarrà in vigore in tutti gli aspetti compatibili con tale decisione.",
    modificationsText2: "Questo documento è provvisoriamente disciplinato dalle leggi della Repubblica Argentina. L'accesso alla piattaforma dall'estero avviene a rischio e pericolo dell'utente, senza alcuna garanzia che il contenuto sia appropriato o legale in altre giurisdizioni. Travelgrin potrà aggiornare questo riferimento giurisdizionale in conformità con la sua espansione internazionale. In caso di traduzione, prevarrà la versione in spagnolo.",
    definitions: [
      { term: 'Piattaforma', definition: "L'ambiente digitale di Travelgrin, inclusi sito web, moduli, canali e future integrazioni." },
      { term: 'Utente fornitore', definition: "Una persona o entità che pubblica opportunità, risorse o servizi sulla piattaforma." },
      { term: 'Utente viaggiatore / richiedente', definition: "Una persona che esplora, visualizza o contatta opportunità pubblicate da terze parti." },
      { term: 'Partner o alleato', definition: "Un'entità che, oltre a operare come fornitore, può offrire vantaggi o accordi di collaborazione con Travelgrin." },
      { term: 'Contenuto', definition: "Testi, immagini, collegamenti, moduli, descrizioni e tutto il materiale incorporato in una pubblicazione." },
      { term: 'Dati personali', definition: "Qualsiasi informazione che identifichi o possa ragionevolmente identificare una persona." }
    ]
  }
};

export default function TermsAndConditions() {
  const { locale } = useTranslation();
  const t = translations[locale] || translations.es;
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
                {t.title}
              </h2>
              <p className="mb-5 text-base">
                {t.intro}
              </p>

              <CalloutBox>
                {t.callout}
              </CalloutBox>

              <p className="rounded-2xl border border-[#bfeeed] bg-[#f0fbfa] p-5 text-sm italic shadow-sm">
                {t.mvp}
              </p>
            </div>

            {/* 1 DEFINICIONES CLAVE */}
            <SectionHeading number="1" title={locale === "en" ? "Key Definitions" : locale === "pt" ? "Definições Chave" : locale === "it" ? "Definizioni Chiave" : "Definiciones Clave"} id="definiciones" />
            <p className="mb-5 text-base">
              {t.defIntro}
            </p>
            <DefinitionTable items={t.definitions} />

            {/* 2 NATURALEZA DEL SERVICIO */}
            <SectionHeading number="2" title={locale === "en" ? "Nature of the Service" : locale === "pt" ? "Natureza do Serviço" : locale === "it" ? "Natura del Servizio" : "Naturaleza del Servicio"} id="naturaleza" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.natureIntro}
            </p>
            <ul className="mb-6 space-y-3 rounded-2xl border border-[#d7f1f0] bg-[#f7fdfd] p-5">
              {t.natureBullets.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-7 text-[#40535a]">
                  <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#08d9bd] shadow-[0_0_0_4px_rgba(8,217,189,0.12)]" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              {t.natureFooter}
            </p>

            {/* 3 REGISTRO Y ELEGIBILIDAD */}
            <SectionHeading number="3" title={locale === "en" ? "Registration and Eligibility" : locale === "pt" ? "Registro e Elegibilidade" : locale === "it" ? "Registrazione ed Elegibilità" : "Registro y Elegibilidad"} id="registro" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.eligibilityIntro}
            </p>
            <PassportTable />
            <p className="text-muted-foreground leading-relaxed">
              {t.eligibilityFooter}
            </p>

            {/* 4 OBLIGACIONES OFERENTES */}
            <SectionHeading number="4" title={locale === "en" ? "Obligations of Provider Users" : locale === "pt" ? "Obrigações dos Usuários Ofertantes" : locale === "it" ? "Obblighi dei Fornitori" : "Obligaciones de los Usuarios Oferentes"} id="oferentes" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.obligationsIntro}
            </p>
            <ul className="mb-6 space-y-3 rounded-2xl border border-[#d7f1f0] bg-[#f7fdfd] p-5">
              {t.obligationsBullets.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-7 text-[#40535a]">
                  <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#08d9bd] shadow-[0_0_0_4px_rgba(8,217,189,0.12)]" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="rounded-2xl border border-[#bfeeed] bg-[#f0fbfa] p-5 text-sm shadow-sm">
              {t.obligationsFooter}
            </p>

            {/* 5 REGLAS VIAJEROS */}
            <SectionHeading number="5" title={locale === "en" ? "Rules of Use for Travelers" : locale === "pt" ? "Regras de Uso para Viajantes" : locale === "it" ? "Regole d'Uso per i Viaggiatori" : "Reglas de Uso para Usuarios Viajeros"} id="viajeros" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.rulesIntro}
            </p>
            <ul className="mb-6 space-y-3 rounded-2xl border border-[#d7f1f0] bg-[#f7fdfd] p-5">
              {t.rulesBullets.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-7 text-[#40535a]">
                  <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#08d9bd] shadow-[0_0_0_4px_rgba(8,217,189,0.12)]" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              {t.rulesFooter}
            </p>

            {/* 6 PRIVACIDAD */}
            <SectionHeading number="6" title={locale === "en" ? "Privacy and Data Processing" : locale === "pt" ? "Privacidade e Tratamento de Dados" : locale === "it" ? "Privacy e Trattamento dei Dati" : "Privacidad y Tratamiento de Datos"} id="privacidad" />

            <SubHeading>{t.privTitle1}</SubHeading>
            <ul className="mb-6 space-y-3 rounded-2xl border border-[#d7f1f0] bg-[#f7fdfd] p-5">
              {t.privBullets1.map((item: any, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-7 text-[#40535a]">
                  <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#08d9bd] shadow-[0_0_0_4px_rgba(8,217,189,0.12)]" />
                  <span><strong className="text-[#173238]">{item.label}</strong> {item.detail}</span>
                </li>
              ))}
            </ul>

            <SubHeading>{t.privTitle2}</SubHeading>
            <ul className="mb-6 space-y-3 rounded-2xl border border-[#d7f1f0] bg-[#f7fdfd] p-5">
              {t.privBullets2.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-7 text-[#40535a]">
                  <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#08d9bd] shadow-[0_0_0_4px_rgba(8,217,189,0.12)]" />
                  {item}
                </li>
              ))}
            </ul>

            <SubHeading>{t.privTitle3}</SubHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.privText3}
            </p>

            <SubHeading>{t.privTitle4}</SubHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.privText4}
            </p>

            <SubHeading>{t.privTitle5}</SubHeading>
            <p className="text-muted-foreground leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: t.privText5 }} />

            <SubHeading>{t.privTitle6}</SubHeading>
            <p className="text-muted-foreground leading-relaxed">
              {t.privText6}
            </p>

            {/* 7 PROPIEDAD INTELECTUAL */}
            <SectionHeading number="7" title={locale === "en" ? "Intellectual Property" : locale === "pt" ? "Propriedade Intelectual" : locale === "it" ? "Proprietà Intellettuale" : "Propriedad Intelectual"} id="propiedad" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.intellectualText1}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.intellectualText2}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t.intellectualText3}
            </p>

            {/* 8 LIMITACIÓN DE RESPONSABILIDAD */}
            <SectionHeading number="8" title={locale === "en" ? "Limitation of Liability" : locale === "pt" ? "Limitação de Responsabilidade" : locale === "it" ? "Limitazione di Responsabilità" : "Limitación de Responsabilidad"} id="responsabilidad" />
            <ImportantBox>
              <p className="mb-3">
                {t.liabilityCallout}
              </p>
            </ImportantBox>
            <p className="text-muted-foreground leading-relaxed">
              {t.liabilityText}
            </p>

            {/* 9 MODELO COMERCIAL */}
            <SectionHeading number="9" title={locale === "en" ? "Business Model and Service Evolution" : locale === "pt" ? "Modelo Comercial e Evolução do Serviço" : locale === "it" ? "Modello Commerciale ed Evoluzione" : "Modelo Comercial y Evolución del Servicio"} id="modelo" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.commercialText1}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t.commercialText2}
            </p>

            {/* 10 MODIFICACIONES */}
            <SectionHeading number="10" title={locale === "en" ? "Modifications, Law and Contact" : locale === "pt" ? "Modificações, Lei e Contato" : locale === "it" ? "Modiche, Legge e Contatti" : "Modificaciones, Ley Aplicable y Contacto"} id="modificaciones" />
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.modificationsText1}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t.modificationsText2}
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
