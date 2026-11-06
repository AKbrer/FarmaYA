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

    // Fármacos que requieren receta obligatoria (Rx) y sustancias controladas
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
        "No reemplaza la valoración, el diagnóstico ni la prescripción de tu médico tratante o profesional de la salud. " +
        "Si los síntomas persisten por más de 48 horas, se intensifican o presentas signos de alarma (como fiebre superior a 38.5°C o dificultad respiratoria), consulta de inmediato con tu médico de confianza.";

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

        // 3. Motor Clínico y Operativo Autónomo de FarmaYA (Garantía de alta disponibilidad)
        return runAutonomousClinicalEngine(query, normalized);
    }

    private String findMatchedRx(String text) {
        for (String rx : RX_KEYWORDS) {
            if (text.contains(rx)) {
                return rx;
            }
        }
        // Verificar también si consulta por un producto de la base de datos marcado como rx == true
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
            "El medicamento o sustancia que mencionas (" + capitalized + ") requiere fórmula médica obligatoria expedida por un profesional de la salud debidamente facultado, en estricto cumplimiento del Decreto 780 de 2016 y las directrices sanitarias del INVIMA y el Ministerio de Salud de Colombia.\n\n" +
            "¿Por qué no es posible recomendarlo ni despacharlo sin prescripción?\n" +
            "1. Seguridad del Paciente: Los antibióticos, corticoides y medicamentos de control especial conllevan riesgos graves si se utilizan sin supervisión médica, tales como resistencia bacteriana, toxicidad hepática o renal, interacciones medicamentosas severas y dependencia.\n" +
            "2. Diagnóstico Preciso: Automedicarse puede enmascarar síntomas de infecciones o afecciones subyacentes más complejas que requieren análisis clínico o exámenes de laboratorio.\n" +
            "3. Política Ética de FarmaYA: Nuestra plataforma opera exclusivamente bajo principios de farmacovigilancia y dispensación segura de medicamentos de venta libre (OTC).\n\n" +
            "Recomendación: Te invitamos cordialmente a agendar una cita con tu médico de confianza o acudir a tu centro de salud más cercano para que un profesional evalúe tu caso y te proporcione la formulación médica pertinente.";

        return new ChatResponse(reply, Collections.emptyList(), "RX_REFUSAL", true);
    }

    private ChatResponse runAutonomousClinicalEngine(String originalQuery, String text) {
        List<Product> allProducts = Collections.emptyList();
        try {
            allProducts = productRepo.findAll();
        } catch (Exception e) {
            log.error("Error al obtener catálogo de productos: {}", e.getMessage());
        }

        // Consultas sobre la plataforma FarmaYA
        if (text.contains("como funciona") || text.contains("como pedir") || text.contains("hacer un pedido") || text.contains("comprar")) {
            return new ChatResponse(
                "Pedir en FarmaYA es muy sencillo y transparente:\n\n" +
                "1. Explora el catálogo de medicamentos y productos de bienestar, y agrégalos a tu canasta.\n" +
                "2. En la pantalla de entrega, fija tu ubicación exacta en el mapa de tu ciudad.\n" +
                "3. Las farmacias aliadas más cercanas recibirán tu solicitud y confirmarán los precios oficiales.\n" +
                "4. Podrás pagar los productos en línea con seguridad a través de Wompi (Tarjetas, PSE, Nequi o Bancolombia).\n" +
                "5. Un domiciliario asignado llevará el pedido a tu puerta. El valor del domicilio ($5.000 COP) se cancela directamente al domiciliario al recibir tu entrega.\n" +
                "6. Para tu total seguridad, recibirás un código PIN de 4 dígitos que deberás indicarle al repartidor para finalizar la entrega.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        if (text.contains("pago") || text.contains("wompi") || text.contains("nequi") || text.contains("pse") || text.contains("tarjeta")) {
            return new ChatResponse(
                "En FarmaYA cuidamos tu tranquilidad con pagos 100% seguros:\n\n" +
                "- Productos de la farmacia: Se cancelan en línea mediante la pasarela certificada Wompi (Bancolombia, PSE, Nequi o tarjetas de crédito/débito) una vez que la farmacia confirma la disponibilidad de tu pedido.\n" +
                "- Tarifa de domicilio: Se abona en efectivo o transferencia directa al domiciliario al momento de recibir la orden ($5.000 COP tarifa base urbana).\n" +
                "- Facturación: Cada farmacia aliada emite su correspondiente factura oficial autorizada por la DIAN.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        if (text.contains("domicilio") || text.contains("envio") || text.contains("cuanto cuesta") || text.contains("tarifa")) {
            return new ChatResponse(
                "Información sobre domicilios en FarmaYA:\n\n" +
                "- Tarifa de entrega: Es una tarifa justa de $5.000 COP que va directamente al domiciliario para cubrir su desplazamiento.\n" +
                "- Tiempo estimado: Las entregas habituales tardan entre 25 y 45 minutos dependiendo de la distancia a la farmacia asignada.\n" +
                "- Cobertura: Conectamos farmacias aliadas en tu cuadrante urbano a través de geolocalización en mapa interactivo.\n" +
                "- Confirmación segura: La entrega se valida únicamente cuando entregas el PIN de seguridad de 4 dígitos al repartidor.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        if (text.contains("pin") || text.contains("codigo de entrega") || text.contains("seguridad")) {
            return new ChatResponse(
                "El PIN de entrega es una medida de seguridad exclusiva de FarmaYA:\n\n" +
                "Al confirmarse tu pedido, el sistema genera un código secreto de 4 dígitos visible en tu pantalla de pedidos. " +
                "Cuando el repartidor llegue a tu dirección con los medicamentos sellados, facilítale este número. " +
                "El repartidor lo digitará en su aplicación para validar formalmente que la entrega se realizó a la persona correcta.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        // Consultas por síntomas clínicos habituales (OTC)
        List<SuggestedProductDto> suggestions = new ArrayList<>();
        StringBuilder reply = new StringBuilder();

        if (text.contains("cabeza") || text.contains("migrana") || text.contains("cefalea") || text.contains("dolor general")) {
            reply.append("Para el dolor de cabeza leve a moderado o migraña ocasional, existen opciones analgésicas de venta libre seguras y de rápida acción:\n\n")
                 .append("- Acetaminofén / Dolex Avanzado (500 mg): Primera línea de elección por su alto perfil de seguridad gastrointestinal.\n")
                 .append("- Ibuprofeno 400 mg o Apronax (Naproxeno 550 mg): Antiinflamatorios indicados si el dolor se asocia a tensión muscular o inflamación (tomar siempre con alimentos).\n\n")
                 .append("Consejos adicionales: Mantén una adecuada hidratación, descansa en un espacio con luz tenue y evita saltarte comidas.");

            findMatchingProducts(allProducts, Arrays.asList("dolex", "paracetamol", "ibuprofeno 400", "apronax"), suggestions);

        } else if (text.contains("fiebre") || text.contains("temperatura alta")) {
            reply.append("Para el manejo de la fiebre en adultos y niños:\n\n")
                 .append("- Acetaminofén (Paracetamol / Dolex): Medicamento antipirético de primera elección. Ayuda a regular la temperatura corporal de forma progresiva.\n")
                 .append("- Ibuprofeno 400 mg o Buprex Pediátrico: Alternativa con efecto antiinflamatorio y antipirético.\n")
                 .append("- Medidas físicas: Aplicar compresas de agua templada (nunca fría ni con alcohol) y mantenerse constantemente hidratado.");

            findMatchingProducts(allProducts, Arrays.asList("termometro", "dolex", "paracetamol", "buprex", "ibuprofeno"), suggestions);

        } else if (text.contains("gripe") || text.contains("resfriado") || text.contains("congestion") || text.contains("mocos") || text.contains("tos")) {
            reply.append("Para el alivio sintomático del resfriado común y la congestión nasal:\n\n")
                 .append("- Nokout Noche Antigripal: Combina analgésico, descongestionante y antihistamínico para facilitar el descanso nocturno.\n")
                 .append("- Dristan Nebulizador Nasal: Descongestiona las vías respiratorias superiores en minutos (no usar por más de 3 a 5 días seguidos).\n")
                 .append("- Vick Vaporub: Bálsamo descongestionante con eucalipto y mentol para aplicar en pecho y cuello.\n")
                 .append("- Vitamina C 1000 mg: Apoyo antioxidante y refuerzo del sistema inmune.");

            findMatchingProducts(allProducts, Arrays.asList("nokout", "dristan", "vick", "vitamina c"), suggestions);

        } else if (text.contains("garganta") || text.contains("irritacion") || text.contains("ardor de garganta")) {
            reply.append("Para el dolor o irritación de garganta:\n\n")
                 .append("- Noraver Spray Bucofaríngeo: Anestésico y antiséptico local que alivia el dolor al deglutir de forma casi instantánea.\n")
                 .append("- Isodine Solución Bucofaríngea: Enjuague antiséptico para desinfectar la cavidad oral y faríngea.\n")
                 .append("- Dolex o Ibuprofeno: Para modular la inflamación y el dolor.");

            findMatchingProducts(allProducts, Arrays.asList("noraver", "isodine", "dolex", "ibuprofeno"), suggestions);

        } else if (text.contains("estomago") || text.contains("acidez") || text.contains("reflujo") || text.contains("ardor") || text.contains("gastritis") || text.contains("pesadez")) {
            reply.append("Para la acidez estomacal, el reflujo gástrico o la pesadez estomacal:\n\n")
                 .append("- Gaviscon Doble Acción: Forma una barrera protectora de alginato sobre el contenido gástrico, previniendo el reflujo y neutralizando el ácido.\n")
                 .append("- Pepto-Bismol Suspensión: Alivia ardor, indigestión, náuseas y pesadez estomacal.\n")
                 .append("- Sal de Frutas Lúa: Alivio efervescente rápido contra la sensación de llenura y agruras.\n")
                 .append("- Omeprazol 20 mg: Protector gástrico para episodios de gastritis (tomar en ayunas).");

            findMatchingProducts(allProducts, Arrays.asList("gaviscon", "pepto", "lua", "omeprazol"), suggestions);

        } else if (text.contains("alergia") || text.contains("rinitis") || text.contains("estornudos") || text.contains("picazon")) {
            reply.append("Para síntomas de rinitis alérgica, estornudos frecuentes o urticaria leve:\n\n")
                 .append("- Loratadina 10 mg: Antihistamínico de segunda generación que alivia los síntomas alérgicos sin producir somnolencia marcada en la mayoría de personas.\n")
                 .append("- Caladryl Loción: Si presentas picazón o sarpullido en la piel por contacto o picaduras.");

            findMatchingProducts(allProducts, Arrays.asList("loratadina", "caladryl"), suggestions);

        } else if (text.contains("suero") || text.contains("hidratacion") || text.contains("deshidratacion") || text.contains("diarrea")) {
            reply.append("Para la reposición hidroelectrolítica ante calor intenso, actividad física o episodios diarreicos:\n\n")
                 .append("- Suero Oral Electrolit Fresa (625 ml): Fórmula equilibrada de electrolitos, iones y glucosa para restaurar rápidamente el balance hídrico corporal.\n")
                 .append("- Pepto-Bismol: Coadyuvante en el control sintomático de diarrea leve del viajero.");

            findMatchingProducts(allProducts, Arrays.asList("electrolit", "pepto"), suggestions);

        } else if (text.contains("bebe") || text.contains("panal") || text.contains("panalitis")) {
            reply.append("Para el cuidado integral de tu bebé en FarmaYA:\n\n")
                 .append("- Crema Desitin Rapid: Con óxido de zinc para aliviar y prevenir la pañalitis formando una barrera protectora.\n")
                 .append("- Pañales Winny Sensitive Etapa 3 y Toallitas húmedas con Aloe para el aseo delicado.\n")
                 .append("- Biberón Anticólicos Philips Avent de 260 ml.");

            findMatchingProducts(allProducts, Arrays.asList("desitin", "winny", "biberon", "buprex"), suggestions);

        } else if (text.contains("herida") || text.contains("raspon") || text.contains("cortada") || text.contains("primeros auxilios")) {
            reply.append("Para la atención higiénica de heridas superficiales o raspones:\n\n")
                 .append("- Agua Oxigenada 10 Vol o Alcohol Antiséptico al 70%: Para desinfección adecuada de la zona peri-lesional.\n")
                 .append("- Curitas Venditas Antibacteriales: Con compresa de plata antiséptica para proteger de suciedad y favorecer la cicatrización.");

            findMatchingProducts(allProducts, Arrays.asList("curitas", "agua oxigenada", "alcohol", "cicatricure"), suggestions);

        } else {
            // Búsqueda por coincidencia de nombre o principio activo en el catálogo
            List<Product> matched = allProducts.stream()
                .filter(p -> (p.name != null && normalize(p.name).contains(text)) ||
                             (p.active != null && normalize(p.active).contains(text)) ||
                             (p.indication != null && normalize(p.indication).contains(text)))
                .limit(4)
                .collect(Collectors.toList());

            if (!matched.isEmpty()) {
                reply.append("He encontrado estos productos relacionados con tu consulta en el catálogo oficial de FarmaYA:\n\n");
                for (Product p : matched) {
                    reply.append("- ").append(p.name).append(": ").append(p.indication != null ? p.indication : "Medicamento de venta libre.").append("\n");
                    suggestions.add(new SuggestedProductDto(p.id, p.name, p.cat, p.price, p.active, p.indication, p.rx, p.presentation));
                }
            } else {
                reply.append("Comprendo tu inquietud. En FarmaYA disponemos de una amplia gama de medicamentos de venta libre (analgésicos, antigripales, antiácidos, antihistamínicos) y productos de cuidado personal.\n\n")
                     .append("¿Podrías especificar qué molestia o síntoma experimentas, o qué producto buscas?");
            }
        }

        // Agregar siempre el Descargo Médico Obligatorio
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

            String systemPrompt = "Eres FarmaBot, el Asistente Farmacéutico Virtual y Orientador Clínico oficial de FarmaYA en Colombia.\n" +
                "REGLAS OBLIGATORIAS:\n" +
                "1. DESCARGO MÉDICO: Siempre recuerda de manera clara y profesional que tus recomendaciones son orientativas y educativas, y que jamás sustituyen la consulta con su médico de confianza.\n" +
                "2. RECETA OBLIGATORIA (Rx): Si el usuario solicita antibióticos, fármacos controlados, psicotrópicos, opioides o medicamentos con receta, debes explicar con tono respetuoso y clínico que NO es posible recomendarlos ni dispensarlos sin fórmula médica expedida por un profesional facultado bajo la ley colombiana (INVIMA y Decreto 780/2016), explicando los peligros de resistencia bacteriana y efectos adversos.\n" +
                "3. MEDICAMENTOS DE VENTA LIBRE: Puedes orientar sobre medicamentos OTC (Acetaminofén, Ibuprofeno, Gaviscon, Loratadina, Suero Oral) recomendando consultar al médico si los síntomas persisten.\n" +
                "4. CONOCIMIENTO DE FARMAYA: Conoces que FarmaYA permite pedir a farmacias de barrio geolocalizadas en el mapa, los productos se pagan en línea seguro por Wompi, el domicilio cuesta $5.000 COP y se paga en efectivo al domiciliario, y la entrega se valida con un PIN de 4 dígitos.\n" +
                "5. TONO: Muy profesional, empático, claro, en español. CERO EMOJIS (estrictamente prohibido usar emojis en todo el texto).";

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
                        // Limpieza de emojis por si la IA generativa incluyó alguno
                        reply = reply.replaceAll("[\\p{So}\\p{Cn}]", "").trim();

                        // Buscar productos sugeridos en base a la respuesta
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
