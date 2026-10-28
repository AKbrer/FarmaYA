package com.farmaya.web;

import com.farmaya.model.Product;
import com.farmaya.model.Role;
import com.farmaya.repo.ProductRepository;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductRepository products;

    public ProductController(ProductRepository products) {
        this.products = products;
    }

    @Public
    @GetMapping
    public List<Product> list(@RequestParam(name = "cat", required = false) String cat) {
        if (cat != null && !cat.isBlank()) {
            return products.findByCat(cat.trim());
        }
        return products.findAll();
    }

    @Public
    @GetMapping("/{id}")
    public Product getById(@PathVariable("id") String id) {
        return products.findById(id).orElseThrow(() -> ApiException.notFound("Producto no encontrado."));
    }

    @Roles(Role.ADMIN)
    @PostMapping
    public Product create(@RequestBody Product p) {
        if (p.name == null || p.name.isBlank()) throw ApiException.bad("El nombre del producto es obligatorio.");
        if (p.price <= 0) throw ApiException.bad("El precio sugerido debe ser mayor a 0.");
        p.id = null;
        return products.save(p);
    }

    @Roles(Role.ADMIN)
    @PutMapping("/{id}")
    public Product update(@PathVariable("id") String id, @RequestBody Product p) {
        Product existing = products.findById(id)
            .or(() -> products.findByNameIgnoreCase(id))
            .orElseThrow(() -> ApiException.notFound("Producto no encontrado."));
        if (p.name != null && !p.name.isBlank()) existing.name = p.name.trim();
        if (p.cat != null && !p.cat.isBlank()) existing.cat = p.cat.trim();
        if (p.price > 0) existing.price = p.price;
        if (p.lab != null) existing.lab = p.lab.trim();
        if (p.presentation != null) existing.presentation = p.presentation.trim();
        if (p.invima != null) existing.invima = p.invima.trim();
        if (p.active != null) existing.active = p.active.trim();
        if (p.indication != null) existing.indication = p.indication.trim();
        if (p.storage != null) existing.storage = p.storage.trim();
        if (p.imageUrl != null) existing.imageUrl = p.imageUrl.trim();
        existing.rx = p.rx;
        existing.featured = p.featured;
        if (p.art != null) existing.art = p.art;
        if (p.color != null) existing.color = p.color;
        return products.save(existing);
    }

    @Roles(Role.ADMIN)
    @DeleteMapping("/{id}")
    public void delete(@PathVariable(name = "id") String id) {
        products.findById(id)
            .or(() -> products.findByNameIgnoreCase(id))
            .ifPresent(products::delete);
    }
}
