package com.farmaya.service;

import com.farmaya.config.FarmaYaProperties;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.repo.UserRepository;
import com.farmaya.repo.CategoryRepository;
import com.farmaya.model.Category;
import com.farmaya.model.Product;
import com.farmaya.repo.ProductRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Crea el administrador inicial y, opcionalmente, cuentas de prueba y catálogo. */
@Component
public class SeedData implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(SeedData.class);
    private static final String DEMO_PASSWORD = "Demo1234!";

    private final UserRepository users;
    private final CategoryRepository categories;
    private final ProductRepository products;
    private final AuthService auth;
    private final FarmaYaProperties props;

    public SeedData(UserRepository users, CategoryRepository categories, ProductRepository products, AuthService auth, FarmaYaProperties props) {
        this.users = users;
        this.categories = categories;
        this.products = products;
        this.auth = auth;
        this.props = props;
    }

    @Override
    public void run(ApplicationArguments args) {
        seedCategories();
        seedProducts();
        if (!users.existsByRole(Role.ADMIN)) {
            User a = base("Administrador FarmaYa", props.adminEmail(), "3000000000", Role.ADMIN, props.zones().get(0), props.adminPassword());
            a.verified = true;
            users.save(a);
            log.info("Administrador creado: {}", props.adminEmail());
        }
        if (props.seedDemo() && users.findByEmailIgnoreCase("cliente@demo.com").isEmpty()) {
            String z1 = props.zones().get(0);
            String z2 = props.zones().size() > 1 ? props.zones().get(1) : z1;

            User c = base("Camila Torres", "cliente@demo.com", "3001112233", Role.CLIENTE, z1, DEMO_PASSWORD);
            c.verified = true;

            User f1 = base("Laura Gómez", "farmacia@demo.com", "3004445566", Role.FARMACIA, z1, DEMO_PASSWORD);
            f1.pharmacyName = "Botica Central";
            f1.address = "Calle 10 # 5-20";
            f1.licenseNumber = "RS-0001";
            f1.openFrom = "00:00";
            f1.openTo = "00:00"; // 24 horas
            f1.verified = true;

            User f2 = base("Andrés Ruiz", "farmacia2@demo.com", "3007778899", Role.FARMACIA, z2, DEMO_PASSWORD);
            f2.pharmacyName = "Droguería Vida";
            f2.address = "Carrera 7 # 12-45";
            f2.licenseNumber = "RS-0002";
            f2.openFrom = "00:00";
            f2.openTo = "00:00";
            f2.verified = true;

            User r = base("Mateo Pérez", "repartidor@demo.com", "3002223344", Role.REPARTIDOR, z1, DEMO_PASSWORD);
            r.vehicle = "Moto";
            r.verified = true;

            users.save(c);
            users.save(f1);
            users.save(f2);
            users.save(r);
            log.info("Cuentas de prueba creadas (contraseña: {})", DEMO_PASSWORD);
        }
    }


    private void seedCategories() {
        // Eliminar la categoría antigua de ofertas para que no siga apareciendo en la base de datos.
        categories.findByCode("promo").ifPresent(categories::delete);
        Object[][] defaults = {
            {"meds", "Medicamentos", "Medicamentos de venta libre y productos farmacéuticos", 1},
            {"care", "Cuidado Personal", "Higiene y cuidado personal", 2},
            {"baby", "Bebé e Infantil", "Productos para bebés y niños", 3},
            {"sexual", "Salud Sexual y Bienestar", "Preservativos, lubricantes y bienestar íntimo", 4}
        };
        for (Object[] row : defaults) {
            String code = (String) row[0];
            if (categories.findByCode(code).isEmpty()) {
                categories.save(new Category(code, (String) row[1], (String) row[2], (Integer) row[3]));
            }
        }
    }

    private void seedProducts() {
        List<Product> defaults = List.of(
            new Product("Protector solar FPS 50+ Facial", "care", 58500, "tube", "#f2a516", true, false, "ISDIN Colombia", "Frasco x 50 ml Fusion Water", "NSOC71923-16CO", "Filtros solares UVA/UVB de amplio espectro", "Fotoprotección facial diaria de fase acuosa y textura ultraligera.", "No exponer a temperaturas mayores a 40°C", null),
            new Product("Paracetamol 500 mg", "meds", 6500, "box", "#e8742a", true, false, "Genfar", "Caja x 20 tabletas", "INVIMA 2017M-0004521-R1", "Acetaminofén 500 mg", "Analgésico y antipirético para el alivio del dolor de cabeza y fiebre.", "Temperatura menor a 30°C", null),
            new Product("Suero oral Electrolit Fresa", "vital", 8500, "bottle", "#3b8fdb", false, false, "Laboratorios Pisa", "Frasco x 625 ml", "INVIMA 2020M-0015610", "Electrolitos orales y glucosa", "Rehidratación oral para deshidratación por ejercicio, calor o diarrea.", "Consérvese a temperatura ambiente", null),
            new Product("Ibuprofeno 400 mg", "meds", 8900, "box", "#16865d", false, false, "MK (Tecnoquímicas)", "Caja x 20 cápsulas blandas", "INVIMA 2016M-0006782-R1", "Ibuprofeno 400 mg", "Alivio rápido de dolores musculares, menstruales y de cabeza.", "Temperatura ambiente (15°C - 25°C)", null),
            new Product("Loratadina 10 mg", "meds", 7200, "box", "#2b9a68", false, false, "Genfar", "Caja x 10 tabletas", "INVIMA 2015M-0003214-R2", "Loratadina 10 mg", "Antihistamínico no sedante para rinitis alérgica y urticaria.", "Temperatura menor a 30°C", null),
            new Product("Amoxicilina 500 mg", "meds", 14500, "box", "#d79a14", false, true, "Lafrancol", "Caja x 15 cápsulas", "INVIMA 2016M-0001928-R3", "Amoxicilina Trihidrato 500 mg", "Antibiótico bactericida de amplio espectro. Venta obligatoria bajo fórmula médica.", "Lugar seco a menos de 30°C", null),
            new Product("Vitamina C 1000 mg", "vital", 28900, "box", "#16865d", false, false, "Bayer de Colombia", "Tubo x 10 tabletas efervescentes", "INVIMA 2019M-0012903", "Ácido Ascórbico 1000 mg + Zinc", "Refuerzo del sistema inmune y antioxidante celular.", "Lugar fresco y seco", null),
            new Product("Omeprazol 20 mg", "gastro", 9800, "box", "#0a5ca8", false, false, "Sanofi", "Caja x 14 cápsulas con gránulos gastrorresistentes", "INVIMA 2018M-0009841", "Omeprazol 20 mg", "Inhibidor de la bomba de protones para reflujo gástrico y gastritis.", "Protéjase de la humedad", null),
            new Product("Prueba Multivitamínico FarmaYA Forte", "vital", 34500, "box", "#16865d", false, false, "Laboratorios FarmaYA S.A.S.", "Frasco x 60 gomitas", "INVIMA 2026M-0099881", "Vitaminas A, C, D3, E y Zinc", "Refuerzo nutricional integral diario para adultos y jóvenes.", "Consérvese a menos de 25°C en lugar fresco y seco.", null),
            new Product("Ibuprofeno 800 mg", "meds", 14200, "box", "#16865d", false, false, "MK (Tecnoquímicas)", "Caja x 30 tabletas recubiertas", "INVIMA 2018M-0008432-R2", "Ibuprofeno 800 mg", "Antiinflamatorio no esteroideo (AINE), analgésico y antipirético para el alivio de dolor e inflamación.", "Temperatura ambiente controlada (15°C - 25°C)", null),
            new Product("Naproxeno 250 mg", "meds", 11500, "box", "#0a5ca8", false, false, "MK (Tecnoquímicas)", "Caja x 20 tabletas", "INVIMA 2019M-0010452", "Naproxeno sódico 250 mg", "Antiinflamatorio y analgésico de acción prolongada.", "Temperatura ambiente", null),
            new Product("Crema hidratante Ceramide", "derm", 49900, "jar", "#4a7fc1", true, false, "CeraVe / L'Oréal", "Pote x 340 g", "NSOC82910-18CO", "3 ceramidas esenciales y ácido hialurónico", "Hidratación profunda y restauración de la barrera cutánea.", "Temperatura ambiente", null),
            new Product("Alcohol antiséptico 70% 350 ml", "care", 5900, "bottle", "#5aa9a0", false, false, "JGB", "Frasco x 350 ml", "INVIMA 2014M-0001092-R1", "Alcohol Etílico al 70%", "Antiséptico y desinfectante de uso tópico y de superficies.", "Inflamable. Manténgase alejado del fuego", null),
            new Product("Gel antibacterial con Aloe", "care", 7400, "bottle", "#3b8fdb", false, false, "MK (Tecnoquímicas)", "Frasco x 300 ml con dosificador", "NSOC92301-19CO", "Alcohol al 68% + Glicerina y Aloe Vera", "Higiene rápida de manos sin enjuague con agente humectante.", "Lugar fresco", null),
            new Product("Crema dental Total 12", "care", 8800, "tube", "#0a5ca8", false, false, "Colgate-Palmolive", "Tubo x 150 ml (180 g)", "NSOC02941-98CO", "Flúor y Zinc antibacteriano", "Protección antibacterial por 12 horas y prevención de caries.", "Temperatura ambiente", null),
            new Product("Jabón líquido antibacterial", "care", 9200, "bottle", "#16865d", false, false, "Protex", "Botella dispensadora x 500 ml", "NSOC48291-12CO", "Óleo de linaza y agentes limpiadores suaves", "Elimina el 99.9% de las bacterias manteniendo la piel suave.", "Temperatura ambiente", null),
            new Product("Pañales Winny Sensitive Etapa 3", "baby", 54900, "pack", "#3b8fdb", true, false, "Tecnoquímicas Bebé", "Paquete x 50 unidades", "NSOC61029-14CO", "Cubierta suave con aloe vera y manzanilla", "Absorción prolongada hasta por 12 horas para bebés de 7 a 10 kg.", "Almacenar en lugar seco", null),
            new Product("Toallitas húmedas Winny con Aloe", "baby", 10900, "pack", "#5aa9a0", false, false, "Tecnoquímicas Bebé", "Paquete con tapa x 80 unidades", "NSOC38201-10CO", "Fórmula hipoalergénica con 99% agua pura", "Limpieza suave y delicada de la piel del bebé desde el primer día.", "Cerrar la tapa después de cada uso", null),
            new Product("Biberón Anticólicos 260 ml", "baby", 26500, "baby", "#f2a516", false, false, "Philips Avent", "Unidad de 260 ml / 9 oz", "Dispositivo m\u00e9dico no invasivo", "Polipropileno libre de BPA", "Sistema de válvula anticólicos clínicamente comprobado.", "Esterilizar antes de cada uso", null),
            new Product("Crema antipañalitis Desitin Rapid", "baby", 18800, "tube", "#e8742a", false, false, "Johnson & Johnson", "Tubo x 57 g", "NSOC29102-08CO", "Óxido de Zinc al 13%", "Alivio y prevención inmediata de la dermatitis del pañal.", "Temperatura menor a 30°C", null),
            new Product("Termómetro Digital Infrarrojo", "meds", 45900, "box", "#0d3f7a", false, false, "GMD Biomédica", "Unidad digital con display LCD", "INVIMA 2018DM-0018392", "Sensor infrarrojo de precisión clínica", "Medición instantánea sin contacto en 1 segundo con alarma de fiebre.", "Proteger de caídas y humedad", null),
            new Product("Dolex Avanzado 500 mg", "meds", 12500, "box", "#004e46", true, false, "Sanofi-Aventis", "Caja x 16 tabletas recubiertas con Optizorb", "INVIMA 2018M-0004521-R2", "Acetaminofén 500 mg con Optizorb", "Alivio rápido y eficaz de dolor de cabeza, migraña, dolores musculares y fiebre.", "Temperatura ambiente controlada menor a 30°C", null),
            new Product("Nokout Noche Antigripal", "meds", 14900, "box", "#16325c", true, false, "Tecnoquímicas", "Caja x 12 cápsulas blandas", "INVIMA 2019M-0013840", "Acetaminofén 500 mg + Clorfeniramina 2 mg + Fenilefrina 10 mg", "Tratamiento sintomático del resfriado común, congestión nasal y malestar nocturno.", "Manténgase en lugar fresco y seco", null),
            new Product("Aspirina 100 mg Cardio", "meds", 18400, "box", "#d9383a", false, false, "Bayer", "Caja x 30 tabletas con recubrimiento entérico", "INVIMA 2017M-0002130-R2", "Ácido Acetilsalicílico 100 mg", "Antiagregante plaquetario para la prevención y protección cardiovascular.", "Consérvese a menos de 25°C", null),
            new Product("Buscapina Fem", "meds", 16800, "box", "#c93a52", true, false, "Sanofi / Boehringer Ingelheim", "Caja x 10 grageas", "INVIMA 2018M-0009124-R1", "Butilbromuro de Hioscina 10 mg + Ibuprofeno 400 mg", "Alivio de espasmos abdominales y dolores menstruales intensos.", "Temperatura menor a 30°C", null),
            new Product("Gaviscon Doble Acción Suspensión", "gastro", 29900, "bottle", "#0a5ca8", true, false, "Reckitt Benckiser", "Frasco x 300 ml sabor menta", "INVIMA 2016M-0010411-R1", "Alginato de Sodio 500 mg + Bicarbonato de Sodio 213 mg", "Tratamiento del ardor estomacal, reflujo gastroesofágico y acidez.", "No refrigerar. Mantener por debajo de 30°C", null),
            new Product("Pepto-Bismol Suspensión Original", "gastro", 22500, "bottle", "#e84393", false, false, "Procter & Gamble", "Frasco x 118 ml", "INVIMA 2015M-0001890-R3", "Subsalicilato de Bismuto 262 mg / 15 ml", "Alivio rápido de acidez, indigestión, malestar estomacal, náuseas y diarrea.", "Proteger del congelamiento", null),
            new Product("Sal de Frutas Lúa Plus", "gastro", 9800, "box", "#2b9a68", false, false, "Tecnoquímicas", "Caja x 6 sobres efervescentes", "INVIMA 2017M-0005432-R2", "Bicarbonato de Sodio + Ácido Cítrico + Carbonato de Magnesio", "Alivio refrescante contra la pesadez estomacal, llenura y agruras.", "Lugar fresco y seco", null),
            new Product("Vick Vaporub Pomada 50 g", "meds", 15600, "jar", "#0077b6", true, false, "Procter & Gamble", "Pote x 50 g", "INVIMA 2018M-0003412-R2", "Mentol 2.82 g + Alcanfor 5.26 g + Aceite de Eucalipto 1.33 g", "Alivio de la congestión nasal, tos y dolores musculares causados por el resfriado.", "Consérvese bien tapado a temperatura ambiente", null),
            new Product("Apronax 550 mg", "meds", 19500, "box", "#0d3f7a", true, false, "Bayer", "Caja x 10 tabletas recubiertas", "INVIMA 2019M-0008741-R1", "Naproxeno Sódico 550 mg", "Antiinflamatorio y analgésico potente de larga duración (hasta 12 horas).", "Temperatura menor a 30°C", null),
            new Product("Acetaminofén Gotas Pediátricas", "baby", 7800, "bottle", "#e8742a", false, false, "Genfar", "Frasco gotero x 30 ml (100 mg/ml)", "INVIMA 2016M-0004128-R2", "Acetaminofén 100 mg por ml", "Analgésico y antipirético para lactantes y niños pequeños.", "Consérvese a menos de 30°C", null),
            new Product("Dristan Descongestionante Nasal", "meds", 17200, "bottle", "#0a5ca8", false, false, "GSK Consumer Healthcare", "Frasco nebulizador x 15 ml", "INVIMA 2018M-0006714-R1", "Clorhidrato de Oximetazolina 0.05%", "Descongestión nasal rápida y prolongada hasta por 12 horas.", "Mantener en lugar fresco", null),
            new Product("Noraver Garganta Spray", "meds", 18900, "bottle", "#c93a52", true, false, "Tecnoquímicas", "Frasco spray x 30 ml sabor cereza", "INVIMA 2017M-0012431", "Cloruro de Cetilpiridinio + Benzocaína", "Antiséptico y anestésico local bucofaríngeo para alivio del dolor de garganta e irritación.", "Consérvese en posición vertical", null),
            new Product("Isodine Solución Bucofaríngea", "care", 16500, "bottle", "#8b4513", false, false, "Sanfer", "Frasco x 120 ml con vaso dosificador", "INVIMA 2019M-0010921-R2", "Yodopovidona al 1%", "Enjuague antiséptico para desinfección bucal y alivio de afecciones faríngeas.", "Proteger de la luz solar directa", null),
            new Product("Curitas Venditas Antibacteriales", "care", 8900, "box", "#16865d", true, false, "Beiersdorf (Curitas)", "Caja x 20 unidades surtidas", "INVIMA 2015DM-0013910", "Compresa con plata antibacterial y adhesivo hipoalergénico", "Protección higiénica y cicatrización segura de cortes y raspaduras menores.", "Conservar en lugar seco", null),
            new Product("Agua Oxigenada 10 Vol 120 ml", "care", 4500, "bottle", "#0a5ca8", false, false, "JGB", "Frasco x 120 ml", "INVIMA 2016M-0001045-R3", "Peróxido de Hidrógeno al 3% (10 Vol)", "Antiséptico y desinfectante para limpieza de heridas superficiales.", "Mantener bien cerrado y protegido de la luz", null),
            new Product("Buprex Pediátrico 100 mg/5 ml", "baby", 16900, "bottle", "#e8742a", false, false, "Eurofarma", "Frasco x 120 ml sabor fresa con jeringa dosificadora", "INVIMA 2018M-0011492", "Ibuprofeno 100 mg / 5 ml", "Alivio rápido de fiebre e inflamación en niños y bebés mayores de 6 meses.", "Agitar bien antes de usar", null),
            new Product("Cicatricure Gel Cicatrices 30 g", "derm", 38900, "tube", "#4a7fc1", true, false, "Genomma Lab", "Tubo x 30 g", "NSOC49102-12CO", "Complejo Regenext con extractos botánicos y péptidos", "Desvanece visiblemente cicatrices, estrías y marcas mejorando la elasticidad.", "Temperatura ambiente", null),
            new Product("Lubriderm Reparación Intensiva", "care", 27900, "bottle", "#3b8fdb", true, false, "Johnson & Johnson", "Frasco dispensador x 400 ml", "NSOC61942-14CO", "Minerales esenciales y emolientes nutritivos", "Humectación intensiva 24 horas y restauración de la barrera en piel severamente seca.", "Consérvese a temperatura ambiente", null),
            new Product("Caladryl Loción Antipruriginosa", "derm", 15400, "bottle", "#f6c3d0", false, false, "Johnson & Johnson", "Frasco x 100 ml", "INVIMA 2017M-0007812-R1", "Calamina 8% + Clorhidrato de Difenhidramina 1%", "Alivio calmante del picor, dermatitis por contacto, picaduras y quemaduras solares.", "Agítese bien antes de usar", null),
            new Product("Centrum Multivitamínico Completo", "vital", 46900, "bottle", "#f2a516", true, false, "Haleon / Pfizer", "Frasco x 30 tabletas", "INVIMA 2020M-0017892", "13 vitaminas y 11 minerales esenciales con Luteína", "Suplemento dietario diario de micronutrientes para energía, defensas y vitalidad.", "Mantener en lugar fresco y seco por debajo de 25°C", null),
            new Product("Condones Durex Sensitivo Delgado", "sexual", 16800, "box", "#0d3f7a", true, false, "Reckitt Benckiser", "Caja x 3 unidades", "INVIMA 2018DM-0002194-R1", "Látex natural extra delgado", "Preservativo extra delgado para mayor sensibilidad y protección anticonceptiva segura.", "Lugar fresco y seco", null),
            new Product("Condones Today Triple Placer", "sexual", 14500, "box", "#8b0000", true, false, "Condones Today", "Caja x 3 unidades", "INVIMA 2017DM-0001429-R2", "Látex natural texturado y anatómico", "Preservativo con estrías y puntos estimulantes para máximo placer compartido.", "Lugar fresco y seco", null),
            new Product("Condones Duo Retardante con Benzocaína", "sexual", 15900, "box", "#16325c", true, false, "Laboratorios Duo", "Caja x 3 unidades", "INVIMA 2019DM-0004812", "Látex con benzocaína al 4.5%", "Efecto retardante masculino para prolongar el clímax y mejorar el control durante la relación.", "Lugar fresco y seco", null),
            new Product("Condones Today Ultra Delgado", "sexual", 15200, "box", "#0a5ca8", true, false, "Condones Today", "Caja x 3 unidades", "INVIMA 2018DM-0003102-R1", "Látex de espesor reducido", "Sensación piel a piel con máxima seguridad de barrera contra ITS y embarazos no planificados.", "Temperatura ambiente", null),
            new Product("Lubricante Durex Play Fresa 50 ml", "sexual", 24900, "bottle", "#c93a52", true, false, "Reckitt Benckiser", "Frasco x 50 ml", "INVIMA 2018DM-0003921", "Base acuosa con aroma a fresa", "Gel lubricante íntimo suave y dulce, compatible con condones de látex y juguetes.", "Lugar fresco y seco", null),
            new Product("Gel Lubricante Íntimo K-Y Jelly 100 g", "sexual", 26500, "tube", "#0a5ca8", true, false, "Reckitt Benckiser", "Tubo x 100 g", "INVIMA 2017DM-0001928-R2", "Fórmula hidrodispersable no grasa", "Lubricación íntima recomendada ginecológicamente para aliviar la resequedad vaginal.", "Consérvese a menos de 30°C", null),
            new Product("Lubricante Duo Aloe Vera Base Acuosa 50 ml", "sexual", 19900, "bottle", "#2b9a68", false, false, "Laboratorios Duo", "Frasco x 50 ml", "INVIMA 2019DM-0005412", "Extracto natural de Aloe Vera", "Hidratación y lubricación natural calmante que no irrita y se lava fácilmente con agua.", "Lugar fresco", null),
            new Product("Gel Estimulante Femenino Durex Intense 10 ml", "sexual", 38900, "bottle", "#e84393", true, false, "Reckitt Benckiser", "Frasco con dosificador x 10 ml", "INVIMA 2020DM-0008124", "Complejo Desirex estimulante", "Gotas estimulantes diseñadas para intensificar la sensibilidad clitoriana y el placer femenino.", "Lugar fresco y seco", null),
            new Product("Lubricante Vagisil con Ácido Hialurónico 30 g", "care", 34500, "tube", "#4a7fc1", false, false, "Combe Incorporated", "Tubo x 30 g", "INVIMA 2019DM-0005721", "Ácido hialurónico y extractos calmantes", "Alivio inmediato de la sequedad vaginal imitando la humedad natural del cuerpo.", "Temperatura menor a 30°C", null),
            new Product("Mero Macho Jarabe Vigorizante Natural 500 ml", "sexual", 38900, "bottle", "#8b0000", true, false, "Laboratorios Ecuador Natural", "Frasco x 500 ml con copa dosificadora", "RSA-0010928-2020", "Maca, Borojó, Chontaduro y Ginseng", "Suplemento alimenticio energizante natural que favorece el vigor, energía física y rendimiento íntimo.", "Consérvese en lugar fresco y seco", null),
            new Product("Maca Negra Andina Forte 500 mg", "sexual", 48900, "bottle", "#16325c", true, false, "Nutrimed Colombia", "Frasco x 60 cápsulas", "SD2018-0004129", "Extracto concentrado de Lepidium meyenii", "Suplemento tradicional para potenciar la resistencia física, vitalidad masculina y rendimiento.", "Consérvese a menos de 30°C", null),
            new Product("Ginseng Rojo Coreano Forte 500 mg", "vital", 52900, "box", "#d9383a", true, false, "Korea Ginseng Corp", "Caja x 30 cápsulas blandas", "PFT2019-0002104", "Panax Ginseng estandarizado", "Fitoterapéutico coadyuvante en el agotamiento físico, cansancio y disminución del rendimiento.", "Lugar fresco y seco", null),
            new Product("L-Arginina 1000 mg + Zinc Vigor y Resistencia", "sexual", 58900, "bottle", "#004e46", true, false, "Healthy America", "Frasco x 60 tabletas", "SD2019-0004920", "L-Arginina 1000 mg + Quelato de Zinc 15 mg", "Aminoácido precursor del óxido nítrico para optimizar la vasodilatación, circulación y vigor.", "Mantener en lugar seco", null),
            new Product("Ginkgo Biloba 80 mg Circulación y Energía", "vital", 26500, "box", "#2b9a68", false, false, "MK (Tecnoquímicas)", "Caja x 30 tabletas", "PFM2018-0001092", "Extracto seco de hojas de Ginkgo biloba", "Favorece la microcirculación vascular periférica, el flujo sanguíneo y el rendimiento mental.", "Temperatura ambiente", null),
            new Product("Vitamina E 400 UI Antioxidante Celular", "vital", 29800, "bottle", "#f2a516", false, false, "Genfar", "Frasco x 30 cápsulas blandas", "INVIMA 2017M-0004910", "D-Alfa Tocoferol 400 UI", "Protección celular contra el estrés oxidativo y apoyo vascular para energía corporal.", "Consérvese en lugar fresco", null),
            new Product("Zinc Quelado 50 mg Salud Reproductiva", "vital", 32500, "bottle", "#0a5ca8", false, false, "Nature's Bounty", "Frasco x 60 tabletas", "SD2019-0005102", "Zinc Quelado de alta absorción 50 mg", "Micronutriente clave para la salud reproductiva masculina, fertilidad y síntesis celular.", "Temperatura ambiente", null),
            new Product("Complejo B + Maca Energía Física", "vital", 34900, "box", "#f2a516", false, false, "Bayer", "Caja x 30 tabletas", "SD2018-0003891", "Vitaminas B1, B2, B6, B12 + Maca 200 mg", "Metabolismo energético muscular y reducción del cansancio corporal continuo.", "Consérvese a menos de 30°C", null),
            new Product("Prueba de Embarazo Clearblue Digital", "sexual", 42900, "box", "#0a5ca8", true, false, "Procter & Gamble", "Caja con 1 dispositivo digital", "INVIMA 2018DM-0017891", "Sensor óptico digital con medición de hCG", "Precisión superior al 99% que indica con palabras si estás embarazada y de cuántas semanas.", "Temperatura ambiente", null),
            new Product("Prueba de Embarazo Cassette Gravitest", "sexual", 11500, "box", "#c93a52", false, false, "Laboratorios Wampole", "Sobre con 1 prueba en cassette y gotero", "INVIMA 2017DM-0004912", "Inmunoensayo cromatográfico rápido de hCG", "Detección rápida de embarazo en orina con resultado confiable en 3 a 5 minutos.", "Consérvese entre 2°C y 30°C", null),
            new Product("Jabón Íntimo Nosotras Calm Manzanilla 250 ml", "care", 17900, "bottle", "#2b9a68", false, false, "Familia Nosotras", "Frasco x 250 ml con dosificador", "NSOC61029-14CO", "Extracto de Manzanilla y Ácido Láctico", "Higiene íntima diaria respetando el pH natural de la zona femenina sin causar irritación.", "Temperatura ambiente", null),
            new Product("Jabón Íntimo Lactacyd Pro-Bio Diario 200 ml", "care", 21500, "bottle", "#e84393", false, false, "Sanofi", "Frasco x 200 ml", "NSOC48921-12CO", "Prebióticos naturales y ácido láctico", "Protección prolongada contra olores e incomodidad manteniendo la barrera protectora íntima.", "Lugar fresco", null),
            new Product("Toallas Nosotras Buenas Noches Ultrafina", "care", 16200, "pack", "#16325c", false, false, "Familia Nosotras", "Paquete x 10 toallas con alas", "NSOC51920-13CO", "Cubierta extra suave con centro absorbente", "Mayor longitud y absorción reforzada para un descanso nocturno seguro y libre de filtraciones.", "Conservar en lugar seco", null),
            new Product("Protectores Diarios Carefree Respirables", "care", 12500, "pack", "#f6c3d0", false, false, "Johnson & Johnson", "Paquete x 40 protectores", "NSOC39012-10CO", "Cubierta respirable con extracto de algodón", "Frescura diaria con tecnología de neutralización de olores y ajuste flexible.", "Lugar fresco y seco", null),
            new Product("Tampones Kotex con Aplicador Regular", "care", 15800, "box", "#c93a52", false, false, "Kimberly-Clark", "Caja x 10 tampones con aplicador", "NSOC78912-17CO", "Fibras de rayón de alta absorción", "Protección discreta y cómoda con aplicador plástico suave para días de flujo regular.", "Mantener en lugar seco", null),
            new Product("Canesten Crema Vaginal Clotrimazol 2% 20 g", "meds", 28900, "tube", "#0a5ca8", true, false, "Bayer", "Tubo x 20 g con 3 aplicadores", "INVIMA 2016M-0004192-R1", "Clotrimazol al 2%", "Tratamiento antimicótico de venta libre para candidiasis vaginal, ardor y flujo anormal.", "Consérvese a menos de 25°C", null),
            new Product("Alka-Seltzer Antiácido Efervescente", "gastro", 13500, "box", "#0a5ca8", true, false, "Bayer", "Caja x 12 tabletas en sobres individuales", "INVIMA 2017M-0001892-R2", "Bicarbonato de Sodio + Ácido Cítrico + Aspirina", "Alivio rápido de la acidez estomacal, indigestión ácida y dolor de cabeza concomitante.", "Lugar seco", null),
            new Product("Bonfiest Plus Anti-guayabo Efervescente", "gastro", 14900, "box", "#f2a516", true, false, "Tecnoquímicas", "Caja x 6 sobres efervescentes", "INVIMA 2018M-0008912", "Acetaminofén + Ácido Acetilsalicílico + Cafeína", "Alivio efectivo del malestar general, dolor de cabeza y fatiga post-celebración.", "Lugar fresco", null),
            new Product("Famotidina 20 mg Antiácido", "gastro", 11900, "box", "#004e46", false, false, "Genfar", "Caja x 10 tabletas", "INVIMA 2018M-0010921", "Famotidina 20 mg", "Antagonista H2 para reducir la secreción gástrica y calmar el ardor estomacal nocturno.", "Temperatura menor a 30°C", null),
            new Product("Enterogermina Probiótico 2000 Millones", "gastro", 39900, "box", "#0077b6", true, false, "Sanofi", "Caja x 10 viales bebibles x 5 ml", "INVIMA 2019M-0013912", "Esporas de Bacillus clausii 2 millardos", "Restaura el equilibrio de la flora intestinal tras episodios de diarrea o tratamientos farmacológicos.", "Temperatura ambiente", null),
            new Product("Simeticona 80 mg Antigases", "gastro", 9500, "box", "#2b9a68", false, false, "MK (Tecnoquímicas)", "Caja x 20 cápsulas blandas", "INVIMA 2017M-0006712", "Simeticona 80 mg", "Antiflatulento que disuelve las burbujas de gas para aliviar distensión abdominal y cólicos de gases.", "Temperatura menor a 30°C", null),
            new Product("Colirio Tears Naturale Lubricante Ocular 15 ml", "meds", 31900, "bottle", "#0a5ca8", false, false, "Alcon", "Frasco gotero x 15 ml", "INVIMA 2018M-0009182", "Dextrano 70 + Hipromelosa", "Lágrimas artificiales para alivio calmante de ojos secos, fatiga visual y ardor por pantallas.", "Temperatura ambiente", null),
            new Product("Cepillo Dental Colgate 360 Total Limpieza", "care", 14500, "pack", "#d9383a", false, false, "Colgate-Palmolive", "Empaque x 2 unidades", "Dispositivo de higiene oral", "Cerdas antibacteriales y limpiador de lengua", "Remoción profunda de placa bacteriana y limpieza integral 360 grados de dientes y mejillas.", "Lugar fresco", null),
            new Product("Enjuague Bucal Listerine Cool Mint 500 ml", "care", 22500, "bottle", "#16865d", false, false, "Johnson & Johnson", "Frasco x 500 ml", "NSOC49102-12CO", "Aceites esenciales (Timol, Eucaliptol, Mentol)", "Elimina hasta el 99.9% de los gérmenes que causan placa dental, gingivitis y mal aliento.", "Temperatura ambiente", null),
            new Product("Desodorante Rexona Clinical Crema 48 g", "care", 25900, "tube", "#16325c", false, false, "Unilever", "Tubo dispensador x 48 g", "NSOC61029-14CO", "Tecnología con defensa antitranspirante 3X", "Protección avanzada contra la sudoración excesiva y control de olor hasta por 96 horas.", "Consérvese bien tapado", null),
            new Product("Suero Fisiológico Solución Salina 0.9% 500 ml", "care", 6800, "bottle", "#3b8fdb", false, false, "Laboratorios Baxter", "Frasco x 500 ml con puerto de acceso", "INVIMA 2016M-0002910-R3", "Cloruro de Sodio al 0.9%", "Solución isotónica estéril para lavado de heridas, fosas nasales, ojos y nebulizaciones.", "Consérvese a menos de 30°C", null),
            new Product("Venda Elástica 3 Pulgadas con Broches", "care", 5500, "pack", "#8b4513", false, false, "JGB", "Rollo de 3 pulg x 5 yardas estirada", "INVIMA 2015DM-0012901", "Algodón y poliéster elástico hipoalergénico", "Soporte y compresión firme en esguinces, torceduras y distensiones musculares articulares.", "Lugar seco", null),
            new Product("Esparadrapo Micropore 1 Pulgada x 10 m", "care", 7900, "pack", "#4a7fc1", false, false, "3M Colombia", "Carrete de cinta x 10 metros", "INVIMA 2016DM-0004921", "Papel microporoso no tejido hipoalergénico", "Fijación delicada y transpirable de gasas y apósitos sin irritar la piel sensible.", "Conservar en lugar fresco", null),
            new Product("Citrato de Magnesio Puro en Polvo 250 g", "vital", 42500, "bottle", "#16865d", true, false, "Healthy America", "Pote x 250 g con cuchara medidora", "SD2020-0005192", "Citrato de Magnesio de alta biodisponibilidad", "Relajación muscular, alivio de calambres, soporte neuromuscular y mejora del descanso nocturno.", "Mantener bien tapado en lugar fresco y seco", null),
            new Product("Melatonina 3 mg con Pasiflora Gomitas x 60", "vital", 38900, "bottle", "#16325c", true, false, "Natrol / Nature's Bounty", "Frasco x 60 gomitas sabor fresa", "SD2019-0004810", "Melatonina 3 mg + Extracto de Pasiflora", "Inductor natural del sueño reparador y regulador del ciclo circadiano sin generar dependencia.", "Consérvese a menos de 25°C", null),
            new Product("Omega 3 Aceite de Pescado 1000 mg x 60 cápsulas", "vital", 36500, "bottle", "#f2a516", false, false, "Sundown Naturals", "Frasco x 60 cápsulas blandas", "SD2018-0003921", "Aceite de pescado purificado (EPA 180 mg + DHA 120 mg)", "Protección cardiovascular, control de triglicéridos y apoyo a la función cerebral y articular.", "Temperatura menor a 30°C", null),
            new Product("Colágeno Hidrolizado + Vitamina C y Biotina 300 g", "derm", 46900, "bottle", "#e84393", true, false, "Nutrimed Colombia", "Pote x 300 g sabor frutos rojos", "RSA-0009841-2019", "Péptidos de colágeno bioactivo + Vitamina C + Biotina", "Fortalecimiento de articulaciones, elasticidad de la piel, y prevención de caída del cabello y uñas.", "Lugar fresco y seco", null),
            new Product("Calcio 600 mg + Vitamina D3 x 60 tabletas", "vital", 28500, "bottle", "#0a5ca8", false, false, "Genfar", "Frasco x 60 tabletas", "INVIMA 2017M-0002914-R1", "Carbonato de Calcio 600 mg + Colecalciferol (D3) 400 UI", "Salud y densidad ósea, prevención de osteopenia y soporte mineral en adultos.", "Temperatura menor a 30°C", null),
            new Product("Jarabe Abrilar Hedera Helix Expectorante 100 ml", "meds", 32900, "bottle", "#2b9a68", true, false, "Roemmers / Engelhard", "Frasco x 100 ml con vasito dosificador", "PFT2018-0000841-R1", "Extracto seco de hojas de Hiedra (Hedera helix)", "Expectorante y mucolítico natural para la tos con flemas y afecciones bronquiales inflamatorias.", "Consérvese a menos de 25°C", null),
            new Product("Strepsils Pastillas Garganta Miel y Limón x 16", "meds", 17800, "box", "#f2a516", true, false, "Reckitt Benckiser", "Caja x 16 pastillas para chupar", "INVIMA 2016M-0006714-R2", "Alcohol Diclorobencílico 1.2 mg + Amilmetacresol 0.6 mg", "Antiséptico bucofaríngeo de doble acción para alivio rápido de la irritación e inflamación de garganta.", "Consérvese a menos de 30°C", null),
            new Product("Parches Térmicos Salonpas Dolor Muscular x 5", "meds", 14200, "box", "#0d3f7a", true, false, "Hisamitsu Pharmaceutical", "Sobre con 5 parches adhesivos", "INVIMA 2017M-0004910-R2", "Salicilato de Metilo 10% + Mentol 3% + Alcanfor 3%", "Alivio analgésico tópico continuo hasta por 8 horas para lumbalgias, contracturas y tortícolis.", "Mantener en lugar seco y fresco", null),
            new Product("Leche de Magnesia Phillips Original 360 ml", "gastro", 18900, "bottle", "#0a5ca8", false, false, "Bayer", "Frasco x 360 ml", "INVIMA 2016M-0001092-R3", "Hidróxido de Magnesio al 8.5%", "Antiácido suave para alivio de acidez estomacal y laxante suave osmótico contra el estreñimiento.", "Proteger de la congelación", null),
            new Product("Agua Micelar Bioderma Sensibio H2O 250 ml", "derm", 54900, "bottle", "#e84393", true, false, "NAOS / Bioderma", "Frasco x 250 ml", "NSOC49102-12CO", "Tecnología micelar dermatológica con ésteres de glicerol", "Limpieza profunda, desmaquillante y calmante para pieles sensibles sin alterar la barrera cutánea.", "Temperatura ambiente", null),
            new Product("Eucerin Crema de Manos Reparadora Urea 5% 75 ml", "derm", 38500, "tube", "#004e46", false, false, "Beiersdorf", "Tubo x 75 ml", "NSOC71920-16CO", "Urea al 5% + Ceramidas + Factores Naturales de Humectación", "Alivio y restauración intensiva de manos resecas, agrietadas y expuestas a lavados constantes.", "Temperatura ambiente", null),
            new Product("Shampoo Anticaspa Head & Shoulders Clínico 375 ml", "care", 24900, "bottle", "#0a5ca8", false, false, "Procter & Gamble", "Botella x 375 ml", "NSOC61029-14CO", "Piritionato de Zinc al 1% + Agentes acondicionadores", "Elimina el 100% de la caspa visible, alivia la comezón y protege el cuero cabelludo.", "Lugar fresco", null),
            new Product("Gasas Estériles de Curación 7.5x7.5 cm Caja x 20", "care", 8900, "box", "#16865d", false, false, "JGB", "Caja x 20 sobres estériles individuales", "INVIMA 2016DM-0003912-R1", "Algodón 100% hidrófilo estéril no adherente", "Limpieza aséptica, absorción de exudados y protección de heridas y cortes superficiales.", "Mantener en lugar limpio y seco", null)
        );;
        for (Product p : defaults) {
            if (products.findAllByNameIgnoreCase(p.name).isEmpty()) {
                products.save(p);
            }
        }
        log.info("Catálogo completo verificado en colección 'productos'. Total en BD: {}", products.count());
    }

    private User base(String name, String email, String phone, Role role, String zone, String password) {
        User u = new User();
        u.name = name;
        u.email = email.toLowerCase();
        u.phone = phone;
        u.role = role;
        u.zone = zone;
        u.passwordHash = auth.hashPassword(password);
        return u;
    }
}
