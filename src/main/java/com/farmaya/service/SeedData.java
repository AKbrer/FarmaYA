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
            {"baby", "Bebé e Infantil", "Productos para bebés y niños", 3}
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
            new Product("Ibuprofeno 800 mg", "meds", 14200, "box", "#004e46", true, false, "MK (Tecnoquímicas)", "Caja x 30 tabletas recubiertas", "INVIMA 2018M-0008432-R2", "Ibuprofeno 800 mg", "Antiinflamatorio no esteroideo (AINE), analgésico y antipirético para el alivio de dolor e inflamación.", "Temperatura ambiente controlada (15°C - 25°C)", null),
            new Product("Paracetamol 500 mg", "meds", 6500, "box", "#e8742a", true, false, "Genfar", "Caja x 20 tabletas", "INVIMA 2017M-0004521-R1", "Acetaminofén 500 mg", "Analgésico y antipirético para el alivio del dolor de cabeza y fiebre.", "Temperatura menor a 30°C", null),
            new Product("Vitamina C 1000 mg", "vital", 28900, "bottle", "#f2a516", true, false, "Bayer de Colombia", "Tubo x 10 tabletas efervescentes", "INVIMA 2019M-0012903", "Ácido Ascórbico 1000 mg + Zinc", "Refuerzo del sistema inmune y antioxidante celular.", "Lugar fresco y seco", null),
            new Product("Ibuprofeno 400 mg", "meds", 8900, "box", "#c93a52", true, false, "MK (Tecnoquímicas)", "Caja x 20 cápsulas blandas", "INVIMA 2016M-0006782-R1", "Ibuprofeno 400 mg", "Alivio rápido de dolores musculares, menstruales y de cabeza.", "Temperatura ambiente (15°C - 25°C)", null),
            new Product("Loratadina 10 mg", "meds", 7200, "box", "#2b9a68", false, false, "Genfar", "Caja x 10 tabletas", "INVIMA 2015M-0003214-R2", "Loratadina 10 mg", "Antihistamínico no sedante para rinitis alérgica y urticaria.", "Temperatura menor a 30°C", null),
            new Product("Omeprazol 20 mg", "gastro", 9800, "box", "#0a5ca8", false, false, "Sanofi", "Caja x 14 cápsulas con gránulos gastrorresistentes", "INVIMA 2018M-0009841", "Omeprazol 20 mg", "Inhibidor de la bomba de protones para reflujo gástrico y gastritis.", "Protéjase de la humedad", null),
            new Product("Suero oral Electrolit Fresa", "vital", 8500, "bottle", "#3b8fdb", false, false, "Laboratorios Pisa", "Frasco x 625 ml", "INVIMA 2020M-0015610", "Electrolitos orales y glucosa", "Rehidratación oral para deshidratación por ejercicio, calor o diarrea.", "Consérvese a temperatura ambiente", null),
            new Product("Protector solar FPS 50+ Facial", "care", 58500, "tube", "#f2a516", true, false, "ISDIN Colombia", "Frasco x 50 ml Fusion Water", "NSOC71923-16CO", "Filtros solares UVA/UVB de amplio espectro", "Fotoprotección facial diaria de fase acuosa y textura ultraligera.", "No exponer a temperaturas mayores a 40°C", null),
            new Product("Naproxeno 250 mg", "meds", 11500, "box", "#0a5ca8", false, false, "MK (Tecnoquímicas)", "Caja x 20 tabletas", "INVIMA 2019M-0010452", "Naproxeno sódico 250 mg", "Antiinflamatorio y analgésico de acción prolongada.", "Temperatura ambiente", null),
            new Product("Crema hidratante Ceramide", "derm", 49900, "jar", "#4a7fc1", true, false, "CeraVe / L'Oréal", "Pote x 340 g", "NSOC82910-18CO", "3 ceramidas esenciales y ácido hialurónico", "Hidratación profunda y restauración de la barrera cutánea.", "Temperatura ambiente", null),
            new Product("Alcohol antiséptico 70% 350 ml", "care", 5900, "bottle", "#5aa9a0", false, false, "JGB", "Frasco x 350 ml", "INVIMA 2014M-0001092-R1", "Alcohol Etílico al 70%", "Antiséptico y desinfectante de uso tópico y de superficies.", "Inflamable. Manténgase alejado del fuego", null),
            new Product("Gel antibacterial con Aloe", "care", 7400, "bottle", "#3b8fdb", false, false, "MK (Tecnoquímicas)", "Frasco x 300 ml con dosificador", "NSOC92301-19CO", "Alcohol al 68% + Glicerina y Aloe Vera", "Higiene rápida de manos sin enjuague con agente humectante.", "Lugar fresco", null),
            new Product("Crema dental Total 12", "care", 8800, "tube", "#0a5ca8", false, false, "Colgate-Palmolive", "Tubo x 150 ml (180 g)", "NSOC02941-98CO", "Flúor y Zinc antibacteriano", "Protección antibacterial por 12 horas y prevención de caries.", "Temperatura ambiente", null),
            new Product("Jabón líquido antibacterial", "care", 9200, "bottle", "#16865d", false, false, "Protex", "Botella dispensadora x 500 ml", "NSOC48291-12CO", "Óleo de linaza y agentes limpiadores suaves", "Elimina el 99.9% de las bacterias manteniendo la piel suave.", "Temperatura ambiente", null),
            new Product("Pañales Winny Sensitive Etapa 3", "baby", 54900, "pack", "#3b8fdb", true, false, "Tecnoquímicas Bebé", "Paquete x 50 unidades", "NSOC61029-14CO", "Cubierta suave con aloe vera y manzanilla", "Absorción prolongada hasta por 12 horas para bebés de 7 a 10 kg.", "Almacenar en lugar seco", null),
            new Product("Toallitas húmedas Winny con Aloe", "baby", 10900, "pack", "#5aa9a0", false, false, "Tecnoquímicas Bebé", "Paquete con tapa x 80 unidades", "NSOC38201-10CO", "Fórmula hipoalergénica con 99% agua pura", "Limpieza suave y delicada de la piel del bebé desde el primer día.", "Cerrar la tapa después de cada uso", null),
            new Product("Biberón Anticólicos 260 ml", "baby", 26500, "baby", "#f2a516", false, false, "Philips Avent", "Unidad de 260 ml / 9 oz", "Dispositivo médico no invasivo", "Polipropileno libre de BPA", "Sistema de válvula anticólicos clínicamente comprobado.", "Esterilizar antes de cada uso", null),
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
            new Product("Centrum Multivitamínico Completo", "vital", 46900, "bottle", "#f2a516", true, false, "Haleon / Pfizer", "Frasco x 30 tabletas", "INVIMA 2020M-0017892", "13 vitaminas y 11 minerales esenciales con Luteína", "Suplemento dietario diario de micronutrientes para energía, defensas y vitalidad.", "Mantener en lugar fresco y seco por debajo de 25°C", null)
        );
        for (Product p : defaults) {
            if (products.findByNameIgnoreCase(p.name).isEmpty()) {
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
