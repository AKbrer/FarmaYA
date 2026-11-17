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
import java.util.*;
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

    @Value("${farmaya.gemini-model:${FARMAYA_GEMINI_MODEL:gemini-1.5-flash}}")
    private String geminiModel;

    // Fármacos que requieren receta médica obligatoria (Rx) y sustancias controladas
    private static final Set<String> RX_KEYWORDS = new HashSet<>(Arrays.asList(
        "amoxicilina", "azitromicina", "ciprofloxacino", "cefalexina", "ampicilina",
        "claritromicina", "doxiciclina", "penicilina", "levofloxacino", "metronidazol",
        "clindamicina", "trimetoprim", "sulfametoxazol", "gentamicina", "ceftriaxona",
        "cefotaxima", "oxacilina", "vancomicina", "eritromicina", "antibiotico", "antibioticos",
        "tramadol", "clonazepam", "alprazolam", "lorazepam", "diazepam", "zolpidem",
        "midazolam", "rivotril", "xanax", "valium", "morfina", "oxicodona", "fentanilo",
        "codeina", "metadona", "hidrocodona", "tapentadol", "buprenorfina", "antidepresivo",
        "antidepresivos", "psicotropico", "controlado", "estupefaciente", "sedante", "somnifero",
        "prednisona", "prednisolona", "dexametasona", "betametasona", "hidrocortisona",
        "metformina", "losartan", "enalapril", "amlodipino", "valsartan", "metoprolol",
        "hidroclorotiazida", "atorvastatina", "rosuvastatina", "insulina", "warfarina",
        "clopidogrel", "sildenafil", "tadalafil", "isotretinoina", "pregabalina", "gabapentina"
    ));

    private static final Set<String> STOP_WORDS = new HashSet<>(Arrays.asList(
        "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o", "en",
        "para", "por", "con", "sin", "sobre", "que", "como", "cuando", "donde", "quien",
        "cual", "cuales", "es", "son", "fue", "era", "ser", "estar", "tiene", "tienen",
        "hay", "puedo", "puede", "pueden", "tomar", "servir", "sirve", "sirven", "recomiendas",
        "recomiendan", "tienes", "quiero", "saber", "siento", "tengo", "favor", "ayuda",
        "hola", "buenos", "dias", "tardes", "noches", "saludos", "gracias", "algo", "algun",
        "alguna", "algunos", "algunas", "mucho", "mucha", "poco", "muy", "mas", "menos"
    ));

    private static final String MEDICAL_DISCLAIMER =
        "\n\nImportante: Esta orientación es exclusivamente educativa y referencial. " +
        "No sustituye el diagnóstico ni la prescripción de tu médico tratante. " +
        "Si los síntomas persisten por más de 48 horas, se intensifican o presentas signos de alarma, consulta a un profesional de la salud.";

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
                "Hola, soy FarmaBot, tu orientador farmacéutico y operativo en FarmaYA. ¿En qué tema de salud, medicamentos de venta libre o pedido puedo colaborarte hoy?",
                Collections.emptyList(),
                "GENERAL",
                false
            );
        }

        String normalized = normalize(query);

        // 1. Verificación estricta de medicamentos con receta obligatoria (Rx)
        String matchedRx = findMatchedRx(normalized);
        if (matchedRx != null) {
            return buildRxRefusalResponse(matchedRx);
        }

        // 2. Si cuenta con Gemini API Key configurada, consultar motor LLM
        if (geminiApiKey != null && !geminiApiKey.trim().isEmpty()) {
            try {
                ChatResponse geminiResp = callGemini(query, req != null ? req.history() : null, normalized);
                if (geminiResp != null) {
                    return geminiResp;
                }
            } catch (Exception ex) {
                log.warn("Fallo al consultar Gemini API, activando motor clínico autónomo: {}", ex.getMessage());
            }
        }

        // 3. Motor Clínico Autónomo y Comprensión Semántica Avanzada
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
        String reply = "Aviso Sanitario y de Seguridad Farmacológica:\n\n" +
            "El medicamento o principio activo que mencionas (" + capitalized + ") requiere fórmula médica obligatoria expedida por un profesional de la salud facultado, en cumplimiento del Decreto 780 de 2016 y las directrices sanitarias del INVIMA y el Ministerio de Salud de Colombia.\n\n" +
            "Razones de seguridad clínica:\n" +
            "• Prevención de resistencia bacteriana: El uso inadecuado de antibióticos crea cepas resistentes que inutilizan los tratamientos futuros.\n" +
            "• Seguridad metabólica: Fármacos regulados, corticoides y sedantes conllevan riesgos de toxicidad hepática, renal, cardiovascular y dependencia.\n" +
            "• Diagnóstico certero: Automedicarse enmascara síntomas de patologías subyacentes que demandan análisis clínico formal.\n\n" +
            "Orientación: Te sugerimos consultar con tu médico tratante o acudir a tu centro de salud para obtener una valoración adecuada y la prescripción requerida.";

        return new ChatResponse(reply, Collections.emptyList(), "RX_REFUSAL", true);
    }

    private ChatResponse runIntelligentEngine(String originalQuery, String text) {
        List<Product> allProducts = Collections.emptyList();
        try {
            allProducts = productRepo.findAll();
        } catch (Exception e) {
            log.error("Error al obtener catálogo de productos: {}", e.getMessage());
        }

        List<SuggestedProductDto> suggestions = new ArrayList<>();
        StringBuilder reply = new StringBuilder();

        // 1. SALUDOS Y CORTESÍAS
        if (text.matches("^(hola|buenos dias|buenas tardes|buenas noches|que tal|saludos).*")) {
            return new ChatResponse(
                "Hola, un gusto saludarte. Soy FarmaBot, tu asistente farmacéutico inteligente en FarmaYA.\n\n" +
                "Estoy capacitado para orientarte con información precisa en:\n" +
                "• Orientación clínica en medicamentos de venta libre (OTC)\n" +
                "• Interacciones de fármacos con alcohol, alimentos u otros productos\n" +
                "• Diferencias entre principios activos (ej. Acetaminofén vs Ibuprofeno)\n" +
                "• Pautas de dosificación responsable y signos de alarma de salud\n" +
                "• Soporte operativo: compras por Wompi, PIN de entrega y envíos prioritarios",
                Collections.emptyList(),
                "GREETING",
                false
            );
        }

        if (text.contains("gracias") || text.contains("muchas gracias") || text.contains("agradezco")) {
            return new ChatResponse(
                "Con todo gusto. En FarmaYA nuestra prioridad es tu bienestar y el uso seguro de los medicamentos.\n\n" +
                "Si tienes alguna otra duda sobre tus tratamientos, síntomas o pedidos, aquí estoy para orientarte.",
                Collections.emptyList(),
                "COURTESY",
                false
            );
        }

        // 2. INTERACCIONES CON ALCOHOL Y MEDICAMENTOS (Pregunta abierta muy común)
        if ((text.contains("alcohol") || text.contains("cerveza") || text.contains("trago") || text.contains("licor") || text.contains("vino")) &&
            (text.contains("tomar") || text.contains("mezclar") || text.contains("puedo") || text.contains("pastilla") || text.contains("medicamento") || text.contains("dolex") || text.contains("acetaminofen") || text.contains("ibuprofeno") || text.contains("paracetamol"))) {
            reply.append("Interacción Farmacológica: Medicamentos y Consumo de Alcohol\n\n")
                 .append("Por seguridad clínica general, NO se recomienda consumir bebidas alcohólicas mientras tomas medicamentos analgésicos o antiinflamatorios:\n\n")
                 .append("• Con Acetaminofén / Paracetamol: Tanto el alcohol como el paracetamol se metabolizan en el hígado por la vía del citocromo P450 (CYP2E1). Su consumo simultáneo eleva la producción de un metabolito tóxico (NAPQI) que puede causar daño hepático agudo (hepatotoxicidad), incluso en dosis habituales.\n\n")
                 .append("• Con Ibuprofeno, Naproxeno o Aspirina (AINEs): El alcohol y los antiinflamatorios irritan directamente la mucosa gástrica. Combinarlos multiplica el riesgo de gastritis aguda, úlceras pépticas y hemorragias digestivas.\n\n")
                 .append("Recomendación: Si has consumido alcohol, hidrátate abundantemente con agua o suero oral, reposa y espera al menos 12 a 24 horas antes de reiniciar analgésicos.");

            findMatchingProducts(allProducts, Arrays.asList("electrolit", "suero"), suggestions);
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "DRUG_INTERACTION", false);
        }

        // 3. COMPARATIVAS CLÍNICAS (ej. Acetaminofén vs Ibuprofeno)
        if ((text.contains("diferencia") || text.contains("cual es mejor") || text.contains("comparar") || text.contains("vs") || text.contains("o ibuprofeno") || text.contains("o acetaminofen") || text.contains("o paracetamol")) &&
            (text.contains("ibuprofeno") || text.contains("paracetamol") || text.contains("acetaminofen") || text.contains("apronax") || text.contains("naproxeno"))) {
            reply.append("Comparativa Clínica: Acetaminofén (Paracetamol) vs Ibuprofeno\n\n")
                 .append("Ambos son excelentes analgésicos de venta libre, pero tienen mecanismos de acción y perfiles diferentes:\n\n")
                 .append("1. Acetaminofén (Paracetamol / Dolex):\n")
                 .append("• Acción: Analgésico y antipirético (alivia dolor y baja fiebre). No es antiinflamatorio significativo.\n")
                 .append("• Ventaja: Muy seguro para el estómago. Es la primera elección para dolor de cabeza, fiebre, personas con gastritis, hipertensión, adultos mayores y sospecha de dengue.\n\n")
                 .append("2. Ibuprofeno / Naproxeno (AINEs):\n")
                 .append("• Acción: Antiinflamatorio, analgésico y antipirético.\n")
                 .append("• Ventaja: Indicado cuando el dolor involucra inflamación evidente: golpes musculares, dolor articular, inflamación dental o cólicos menstruales intensos.\n")
                 .append("• Precaución: Debe tomarse siempre con alimentos para proteger la mucosa gástrica.\n\n")
                 .append("¿Se pueden alternar? Solo bajo criterio médico en casos de fiebre refractaria. Nunca deben duplicarse las dosis al mismo tiempo.");

            findMatchingProducts(allProducts, Arrays.asList("paracetamol", "ibuprofeno 400", "dolex", "apronax"), suggestions);
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "COMPARATIVE_CLINICAL", false);
        }

        // 4. SOBREDOSIS, DUPLICACIÓN O DOSIS OLVIDADA
        if (text.contains("dos pastillas") || text.contains("tome dos") || text.contains("doble dosis") || text.contains("olvide tomar") || text.contains("sobredosis") || text.contains("cuanto puedo tomar") || text.contains("dosis maxima")) {
            reply.append("Pautas de Dosificación Segura y Manejo de Dosis Olvidadas:\n\n")
                 .append("• Dosis máxima de Acetaminofén en adultos: 3.000 mg (3 gramos) en 24 horas. Lo recomendado es 500 mg cada 6 a 8 horas (máximo 1.000 mg por toma espaciada).\n")
                 .append("• Dosis máxima de Ibuprofeno en automedicación: 1.200 mg al día (400 mg cada 8 horas, siempre con comida).\n\n")
                 .append("• Si olvidaste una dosis: Tómala tan pronto lo recuerdes, a menos que ya esté cerca la hora de la siguiente. NUNCA tomes dos pastillas juntas para compensar el olvido.\n\n")
                 .append("• Si tomaste una dosis extra por error: Mantente hidratado y observa si surgen náuseas, vómito, mareo o dolor abdominal agudo. En caso de síntomas intensos, acude de inmediato a un centro hospitalario.");

            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), Collections.emptyList(), "DOSAGE_SAFETY", false);
        }

        // 5. HIPERTENSIÓN Y ANTIGRIPALES (Riesgo cardiovascular)
        if ((text.contains("presion") || text.contains("hipertenso") || text.contains("hipertension") || text.contains("tension")) &&
            (text.contains("antigripal") || text.contains("gripe") || text.contains("congestion") || text.contains("puedo tomar"))) {
            reply.append("Precaución en Pacientes con Hipertensión Arterial:\n\n")
                 .append("La mayoría de antigripales comerciales combinados contienen vasoconstrictores sistémicos (como Fenilefrina o Pseudoefedrina) que estrechan los vasos sanguíneos para destapar la nariz, lo cual eleva de forma peligrosa la presión arterial.\n\n")
                 .append("Alternativas seguras para la gripe si sufres de presión alta:\n")
                 .append("• Para fiebre y dolor: Acetaminofén / Paracetamol puro 500 mg (no altera la presión arterial).\n")
                 .append("• Para congestión nasal: Solución salina nasal o lavados con suero fisiológico (descongestiona de forma puramente física sin fármacos vasoconstrictores).\n")
                 .append("• Bálsamos tópicos: Vick Vaporub aplicado en pecho y cuello para despejar las vías respiratorias.\n")
                 .append("• Hidratación continua y descanso adecuado.");

            findMatchingProducts(allProducts, Arrays.asList("paracetamol", "vick", "vitamina c"), suggestions);
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "CARDIO_PRECAUTION", false);
        }

        // 6. ESTREÑIMIENTO, DIGESTIÓN Y TRÁNSITO INTESTINAL
        if (text.contains("estrenimiento") || text.contains("dificultad para ir al bano") || text.contains("evacuar") || text.contains("transito lento") || text.contains("laxante") || text.contains("tapar") || text.contains("tapado")) {
            reply.append("Orientación para el Manejo del Estreñimiento y Tránsito Lento:\n\n")
                 .append("• Opción fitoterapéutica de venta libre: Ciruelax Laxante Natural (comprimidos con extracto de sen y ciruelas desecadas). Ayuda a normalizar la función intestinal con efecto predecible de 8 a 12 horas (tomar preferiblemente en la noche).\n")
                 .append("• Hidratación activa: Ingerir mínimo 2 litros de agua diarios para ablandar las heces.\n")
                 .append("• Fibra dietética: Aumentar el consumo de papaya, pitahaya, avena en hojuelas, verduras verdes y semillas de chía.\n")
                 .append("• Actividad física: Caminar 20 a 30 minutos al día estimula los movimientos peristálticos naturales del colon.");

            findMatchingProducts(allProducts, Arrays.asList("ciruelax"), suggestions);
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "DIGESTIVE_HEALTH", false);
        }

        // 7. SALUD OCULAR, OJOS ROJOS Y FATIGA VISUAL
        if (text.contains("ojo") || text.contains("ojos") || text.contains("lagrimas") || text.contains("vista cansada") || text.contains("pantalla") || text.contains("sequedad ocular") || text.contains("colirio") || text.contains("ardor ojos")) {
            reply.append("Cuidado Ocular, Alivio de Ojos Rojos y Sequedad:\n\n")
                 .append("• Tears Naturale Gotas Lubricantes Oculares: Solución oftálmica que sustituye la película lagrimal natural, aliviando el ardor, enrojecimiento y sensación de arenilla por pantallas o aire acondicionado.\n")
                 .append("• Regla 20-20-20: Cada 20 minutos de trabajo en computador o celular, mira un objeto a 20 pies (6 metros) de distancia durante 20 segundos para relajar los músculos ciliares.\n")
                 .append("• Si hay secreción purulenta (lagañas amarillas/verdes), dolor ocular agudo o visión borrosa persistente, no te automediques con gotas y consulta a un oftalmólogo.");

            findMatchingProducts(allProducts, Arrays.asList("tears naturale"), suggestions);
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "EYE_CARE", false);
        }

        // 8. SALUD CAPILAR, UÑAS, PIEL Y COLÁGENO
        if (text.contains("cabello") || text.contains("caida del pelo") || text.contains("unas") || text.contains("colageno") || text.contains("arrugas") || text.contains("flacidez") || text.contains("biotina") || text.contains("acido folico")) {
            reply.append("Nutrición Celular, Salud Capilar, Articular y de la Piel:\n\n")
                 .append("• ColG Colágeno Hidrolizado con Vitamina C y Biotina (300 g): Estimula la biosíntesis de queratina y colágeno para fortalecer la fibra capilar, uñas quebradizas y la firmeza dérmica.\n")
                 .append("• Acidfol Ácido Fólico 1 mg: Vitamina esencial del complejo B (B9) para la regeneración y división celular activa.\n")
                 .append("• Vitamina C 1000 mg + Zinc: Antioxidante indispensable para la síntesis de colágeno natural y defensa inmunitaria.");

            findMatchingProducts(allProducts, Arrays.asList("colageno", "acidfol", "vitamina c"), suggestions);
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "NUTRITION_CARE", false);
        }

        // 9. CONSERVACIÓN Y VENCIMIENTO DE MEDICAMENTOS EN CASA
        if (text.contains("conservar") || text.contains("guardar") || text.contains("donde guardar") || text.contains("vencido") || text.contains("vencimiento") || text.contains("fecha de vencimiento") || text.contains("caducado")) {
            reply.append("Pautas Sanitarias de Conservación y Almacenamiento de Medicamentos:\n\n")
                 .append("• Dónde NO guardarlos: Evita el botiquín del baño y la cocina. La humedad y las oscilaciones térmicas degradan rápidamente los principios activos.\n")
                 .append("• Ubicación ideal: Un cajón o armario seco, fresco, protegido de la luz solar directa y fuera del alcance de los niños (temperatura inferior a 30°C).\n")
                 .append("• Medicamentos vencidos: NUNCA deben consumirse. Pasada la fecha de caducidad pierden su potencia terapéutica garantizada y pueden descomponerse en subproductos irritantes o tóxicos.\n")
                 .append("• Eliminación segura: Deséchalos en los puntos de recolección 'Punto Azul' ubicados en las principales farmacias aliadas de FarmaYA.");

            return new ChatResponse(reply.toString(), Collections.emptyList(), "MED_STORAGE", false);
        }

        // 10. GENÉRICOS VS COMERCIALES DE MARCA
        if (text.contains("generico") || text.contains("de marca") || text.contains("comercial") || text.contains("es lo mismo") || text.contains("por que es mas barato")) {
            reply.append("Claridad Farmacéutica: Medicamentos Genéricos vs Medicamentos de Marca:\n\n")
                 .append("• Mismo Principio Activo: Un medicamento genérico contiene exactamente la misma molécula, concentración, dosificación y forma farmacéutica que el de marca (ej. Acetaminofén 500 mg genérico vs Dolex 500 mg).\n\n")
                 .append("• Bioequivalencia INVIMA: En Colombia, el INVIMA exige estrictos estudios de biodisponibilidad para certificar que el genérico se absorbe y actúa en el organismo con idéntica eficacia y seguridad clínica.\n\n")
                 .append("• ¿Por qué son más económicos? Porque los laboratorios de genéricos no incurren en los costos multimillonarios de investigación inicial de la molécula, patentes ni grandes campañas de publicidad masiva.");

            findMatchingProducts(allProducts, Arrays.asList("paracetamol", "dolex", "ibuprofeno 400"), suggestions);
            return new ChatResponse(reply.toString(), suggestions, "GENERIC_INFO", false);
        }

        // 11. TOS SECA VS TOS CON FLEMA
        if (text.contains("tos seca") || text.contains("tos con flema") || text.contains("tos con moco") || text.contains("expectorante") || text.contains("carraspeo") || text.contains("flemas")) {
            reply.append("Diferenciación y Manejo Clínico de la Tos:\n\n")
                 .append("1. Tos con Flema (Productiva):\n")
                 .append("• Es un mecanismo de defensa para limpiar las vías respiratorias; NO se debe cortar.\n")
                 .append("• Indicado: Jarabe Abrilar Hedera Helix (100 ml), expectorante natural que fluidifica las secreciones espesas para facilitar su expulsión.\n\n")
                 .append("2. Tos Seca o Irritativa (Sin flema):\n")
                 .append("• Sensación de picazón o carraspera en la garganta.\n")
                 .append("• Indicado: Strepsils Pastillas Miel y Limón (antiséptico y demulcente local) o Noraver Spray Bucofaríngeo para calmar la irritación.\n")
                 .append("• Medidas de soporte: Tomar agua tibia con miel, evitar cambios bruscos de temperatura y humedecer el ambiente.");

            findMatchingProducts(allProducts, Arrays.asList("abrilar", "strepsils", "noraver"), suggestions);
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "RESPIRATORY_CARE", false);
        }

        // 12. GASES, DISTENSIÓN Y DIGESTIÓN PESADA
        if (text.contains("gas") || text.contains("gases") || text.contains("hinchazon") || text.contains("distension") || text.contains("eructos") || text.contains("pesadez") || text.contains("llenura")) {
            reply.append("Alivio de la Pesadez Digestiva, Gases y Distensión Abdominal:\n\n")
                 .append("• Sal de Frutas Lúa Plus: Antiácido efervescente que alivia rápidamente la sensación de llenura, pesadez y flatulencias tras comidas copiosas.\n")
                 .append("• Gaviscon Doble Acción: Barrera de alginato de sodio que neutraliza el exceso de ácido y reduce el reflujo gástrico.\n")
                 .append("• Pautas dietéticas: Comer despacio masticando bien los alimentos, evitar bebidas gaseosas con las comidas y dar una caminata suave de 10 minutos tras almorzar.");

            findMatchingProducts(allProducts, Arrays.asList("lua", "gaviscon", "pepto"), suggestions);
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "DIGESTIVE_HEALTH", false);
        }

        // 13. INSOMNIO Y SUEÑO REPARADOR
        if (text.contains("dormir") || text.contains("sueno") || text.contains("insomnio") || text.contains("desvelo") || text.contains("descanso") || text.contains("melatonina") || text.contains("magnesio")) {
            reply.append("Opciones Naturales para la Conciliación del Sueño y Relajación:\n\n")
                 .append("• Melatonina 3 mg con Pasiflora en gomitas: Hormona natural que sincroniza el ritmo circadiano y facilita un sueño reparador sin generar tolerancia ni dependencia.\n")
                 .append("• Citrato de Magnesio Puro en Polvo 250 g: Mineral esencial que actúa en los receptores GABA del sistema nervioso, relajando la musculatura y reduciendo la tensión nocturna.\n\n")
                 .append("Higiene del sueño:\n")
                 .append("• Apagar pantallas (celular, TV) al menos 45 minutos antes de acostarte.\n")
                 .append("• Mantener la habitación oscura, ventilada y silenciosa.");

            findMatchingProducts(allProducts, Arrays.asList("melatonina", "citrato de magnesio"), suggestions);
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "SLEEP_WELLNESS", false);
        }

        // 14. FIEBRE Y SIGNOS DE ALARMA DE EMERGENCIA
        if (text.contains("fiebre peligrosa") || text.contains("cuando ir a urgencias") || text.contains("signos de alarma") || text.contains("convulsion") || (text.contains("fiebre") && text.contains("nino"))) {
            reply.append("Evaluación de Fiebre y Signos de Alarma que Requieren Urgencias Inmediatas:\n\n")
                 .append("Manejo en casa de fiebre leve (<38.5°C):\n")
                 .append("• Acetaminofén / Paracetamol (Dolex o Buprex Pediátrico en niños según peso).\n")
                 .append("• Paños tibios (nunca alcohol ni agua helada) e hidratación con suero oral.\n\n")
                 .append("Acude a un centro de urgencias de inmediato si observas:\n")
                 .append("1. Temperatura mayor a 39°C que no desciende con medicación antipirética.\n")
                 .append("2. En bebés menores de 3 meses con cualquier fiebre mayor a 38°C.\n")
                 .append("3. Rigidez de nuca, dificultad respiratoria (aleteo nasal o hundimiento de costillas).\n")
                 .append("4. Somnolencia extrema, llanto inconsolable o convulsiones.");

            findMatchingProducts(allProducts, Arrays.asList("paracetamol", "dolex", "buprex"), suggestions);
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "CLINICAL_ALERT", false);
        }

        // 15. NÚMERO DE SOPORTE, CONTACTO Y ATENCIÓN AL CLIENTE
        if (text.contains("soporte") || text.contains("telefono") || text.contains("numero") ||
            text.contains("celular") || text.contains("contacto") || text.contains("whatsapp") ||
            text.contains("linea") || text.contains("atencion al cliente") || text.contains("asesor") ||
            text.contains("humano") || text.contains("comunicarme") || text.contains("hablar con alguien")) {
            return new ChatResponse(
                "Líneas Oficiales de Atención y Soporte FarmaYA:\n\n" +
                "Estamos a tu disposición para atender inquietudes operativas, novedades con tus pedidos o pagos:\n\n" +
                "• Teléfono y WhatsApp Directo: +57 (300) 912-3456\n" +
                "• Correo Electrónico Institucional: soporte@farmaya.com (y farmaya031@gmail.com)\n" +
                "• Horario de Operación: Lunes a Domingo de 7:00 a.m. a 10:00 p.m.\n" +
                "• Menú de Ayuda en la App: Haz clic en el menú superior (3 líneas) y selecciona 'Centro de Ayuda / Soporte'.",
                Collections.emptyList(),
                "SUPPORT",
                false
            );
        }

        // 16. CANCELACIONES Y REEMBOLSOS
        if (text.contains("cancelar") || text.contains("anular") || text.contains("devolucion") ||
            text.contains("reembolso") || text.contains("reclamo") || text.contains("queja")) {
            return new ChatResponse(
                "Gestión de Pedidos, Cancelaciones y Reembolsos en FarmaYA:\n\n" +
                "• Cancelación antes de despacho: Si la farmacia aliada aún no ha empacado tus medicamentos, puedes cancelar directamente desde 'Mis Pedidos'.\n" +
                "• Devolución de pagos Wompi: Los pagos efectuados con PSE, Nequi o tarjeta de crédito se reversan automáticamente a través de la pasarela en 24 a 48 horas hábiles.\n" +
                "• Garantía de integridad del paquete: Si al recibir el pedido notas alteraciones en los sellos, NO entregues el código PIN al domiciliario y comunícate de inmediato con soporte al +57 (300) 912-3456.",
                Collections.emptyList(),
                "SUPPORT",
                false
            );
        }

        // 17. FUNCIONAMIENTO DE LA PLATAFORMA Y PAGOS
        if (text.contains("como funciona") || text.contains("como pedir") || text.contains("comprar") || text.contains("pago") || text.contains("wompi") || text.contains("pin") || text.contains("domicilio") || text.contains("envio")) {
            return new ChatResponse(
                "Cómo Funciona FarmaYA (Entrega Prioritaria en 45 Minutos):\n\n" +
                "1. Selección de productos: Explora el catálogo oficial de medicamentos y productos de bienestar de venta libre.\n" +
                "2. Ubicación interactiva: Fija tu dirección de entrega en el mapa para asignar la droguería aliada certificada más cercana.\n" +
                "3. Pago seguro Wompi: Cancela el valor de los productos en línea con tarjetas, PSE, Nequi o Bancolombia.\n" +
                "4. Entrega con código PIN: Un domiciliario llevará tu pedido sellado. La tarifa de domicilio ($5.000 COP) se cancela directamente al domiciliario, y la entrega se valida con un PIN confidencial de 4 dígitos generado en tu pantalla.",
                Collections.emptyList(),
                "PLATFORM_INFO",
                false
            );
        }

        // 18. BÚSQUEDA ADAPTATIVA SEMÁNTICA MULTI-TOKEN EN EL CATÁLOGO
        List<Product> matchedProducts = smartProductSearch(allProducts, text);
        if (!matchedProducts.isEmpty()) {
            reply.append("He analizado tu consulta y encontré estas opciones relacionadas disponibles en FarmaYA:\n\n");
            for (Product p : matchedProducts) {
                reply.append("• ").append(p.name).append(": ")
                     .append(p.indication != null ? p.indication : "Medicamento de venta libre certificado.")
                     .append(" (").append(p.presentation != null ? p.presentation : "Presentación oficial").append(")\n");
                suggestions.add(new SuggestedProductDto(p.id, p.name, p.cat, p.price, p.active, p.indication, p.rx, p.presentation));
            }
            reply.append("\nPuedes agregarlos a tu carrito para recibir despacho prioritario en tu ubicación.");
            reply.append(MEDICAL_DISCLAIMER);
            return new ChatResponse(reply.toString(), suggestions, "OTC_RECOMMENDATION", false);
        }

        // 19. RESPUESTA INTELIGENTE ESTRUCTURADA PARA PREGUNTAS ABIERTAS FUERA DE DOMINIO
        reply.append("Orientación Farmacéutica Integral FarmaYA:\n\n")
             .append("He procesado tu consulta sobre \"").append(originalQuery).append("\". Para brindarte la mejor asesoría:\n\n")
             .append("1. Si buscas alivio para un malestar puntual:\n")
             .append("Indícame los síntomas específicos (ej. dolor de cabeza, cólicos, fiebre, gripe, insomnio, problemas digestivos o alergias) y te señalaré los medicamentos de venta libre (OTC) idóneos y seguros.\n\n")
             .append("2. Si se trata de un medicamento bajo fórmula médica (Rx):\n")
             .append("Por políticas de farmacovigilancia y normativa INVIMA, los antibióticos, fármacos controlados y tratamientos crónicos requieren fórmula médica de tu doctor.\n\n")
             .append("3. Si requieres asistencia con un pedido o entrega:\n")
             .append("Puedes consultar el estado en la pestaña 'Mis Pedidos' o comunicarte directamente con nuestro centro de atención al +57 (300) 912-3456.");

        reply.append(MEDICAL_DISCLAIMER);
        return new ChatResponse(reply.toString(), Collections.emptyList(), "GENERAL_ADVICE", false);
    }

    /**
     * Búsqueda Semántica Adaptativa Multitoken en el Catálogo de Productos
     */
    private List<Product> smartProductSearch(List<Product> all, String rawText) {
        if (all == null || all.isEmpty()) return Collections.emptyList();

        List<String> tokens = Arrays.stream(rawText.split("\\s+"))
            .filter(t -> t.length() > 2 && !STOP_WORDS.contains(t))
            .collect(Collectors.toList());

        if (tokens.isEmpty()) return Collections.emptyList();

        Map<Product, Integer> scored = new HashMap<>();

        for (Product p : all) {
            if (p.rx) continue; // No sugerir medicamentos bajo receta en búsquedas abiertas
            int score = 0;
            String nameNorm = normalize(p.name);
            String activeNorm = normalize(p.active);
            String indNorm = normalize(p.indication);
            String catNorm = normalize(p.cat);

            for (String tok : tokens) {
                if (nameNorm.contains(tok)) score += 5;
                if (activeNorm.contains(tok)) score += 4;
                if (indNorm.contains(tok)) score += 2;
                if (catNorm.contains(tok)) score += 1;
            }

            if (score > 0) {
                scored.put(p, score);
            }
        }

        return scored.entrySet().stream()
            .sorted(Map.Entry.<Product, Integer>comparingByValue().reversed())
            .limit(4)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
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
            String model = (geminiModel != null && !geminiModel.isBlank()) ? geminiModel.trim() : "gemini-1.5-flash";
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + geminiApiKey.trim();

            String systemPrompt =
                "Eres FarmaBot, el Asistente Farmacéutico Virtual y Orientador Clínico Inteligente de FarmaYA en Colombia.\n" +
                "TU MISIÓN:\n" +
                "Brindar orientación de alta calidad médica, empática, precisa y profesional a los pacientes y clientes de FarmaYA.\n\n" +
                "PAUTAS Y REGLAS FUNDAMENTALES:\n" +
                "1. PREGUNTAS ABIERTAS Y CLÍNICAS: Responde de forma completa, estructurada y profunda. Si te preguntan sobre hábitos, interacciones farmacológicas, diferencias entre medicamentos (ej. paracetamol vs ibuprofeno), alcohol, horarios o cuidados preventivos, explica los mecanismos de acción en lenguaje claro y accesible.\n" +
                "2. MEDICAMENTOS BAJO RECETA (Rx): Si solicitan antibióticos, corticoides fuertes o medicamentos controlados, explica cortésmente por qué exigen fórmula médica según el Decreto 780 de 2016 e INVIMA (resistencia bacteriana, toxicidad hepática/renal) e insta a consultar al médico tratante.\n" +
                "3. MEDICAMENTOS DE VENTA LIBRE EN FARMAYA: Puedes orientar sobre medicamentos OTC disponibles en la plataforma como Acetaminofén/Dolex, Ibuprofeno, Naproxeno/Apronax, Omeprazol, Gaviscon, Pepto-Bismol, Suero Electrolit, Tears Naturale (gotas para ojos secos), Ciruelax (laxante natural), Citrato de Magnesio, Melatonina, Colágeno ColG, Acidfol Ácido Fólico y Vitamina C con Zinc.\n" +
                "4. SOPORTE OPERATIVO: Teléfono/WhatsApp de atención: +57 300 912-3456, correo soporte@farmaya.com. Entrega en 45 min, valor de domicilio $5.000 COP al repartidor, pagos seguros por Wompi, validación final con código PIN de 4 dígitos.\n" +
                "5. DESCARGO MÉDICO OBLIGATORIO: Recuerda siempre que tu orientación es informativa y educativa, y que ante síntomas persistentes o de alarma deben acudir a un médico.\n" +
                "6. ESTILO DE COMUNICACIÓN: CERO EMOJIS (estrictamente prohibido usar emojis en todo el texto). Utiliza listas con viñetas y párrafos concisos y elegantes.";

            StringBuilder userContent = new StringBuilder();
            userContent.append(systemPrompt).append("\n\n");
            if (history != null && !history.isEmpty()) {
                userContent.append("Historial de la conversación previa:\n");
                for (ChatMessage m : history) {
                    if (m != null && m.text() != null) {
                        userContent.append(m.role()).append(": ").append(m.text()).append("\n");
                    }
                }
                userContent.append("\n");
            }
            userContent.append("Pregunta o consulta del usuario: ").append(originalQuery);

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
                        // Eliminar emojis residuales por seguridad
                        reply = reply.replaceAll("[\\p{So}\\p{Cn}]", "").trim();

                        List<SuggestedProductDto> suggestions = new ArrayList<>();
                        List<Product> all = productRepo.findAll();
                        String normReply = normalize(reply);
                        for (Product p : all) {
                            if (!p.rx && p.name != null && normReply.contains(normalize(p.name))) {
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
