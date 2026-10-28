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
        if (products.count() > 0) return;
        List<Product> defaults = List.of(
            new Product("Ibuprofeno 800 mg", "meds", 14200, "box", "#004e46", true, false, "MK (Tecnoquímicas)", "Caja x 30 tabletas recubiertas", "INVIMA 2018M-0008432-R2", "Ibuprofeno 800 mg", "Antiinflamatorio no esteroideo (AINE), analgésico y antipirético para el alivio de dolor e inflamación.", "Temperatura ambiente controlada (15°C - 25°C)", null),
            new Product("Paracetamol 500 mg", "meds", 6500, "box", "#e8742a", true, false, "Genfar", "Caja x 20 tabletas", "INVIMA 2017M-0004521-R1", "Acetaminofén 500 mg", "Analgésico y antipirético para el alivio del dolor de cabeza y fiebre.", "Temperatura menor a 30°C", null),
            new Product("Vitamina C 1000 mg", "vital", 28900, "bottle", "#f2a516", true, false, "Bayer de Colombia", "Tubo x 10 tabletas efervescentes", "INVIMA 2019M-0012903", "Ácido Ascórbico 1000 mg + Zinc", "Refuerzo del sistema inmune y antioxidante celular.", "Lugar fresco y seco", null),
            new Product("Ibuprofeno 400 mg", "meds", 8900, "box", "#c93a52", true, false, "MK (Tecnoquímicas)", "Caja x 20 cápsulas blandas", "INVIMA 2016M-0006782-R1", "Ibuprofeno 400 mg", "Alivio rápido de dolores musculares, menstruales y de cabeza.", "Temperatura ambiente (15°C - 25°C)", null),
            new Product("Loratadina 10 mg", "meds", 7200, "box", "#2b9a68", false, false, "Genfar", "Caja x 10 tabletas", "INVIMA 2015M-0003214-R2", "Loratadina 10 mg", "Antihistamínico no sedante para rinitis alérgica y urticaria.", "Temperatura menor a 30°C", null),
            new Product("Omeprazol 20 mg", "gastro", 9800, "box", "#0a5ca8", false, false, "Sanofi", "Caja x 14 cápsulas con gránulos gastrorresistentes", "INVIMA 2018M-0009841", "Omeprazol 20 mg", "Inhibidor de la bomba de protones para reflujo gástrico y gastritis.", "Protéjase de la humedad", null),
            new Product("Amoxicilina 500 mg", "meds", 14500, "box", "#d79a14", false, true, "Lafrancol", "Caja x 15 cápsulas", "INVIMA 2016M-0001928-R3", "Amoxicilina Trihidrato 500 mg", "Antibiótico bactericida de amplio espectro. Venta obligatoria bajo fórmula médica.", "Lugar seco a menos de 30°C", null),
            new Product("Suero oral Electrolit Fresa", "vital", 8500, "bottle", "#3b8fdb", false, false, "Laboratorios Pisa", "Frasco x 625 ml", "INVIMA 2020M-0015610", "Electrolitos orales y glucosa", "Rehidratación oral para deshidratación por ejercicio, calor o diarrea.", "Consérvese a temperatura ambiente", null),
            new Product("Protector solar FPS 50+ Facial", "care", 58500, "tube", "#f2a516", true, false, "ISDIN Colombia", "Frasco x 50 ml Fusion Water", "NSOC71923-16CO", "Filtros solares UVA/UVB de amplio espectro", "Fotoprotección facial diaria de fase acuosa y textura ultraligera.", "No exponer a temperaturas mayores a 40°C", null)
        );
        products.saveAll(defaults);
        log.info("Catálogo inicial de medicamentos sembrado en colección 'productos'.");
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
