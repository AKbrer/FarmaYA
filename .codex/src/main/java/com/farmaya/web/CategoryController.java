package com.farmaya.web;

import com.farmaya.model.Category;
import com.farmaya.repo.CategoryRepository;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {
    private final CategoryRepository categories;
    public CategoryController(CategoryRepository categories) { this.categories = categories; }

    @Public
    @GetMapping
    public List<Category> listActive() {
        return categories.findByActiveTrueOrderBySortOrderAscNameAsc();
    }
}
