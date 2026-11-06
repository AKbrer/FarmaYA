package com.farmaya.service;

import com.farmaya.model.Dtos.ChatMessage;
import com.farmaya.model.Dtos.ChatRequest;
import com.farmaya.model.Dtos.ChatResponse;
import com.farmaya.model.Dtos.SuggestedProductDto;
import com.farmaya.model.Product;
import com.farmaya.repo.ProductRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ChatbotService {
    private static final Logger log = LoggerFactory.getLogger(ChatbotService.class);

    private final ProductRepository productRepo;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${farmaya.gemini-api-key:${GEMINI_API_KEY:${GOOGLE_API_KEY:}}}")
    private String geminiApiKey;

    // Fármacos que requieren receta médica obligatoria (Rx) y sustancias controladas
    private static final Set<String> RX_KEYWORDS = new HashSet<>(Arrays.asList(
        "amoxicilina", "azitromicina", "ciprofloxacino", "cefalexina", "ampicilina",
        "claritromicina", "doxiciclina", "penicilina", "levofloxacino", "metronidazol",
        "clindamicina", "trimetoprim", "sulfametoxazol", "gentamicina", "ceftriaxona",
        "cefotaxima", "oxacilina", "vancomicina", "eritromicina", "antibiotico", "antibioticos",
        "tramadol", "clonazepam", "alprazolam", "lorazepam", "diazepam", "zolpidem",
        "midazolam", "rivotril", "xanax", "valium", "morfina", "oxicodona", "fentanilo",
        "codeina", "metadona", "hidrocodona", "tapentadol", "buprenorfina", "antidepresivo",
        "psicotropico", "controlado", "estupefaciente", "sedante", "somnifero", "prednisona",
        "prednisolona", "dexametasona", "betametasona", "hidrocortisona", "metformina",
        "losartan", "enalapril", "amlodipino", "valsartan", "metoprolol", "hidroclorotiazida",
        "atorvastatina", "rosuvastatina", "insulina", "warfarina", "clopidogrel", "sildenafil",
        "tadalafil", "isotretinoina", "pregabalina", "gabapentina"
    ));

    private static final String MEDICAL_DISCLAIMER =
        "\n\nImportante: Esta recomendación es estrictamente orientativa y educativa. " +
        "No sustituye la valoración médica ni la prescripción de tu doctor de confianza. " +
        "Si los síntomas persisten por más de 48 horas, se intensifican o presentas signos de alarma, consulta a tu médico.";

    public ChatbotService(ProductRepository productRepo) {
        this.productRepo = productRepo;
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    public ChatResponse processUserQuery(ChatRequest req) {
        String query = req != null && req.message() != null ? req.message().trim() : "";
        if (query.isEmpty()) {
            return new ChatResponse(
                "Hola, soy FarmaBot, tu asistente farmacéutico operativo en FarmaYA. ¿Qué malestares o síntomas tienes hoy con los que te pueda colaborar?",
                Collections.emptyList(),
                "GENERAL",
                false
            );
        }

        String normalized = normalize(query);

        // 1. Verificación de Medicamentos con Receta Obligatoria (Rx)
        String matchedRx = findMatchedRx(normalized);
        if (matchedRx != null) {
            return buildRxRefusalResponse(matchedRx);
        }

        // 2. Si cuenta con Gemini API Key configurada, consultar a Gemini
        if (geminiApiKey != null && !geminiApiKey.trim().isEmpty()) {
            try {
                ChatResponse geminiResp = callGemini(query, req.history(), normalized);
                if (geminiResp != null) {
                    return geminiResp;
                }
            } catch (Exception ex) {
                log.warn("Fallo al consultar Gemini API, activando motor clínico autónomo: {}", ex.getMessage());
            }
        }

        // 3. Motor Inteligente de Soporte, Operaciones y Orientación Clínica FarmaYA
        return runIntelligentEngine(query, normalized);
    }

    private String findMatchedRx(String text) {
        for (String rx : RX_KEYWORDS) {
            if (text.contains(rx)) {
                return rx;
            }
        }
        try {
            List<Product> rxProducts = productRepo.findAll().stream()
                .filter(p -> p.rx)
                .collect(Collectors.toList());
            for (Product p : rxProducts) {
                if (p.name != null && text.contains(normalize(p.name))) {
                    return p.name;
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private ChatResponse buildRxRefusalResponse(String substance) {
        String capitalized = Character.toUpperCase(substance.charAt(0)) + substance.substring(1);
        String reply = "Aviso Sanitario y de Seguridad Clínica:\n\n" +
            "El medicamento o sustancia que mencionas (" + capitalized + ") requiere fórmula médica obligatoria expedida por un profesional de la salud facultado, en cumplimiento del Decreto 780 de 2016 y las directrices sanitarias del INVIMA y el Ministerio de Salud de Colombia.\n\n" +
            "¿Por qué no es posible recomendarlo ni despacharlo sin prescripción?\n" +
            "1. Seguridad del Paciente: Los antibióticos, corticoides y fármacos bajo control médico conllevan riesgos graves si se utilizan sin evaluación profesional, tales como resistencia bacteriana, toxicidad hepática o renal, interacciones medicamentosas y dependencia.\n" +
            "2. Diagnóstico Oportuno: Automedicarse puede enmascarar síntomas de infecciones o enfermedades subyacentes que requieren análisis clínico o exámenes de laboratorio.\n" +
            "3. Política Ética FarmaYA: Nuestra plataforma opera exclusivamente bajo principios de farmacovigilancia y dispensación segura de medicamentos de venta libre (OTC).\n\n" +
            "Recomendación: Te aconsejamos acudir a tu centro de salud o consultar con tu médico tratante para recibir un diagnóstico formal y la fórmula médica correspondiente.";

        return new ChatResponse(reply, Collections.emptyList(), "RX_REFUSAL", true);
    }

    private ChatResponse runIntelligentEngine(String originalQuery, String text) {
        List<Product> allProducts = Collections.emptyList();
        try {
            allProducts = productRepo.findAll();
        } catch (Exception e) {
            log.error("Error al obtener catálogo de productos: {}", e.getMessage());
        }

        // 1. SALUDOS Y CORTESÍAS
        if (text.matches("^(hola|buenos dias|buenas tardes|buenas noches|que tal|saludos).*")) {
            return new ChatResponse(
                "Hola, un gusto saludarte. Soy FarmaBot, tu asistente farmacéutico y operativo en FarmaYA.\n\n" +
                "¿En qué te puedo colaborar hoy? Puedes preguntarme sobre:\n" +
                "• Síntomas leves (dolor de cabeza, fiebre, acidez, gripe, cólicos)\n" +
                "• Opciones de medicamentos de venta libre (OTC)\n" +
                "• Soporte y atención al cliente (teléfono, WhatsApp, pedidos)\n" +
                "• Cómo funciona el pago por Wompi, el código PIN y las entregas",
                Collections.emptyList(),
                "GREETING",
                false
            );
        }

        if (text.contains("gracias") || text.contains("muchas gracias") || text.contains("agradezco")) {
            return new ChatResponse(
                "Con todo el gusto. En FarmaYA estamos comprometidos con tu bienestar y seguridad.\n\n" +
                "Si necesitas consultar sobre algún otro medicamento, síntoma o pedido, aquí estaré disponible para colaborarte.",
                Collections.emptyList(),
                "COURTESY",
                false
            );
        }

        if (text.matches("^(chao|adios|hasta luego|hasta pronto|nos vemos).*")) {
            return new ChatResponse(
                "Que tengas un excelente día y mucha salud. Recuerda que en FarmaYA estamos para apoyarte cuando lo requieras.",
                Collections.emptyList(),
                "COURTESY",
                false
            );
        }

        // 2. NÚMERO DE SOPORTE, CONTACTO Y ATENCIÓN AL CLIENTE
        if (text.contains("soporte") || text.contains("telefono") || text.contains("numero") ||
            text.contains("celular") || text.contains("contacto") || text.contains("whatsapp") ||
            text.contains("linea") || text.contains("atencion al cliente") || text.contains("asesor") ||
            text.contains("humano") || text.contains("comunicarme") || text.contains("hablar con alguien")) {
            return new ChatResponse(
                "Líneas de Atención y Soporte FarmaYA:\n\n" +
                "Estamos atentos para resolver cualquier novedad con tus pedidos, pagos o el uso de la aplicación:\n\n" +
                "• Teléfono y WhatsApp de Soporte: +57 (300) 912-3456\n" +
                "• Correo Electrónico Oficial: soporte@farmaya.com (y farmaya031@gmail.com)\n" +
                "• Horario de Atención al Cliente: Lunes a Domingo de 7:00 a.m. a 10:00 p.m.\n" +
                "• Menú de Ayuda en la App: Haz clic en el menú principal (3 líneas arriba a la derecha) y selecciona 'Centro de Ayuda / Soporte'.\n\n" +
                "Si tienes un pedido activo en curso, puedes consultar su estado en tiempo real en la pestaña 'Mis Pedidos' o llamar directamente al repartidor o farmacia asignada.",
                Collections.emptyList(),
                "SUPPORT",
                false
            );
        }

        // 3. CANCELACIÓN, REEMBOLSOS E INCIDENCIAS
        if (text.contains("cancelar") || text.contains("anular") || text.contains("devolucion") ||
            text.contains("reembolso") || text.contains("reclamo") || text.contains("queja") ||
            text.contains("equivocado") || text.contains("no llego") || text.contains("problema con pedido")) {
            return new ChatResponse(
                "Gestión de Pedidos, Cancelaciones y Reclamaciones en FarmaYA:\n\n" +
                "• Cancelar antes de despacho: Si la farmacia aún no ha preparado tu pedido, puedes cancelarlo directamente ingresando a 'Mis Pedidos'.\n" +
                "• Reembolsos en línea Wompi: Si cancelas un pedido ya pagado con tarjeta, PSE o Nequi antes del despacho, la devolución se tramita automáticamente por la pasarela Wompi en 24 a 48 horas hábiles.\n" +
                "• Novedad con tus medicamentos: Si el paquete recibido presenta alteraciones o no corresponde a lo solicitado, NO suministres el PIN de seguridad al domiciliario y comunícate de inmediato al +57 (300) 912-3456 con foto del producto para gestionar el reenvío prioritario.",
                Collections.emptyList(),
                "SUPPORT",
                false
            );
        }

        // 4. REGISTRO DE REPARTIDORES Y CÓMO TRABAJAR
        if (text.contains("repartidor") || text.contains("domiciliario") || text.contains("trabajar") ||
            text.contains("ganar dinero") || text.contains("ser repartidor") || text.contains("afiliar moto")) {
            return new ChatResponse(
                "Cómo vincularte como Repartidor Aliado a FarmaYA:\n\n" +
                "1. Dirígete a 'Crear cuenta' en la parte superior derecha de FarmaYA.\n" +
                "2. Selecciona el rol 'Repartidor' y registra tus datos de contacto.\n" +
                "3. En el paso 2, indica tu medio de transporte (Moto o Carro) y adjunta en formato PDF: Cédula, Licencia de conducción, SOAT vigente, Tecnomecánica y Licencia de tránsito.\n" +
                "4. El equipo de administración revisará y validará tus documentos en menos de 24 horas.\n" +
                "5. Una vez habilitado, recibirás solicitudes de entrega en tu cuadrante y obtendrás $5.000 COP netos por cada entrega exitosa validada con PIN.",
                Collections.emptyList(),
                "PARTNER_INFO",
                false
            );
        }

        // 5. REGISTRO DE DROGUERÍAS Y FARMACIAS
        if (text.contains("registrar farmacia") || text.contains("unir mi farmacia") || text.contains("drogueria aliada") ||
            text.contains("afiliar drogueria") || text.contains("vender medicamentos")) {
            return new ChatResponse(
                "Cómo registrar tu Droguería o Farmacia en la Red FarmaYA:\n\n" +
                "1. Haz clic en 'Crear cuenta' y selecciona el rol 'Farmacia'.\n" +
                "2. Registra el nombre comercial, ubica tu establecimiento en el mapa interactivo y fija tu horario de atención.\n" +
                "3. Adjunta en formato PDF tu Registro Sanitario INVIMA y el RUT / Cámara de Comercio vigente.\n" +
                "4. Registra los datos de la cuenta bancaria donde deseas recibir las transferencias de las ventas de tus despachos.\n" +
                "5. Al ser verificada por la administración, tu farmacia aparecerá visible para los clientes cercanos y recibirás pedidos directamente.",
                Collections.emptyList(),
                "PARTNER_INFO",
                false
            );
        }

        // 6. HORARIOS DE ATENCIÓN Y 24 HORAS
        if (text.contains("horario") || text.contains("abierto") || text.contains("abren") ||
            text.contains("cierran") || text.contains("24 horas") || text.contains("nocturno") ||
            text.contains("de noche")) {
            return new ChatResponse(
                "Horarios de FarmaYA:\n\n" +
                "• Plataforma Web y Pedidos: Operamos las 24 horas del día, los 7 días de la semana.\n" +
                "• Disponibilidad Nocturna: La atención en horarios de madrugada o festivos depende de las farmacias aliadas de turno disponibles en tu sector geográfico.\n" +
                "• Distintivo en Catálogo: Cada farmacia muestra el indicador verde 'Recibiendo despachos' o gris 'Fuera de turno' según su horario comercial activo.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        // 7. COBERTURA GEOGRÁFICA Y CIUDADES
        if (text.contains("cobertura") || text.contains("ciudades") || text.contains("donde operan") ||
            text.contains("barranquilla") || text.contains("bogota") || text.contains("medellin") ||
            text.contains("cali") || text.contains("ubicacion") || text.contains("sede")) {
            return new ChatResponse(
                "Cobertura Geográfica FarmaYA:\n\n" +
                "• Cobertura activa: Barranquilla, Soledad, Puerto Colombia y municipios del área metropolitana.\n" +
                "• En expansión: Habilitando droguerías aliadas en Bogotá, Medellín, Cali, Bucaramanga y Cartagena.\n" +
                "• Verificación de cobertura: Al fijar tu ubicación en el mapa interactivo de entrega, el sistema conecta automáticamente con las farmacias aliadas en un radio de hasta 8 km.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        // 8. FUNCIONAMIENTO DE PEDIDOS, PAGOS Y DOMICILIOS
        if (text.contains("como funciona") || text.contains("como pedir") || text.contains("hacer un pedido") || text.contains("comprar")) {
            return new ChatResponse(
                "Pedir en FarmaYA es muy sencillo y transparente:\n\n" +
                "1. Explora el catálogo de medicamentos y productos de bienestar, y agrégalos a tu canasta.\n" +
                "2. En la pantalla de entrega, fija tu ubicación en el mapa interactivo.\n" +
                "3. Las farmacias aliadas más cercanas recibirán tu solicitud y confirmarán los precios oficiales.\n" +
                "4. Podrás pagar los productos en línea con total seguridad a través de Wompi (Tarjetas, PSE, Nequi o Bancolombia).\n" +
                "5. Un domiciliario asignado llevará el pedido a tu puerta. La tarifa de domicilio ($5.000 COP) se cancela directamente al domiciliario al recibir tu entrega.\n" +
                "6. Para tu seguridad, recibirás un código PIN de 4 dígitos que deberás indicarle al repartidor para validar la entrega.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        if (text.contains("pago") || text.contains("wompi") || text.contains("nequi") || text.contains("pse") || text.contains("tarjeta")) {
            return new ChatResponse(
                "Pagos Seguros en FarmaYA:\n\n" +
                "• Productos de la Farmacia: Se cancelan en línea mediante la pasarela bancaria oficial Wompi (tarjetas de crédito/débito, PSE, Nequi o botón Bancolombia) una vez la farmacia confirma el valor de la orden.\n" +
                "• Tarifa de Domicilio: Es una tarifa fija de $5.000 COP y se cancela en efectivo o transferencia directa al domiciliario al momento de recibir el paquete.\n" +
                "• Facturación Oficial: Cada farmacia aliada genera su factura autorizada por la DIAN con los medicamentos suministrados.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        if (text.contains("domicilio") || text.contains("envio") || text.contains("cuanto cuesta") || text.contains("tarifa")) {
            return new ChatResponse(
                "Tarifas y Tiempos de Entrega FarmaYA:\n\n" +
                "• Valor del Domicilio: $5.000 COP tarifa base urbana por entrega, pagados directamente al repartidor.\n" +
                "• Tiempo Estimado: Entre 25 y 45 minutos según la distancia a la droguería asignada y el tráfico de la zona.\n" +
                "• Validación de Seguridad: La entrega se finaliza únicamente cuando le proporcionas tu PIN de 4 dígitos al repartidor.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        if (text.contains("pin") || text.contains("codigo de entrega") || text.contains("seguridad")) {
            return new ChatResponse(
                "El Código PIN de Entrega FarmaYA:\n\n" +
                "Es un código secreto de 4 dígitos generado por el sistema y visible exclusivamente en tu pantalla de pedidos.\n\n" +
                "Cuando el repartidor llegue a tu dirección con los medicamentos debidamente empacados y sellados, facilítale este número. " +
                "El repartidor lo digitará en su aplicación para confirmar de manera inequívoca que la entrega llegó al destinatario correcto.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        // 9. CONSULTAS CLÍNICAS POR SÍNTOMAS HABITUALES (VENTA LIBRE OTC)
        List<SuggestedProductDto> suggestions = new ArrayList<>();
        StringBuilder reply = new StringBuilder();

        if (text.contains("condon") || text.contains("condones") || text.contains("preservativo") || text.contains("preservativos") || text.contains("retardante") || text.contains("durex") || text.contains("prudence") || text.contains("trojan")) {
            reply.append("Preservativos y Condones Certificados en FarmaYA:\n\n")
                 .append("• Sensibilidad natural: Condones Durex Sensitivo Delgado o Today Ultra Delgado (látex extra fino para mayor sensación).\n")
                 .append("• Estimulación y textura: Condones Today Triple Placer o Durex Máximo Placer (con estrías y relieves estimulantes).\n")
                 .append("• Control masculino: Condones Duo Retardante (con benzocaína al 4.5% para prolongar el clímax).\n")
                 .append("• Mayor confort: Trojan Magnum (tamaño grande extra ancho) o Prudence sabor fresa.\n\n")
                 .append("Consejo: Almacénalos en lugar fresco y seco, lejos del calor para garantizar su máxima protección de barrera.");

            findMatchingProducts(allProducts, Arrays.asList("durex sensitivo", "today triple", "duo retardante", "trojan magnum", "today ultra"), suggestions);

        } else if (text.contains("lubricante") || text.contains("lubricantes") || text.contains("gel intimo") || text.contains("resequedad vaginal") || text.contains("lubricacion") || text.contains("k y") || text.contains("ky jelly")) {
            reply.append("Geles y Lubricantes Íntimos en FarmaYA:\n\n")
                 .append("• Base acuosa clásica: Gel K-Y Jelly 100 g o Durex Original Clásico (no manchan, sin grasa y 100% compatibles con látex).\n")
                 .append("• Sensaciones sensoriales: Durex Play Fresa (dulce comestible), Today Warm (efecto calor) o Natural Silk (efecto frío).\n")
                 .append("• Cuidado femenino: Lubricante Vagisil con Ácido Hialurónico (alivio inmediato de la sequedad vaginal imitando la humedad natural).\n")
                 .append("• Estimulación intensa: Gel Estimulante Femenino Durex Intense (potencia la sensibilidad clitoriana).");

            findMatchingProducts(allProducts, Arrays.asList("durex play", "k y jelly", "today warm", "durex intense", "vagisil"), suggestions);

        } else if (text.contains("rendimiento") || text.contains("cama") || text.contains("vigor") || text.contains("potencia") || text.contains("potenciador") || text.contains("macho") || text.contains("maca") || text.contains("arginina") || text.contains("ereccion") || text.contains("sexual") || text.contains("tribulus")) {
            reply.append("Suplementos y Vigorizantes Naturales para Rendimiento y Vitalidad:\n\n")
                 .append("En FarmaYA disponemos de opciones fitoterapéuticas y nutricionales de venta libre autorizadas por el INVIMA para favorecer la energía física y el desempeño íntimo:\n\n")
                 .append("• Vigorizantes naturales: Mero Macho Jarabe 500 ml (con Borojó, Chontaduro y Ginseng) y Maca Negra Andina Forte 500 mg.\n")
                 .append("• Circulación y resistencia: L-Arginina 1000 mg + Zinc (aminoácido precursor de óxido nítrico para favorecer la vasodilatación y el vigor) y Ginseng Rojo Coreano Forte.\n")
                 .append("• Energía física rápida: Vigor Total con Guaraná y Taurina o Tribulus Terrestris 750 mg.\n\n")
                 .append("Nota sanitaria: Medicamentos farmacológicos sintéticos (como Sildenafil o Tadalafil) requieren fórmula médica oficial previa debido a su impacto sobre la presión arterial.");

            findMatchingProducts(allProducts, Arrays.asList("mero macho", "maca negra", "l arginina", "ginseng rojo", "vigor total"), suggestions);

        } else if (text.contains("embarazo") || text.contains("clearblue") || text.contains("gravitest")) {
            reply.append("Pruebas de Embarazo en FarmaYA:\n\n")
                 .append("• Clearblue Digital: Dispositivo de alta precisión (>99%) con pantalla digital que indica si estás embarazada y de cuántas semanas (1-2, 2-3, 3+ semanas).\n")
                 .append("• Cassette Gravitest: Prueba rápida en orina con resultado confiable en 3 a 5 minutos.\n\n")
                 .append("Recomendación de uso: Realizar preferiblemente con la primera orina de la mañana a partir del primer día de retraso menstrual.");

            findMatchingProducts(allProducts, Arrays.asList("clearblue", "gravitest"), suggestions);

        } else if (text.contains("cabeza") || text.contains("migrana") || text.contains("cefalea")) {
            reply.append("Para el alivio de dolor de cabeza leve a moderado o migraña:\n\n")
                 .append("• Acetaminofén / Dolex Avanzado (500 mg): Primera línea de elección por su alto perfil de seguridad gastrointestinal.\n")
                 .append("• Ibuprofeno 400 mg o Apronax 550 mg: Si el dolor se asocia a tensión muscular o inflamación (tomar siempre con alimentos).\n\n")
                 .append("Recomendaciones: Hidrátate adecuadamente, reposa en un lugar silencioso con poca luz y evita periodos prolongados frente a pantallas.");

            findMatchingProducts(allProducts, Arrays.asList("dolex", "paracetamol", "ibuprofeno 400", "apronax"), suggestions);

        } else if (text.contains("fiebre") || text.contains("temperatura alta")) {
            reply.append("Para el manejo de la fiebre en adultos o niños:\n\n")
                 .append("• Acetaminofén (Paracetamol / Dolex): Antipirético de primera elección para regular la temperatura corporal.\n")
                 .append("• Ibuprofeno 400 mg o Buprex Pediátrico: Alternativa con efecto antiinflamatorio y antipirético.\n")
                 .append("• Termómetro Digital Infrarrojo: Recomendado para medir la evolución térmica con precisión sin contacto.\n\n")
                 .append("Medidas complementarias: Mantén ropa ligera, paños de agua tibia y abundante hidratación.");

            findMatchingProducts(allProducts, Arrays.asList("termometro", "dolex", "paracetamol", "buprex"), suggestions);

        } else if (text.contains("gripe") || text.contains("resfriado") || text.contains("congestion") || text.contains("mocos") || text.contains("tos")) {
            reply.append("Para síntomas de gripe, resfriado común o congestión nasal:\n\n")
                 .append("• Nokout Noche Antigripal: Analgésico, descongestionante y antihistamínico para descansar en la noche.\n")
                 .append("• Dristan Nebulizador Nasal: Alivio de la congestión nasal en minutos (no usar más de 3 a 5 días continuos).\n")
                 .append("• Vick Vaporub: Bálsamo descongestionante con eucalipto y mentol.\n")
                 .append("• Vitamina C 1000 mg + Zinc: Soporte antioxidante e inmunológico.");

            findMatchingProducts(allProducts, Arrays.asList("nokout", "dristan", "vick", "vitamina c"), suggestions);

        } else if (text.contains("garganta") || text.contains("irritacion") || text.contains("ardor de garganta")) {
            reply.append("Para el dolor o irritación bucofaríngea:\n\n")
                 .append("• Noraver Spray Bucofaríngeo: Anestésico y antiséptico local para calmar el dolor al deglutir.\n")
                 .append("• Isodine Solución Bucofaríngea: Enjuague antiséptico para desinfectar la cavidad bucal.\n")
                 .append("• Dolex o Ibuprofeno: Para modular el dolor y la inflamación de forma sistémica.");

            findMatchingProducts(allProducts, Arrays.asList("noraver", "isodine", "dolex", "ibuprofeno"), suggestions);

        } else if (text.contains("estomago") || text.contains("acidez") || text.contains("reflujo") || text.contains("ardor") || text.contains("gastritis") || text.contains("pesadez") || text.contains("indigestion")) {
            reply.append("Para el reflujo gástrico, acidez estomacal o pesadez:\n\n")
                 .append("• Gaviscon Doble Acción: Barrera de alginato que previene el reflujo y neutraliza el ácido.\n")
                 .append("• Pepto-Bismol Suspensión: Alivia ardor, indigestión, náuseas y malestar estomacal.\n")
                 .append("• Sal de Frutas Lúa Plus: Alivio efervescente contra la llenura y agruras.\n")
                 .append("• Omeprazol 20 mg: Protector gástrico para episodios de gastritis (tomar en ayunas).");

            findMatchingProducts(allProducts, Arrays.asList("gaviscon", "pepto", "lua", "omeprazol"), suggestions);

        } else if (text.contains("muscular") || text.contains("espalda") || text.contains("cuello") || text.contains("articulacion") || text.contains("lumbago") || text.contains("golpe") || text.contains("esguince")) {
            reply.append("Para dolor muscular, golpes o tensión articular:\n\n")
                 .append("• Apronax 550 mg (Naproxeno): Potente antiinflamatorio y analgésico de larga duración (hasta 12 horas).\n")
                 .append("• Ibuprofeno 800 mg / 400 mg: Indicado para inflamaciones musculares agudas.\n")
                 .append("• Caladryl o Vick: Para aplicaciones calmantes según la molestia.\n\n")
                 .append("Consejo: Aplica frío local las primeras 24 horas y reposa la zona afectada.");

            findMatchingProducts(allProducts, Arrays.asList("apronax", "ibuprofeno 800", "ibuprofeno 400"), suggestions);

        } else if (text.contains("colico") || text.contains("menstrual") || text.contains("espasmo") || text.contains("periodo")) {
            reply.append("Para el alivio de cólicos menstruales y espasmos abdominales:\n\n")
                 .append("• Buscapina Fem: Combina Butilbromuro de Hioscina (antiespasmódico) con Ibuprofeno 400 mg para aliviar los cólicos intensos.\n")
                 .append("• Apronax 550 mg: Alternativa analgésica de acción prolongada.\n\n")
                 .append("Medidas de alivio: Colocar una bolsa de agua tibia en el bajo abdomen e hidratarse.");

            findMatchingProducts(allProducts, Arrays.asList("buscapina", "apronax", "ibuprofeno 400"), suggestions);

        } else if (text.contains("alergia") || text.contains("rinitis") || text.contains("estornudos") || text.contains("picazon")) {
            reply.append("Para síntomas de rinitis alérgica o picazón leve:\n\n")
                 .append("• Loratadina 10 mg: Antihistamínico no sedante para estornudos y congestión alérgica.\n")
                 .append("• Caladryl Loción: Alivia la picazón de la piel por contacto o picaduras de insectos.");

            findMatchingProducts(allProducts, Arrays.asList("loratadina", "caladryl"), suggestions);

        } else if (text.contains("suero") || text.contains("hidratacion") || text.contains("deshidratacion") || text.contains("diarrea")) {
            reply.append("Para rehidratación oral y reposición de electrolitos:\n\n")
                 .append("• Suero Oral Electrolit Fresa (625 ml): Solución equilibrada de electrolitos, iones y glucosa para rehidratar el organismo.\n")
                 .append("• Pepto-Bismol: Coadyuvante en el control sintomático de diarrea leve del viajero.");

            findMatchingProducts(allProducts, Arrays.asList("electrolit", "pepto"), suggestions);

        } else if (text.contains("piel") || text.contains("solar") || text.contains("bloqueador") || text.contains("crema") || text.contains("resequedad") || text.contains("quemadura")) {
            reply.append("Para el cuidado dermatológico y protección de la piel:\n\n")
                 .append("• Protector Solar FPS 50+ Facial ISDIN: Fotoprotección ultraligera de fase acuosa para uso diario.\n")
                 .append("• Crema Hidratante Ceramide CeraVe: Restauración de la barrera cutánea con 3 ceramidas esenciales.\n")
                 .append("• Lubriderm Reparación Intensiva: Hidratación para piel severamente seca.\n")
                 .append("• Cicatricure Gel: Mejora la textura y elasticidad de la piel en cicatrices.");

            findMatchingProducts(allProducts, Arrays.asList("protector solar", "ceramide", "lubriderm", "cicatricure"), suggestions);

        } else if (text.contains("herida") || text.contains("raspon") || text.contains("cortada") || text.contains("botiquin") || text.contains("alcohol") || text.contains("curitas")) {
            reply.append("Para primeros auxilios y curación de heridas menores:\n\n")
                 .append("• Agua Oxigenada 10 Vol o Alcohol al 70%: Para desinfección adecuada de la piel.\n")
                 .append("• Curitas Venditas Antibacteriales: Con compresa de plata para cicatrización higiénica.\n")
                 .append("• Gel Antibacterial con Aloe: Para desinfección constante de manos sin enjuague.");

            findMatchingProducts(allProducts, Arrays.asList("curitas", "agua oxigenada", "alcohol", "gel antibacterial"), suggestions);

        } else if (text.contains("bebe") || text.contains("nino") || text.contains("panal") || text.contains("biberon")) {
            reply.append("Para el cuidado y bienestar de bebés en FarmaYA:\n\n")
                 .append("• Crema Antipañalitis Desitin Rapid: Con óxido de zinc al 13% para aliviar y prevenir la dermatitis del pañal.\n")
                 .append("• Pañales Winny Sensitive Etapa 3 y Toallitas húmedas con Aloe.\n")
                 .append("• Biberón Anticólicos Philips Avent de 260 ml.\n")
                 .append("• Buprex Pediátrico o Acetaminofén Gotas Pediátricas: Para fiebre e inflamación en niños.");

            findMatchingProducts(allProducts, Arrays.asList("desitin", "winny", "biberon", "buprex", "gotas pediatricas"), suggestions);

        } else {
            // Búsqueda inteligente por nombre exacto o indicación en el catálogo
            List<Product> matched = allProducts.stream()
                .filter(p -> (p.name != null && normalize(p.name).contains(text)) ||
                             (p.active != null && normalize(p.active).contains(text)) ||
                             (p.indication != null && normalize(p.indication).contains(text)))
                .limit(4)
                .collect(Collectors.toList());

            if (!matched.isEmpty()) {
                reply.append("He ubicado estos productos relacionados con tu consulta en el catálogo de FarmaYA:\n\n");
                for (Product p : matched) {
                    reply.append("• ").append(p.name).append(": ").append(p.indication != null ? p.indication : "Medicamento de venta libre.").append("\n");
                    suggestions.add(new SuggestedProductDto(p.id, p.name, p.cat, p.price, p.active, p.indication, p.rx, p.presentation));
                }
                reply.append("\nPuedes agregarlos directamente a tu canasta para coordinar el despacho.");
            } else {
                // RESPUESTA INTELIGENTE CONTEXTUAL (no genérica)
                reply.append("He revisado tu consulta sobre \"").append(originalQuery).append("\". Para orientarte de manera precisa:\n\n")
                     .append("• Si se trata de un síntoma o malestar: Descríbeme qué molestia experimentas (ej. dolor de cabeza, dolor muscular, fiebre, acidez, gripe o cólicos) para indicarte opciones seguras de venta libre.\n")
                     .append("• Si necesitas soporte con un pedido: Puedes consultar sobre el pago por Wompi, el costo del domicilio ($5.000 COP), el código PIN de entrega o comunicarte con nuestra línea directa de soporte al +57 (300) 912-3456.\n")
                     .append("• Si buscas un producto en particular: Escribe el nombre o principio activo y verificaré su disponibilidad en farmacias aliadas.");
            }
        }

        // Descargo médico ético
        reply.append(MEDICAL_DISCLAIMER);

        return new ChatResponse(reply.toString(), suggestions, "OTC_RECOMMENDATION", false);
    }

    private void findMatchingProducts(List<Product> all, List<String> terms, List<SuggestedProductDto> out) {
        for (String term : terms) {
            String normTerm = normalize(term);
            for (Product p : all) {
                if (out.stream().noneMatch(s -> s.id().equals(p.id))) {
                    String pName = normalize(p.name != null ? p.name : "");
                    String pActive = normalize(p.active != null ? p.active : "");
                    if (pName.contains(normTerm) || pActive.contains(normTerm)) {
                        out.add(new SuggestedProductDto(p.id, p.name, p.cat, p.price, p.active, p.indication, p.rx, p.presentation));
                        if (out.size() >= 4) return;
                    }
                }
            }
        }
    }

    private ChatResponse callGemini(String originalQuery, List<ChatMessage> history, String normalizedQuery) {
        try {
            String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey.trim();

            String systemPrompt = "Eres FarmaBot, el Asistente Farmacéutico Virtual y Orientador Clínico y Operativo de FarmaYA en Colombia.\n" +
                "REGLAS FUNDAMENTALES:\n" +
                "1. PREGUNTAS DE SOPORTE Y OPERATIVAS: Si el usuario pregunta por número de soporte, ayuda, cancelaciones, teléfonos o contacto, responde de forma clara y directa con los datos oficiales: Teléfono/WhatsApp de soporte +57 300 912-3456, correo soporte@farmaya.com, horario 7am a 10pm.\n" +
                "2. NO USAR RESPUESTAS GENÉRICAS: Nunca respondas con frases vacías como 'tenemos una amplia gama de medicamentos'. Responde de forma precisa y contextual a lo que pregunta el usuario.\n" +
                "3. MEDICAMENTOS CON RECETA (Rx): Si piden antibióticos, controlados, opioides o antidepresivos, rechaza cortésmente explicando que por Decreto 780/2016 y normatividad INVIMA requieren fórmula médica y que automedicarse conlleva graves riesgos como resistencia bacteriana o toxicidad.\n" +
                "4. SÍNTOMAS Y OTC: Orienta sobre medicamentos de venta libre (Acetaminofén, Ibuprofeno, Gaviscon, Loratadina, Suero Oral) y SIEMPRE incluye el descargo médico de consultar con su doctor de confianza.\n" +
                "5. FORMATO CONCISO Y LIMPIO: Redacta en párrafos breves o listas con viñetas. NO uses textos excesivamente anchos ni desbordes. CERO EMOJIS (estrictamente prohibido usar emojis).";

            StringBuilder userContent = new StringBuilder();
            userContent.append(systemPrompt).append("\n\n");
            if (history != null && !history.isEmpty()) {
                userContent.append("Historial previo de la conversación:\n");
                for (ChatMessage m : history) {
                    userContent.append(m.role()).append(": ").append(m.text()).append("\n");
                }
                userContent.append("\n");
            }
            userContent.append("Pregunta actual del usuario: ").append(originalQuery);

            String requestBody = objectMapper.writeValueAsString(Collections.singletonMap("contents",
                Collections.singletonList(Collections.singletonMap("parts",
                    Collections.singletonList(Collections.singletonMap("text", userContent.toString()))
                ))
            ));

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(12))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode candidates = root.path("candidates");
                if (candidates.isArray() && !candidates.isEmpty()) {
                    String reply = candidates.get(0).path("content").path("parts").get(0).path("text").asText();
                    if (reply != null && !reply.isBlank()) {
                        reply = reply.replaceAll("[\\p{So}\\p{Cn}]", "").trim();

                        List<SuggestedProductDto> suggestions = new ArrayList<>();
                        List<Product> all = productRepo.findAll();
                        String normReply = normalize(reply);
                        for (Product p : all) {
                            if (p.name != null && normReply.contains(normalize(p.name))) {
                                suggestions.add(new SuggestedProductDto(p.id, p.name, p.cat, p.price, p.active, p.indication, p.rx, p.presentation));
                                if (suggestions.size() >= 3) break;
                            }
                        }

                        boolean isRx = reply.toLowerCase(Locale.ROOT).contains("fórmula médica") || reply.toLowerCase(Locale.ROOT).contains("receta");
                        return new ChatResponse(reply, suggestions, isRx ? "RX_REFUSAL" : "AI_ADVICE", isRx);
                    }
                }
            } else {
                log.warn("Gemini API respondió código {}: {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.error("Excepción al comunicarse con Gemini API: {}", e.getMessage());
        }
        return null;
    }

    private static String normalize(String input) {
        if (input == null) return "";
        return input.toLowerCase(Locale.ROOT)
            .replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
            .replace('ñ', 'n').replaceAll("[^a-z0-9 ]", " ")
            .replaceAll("\\s+", " ").trim();
    }
}
