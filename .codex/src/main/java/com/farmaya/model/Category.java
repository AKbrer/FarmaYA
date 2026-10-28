package com.farmaya.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/** Categoría persistente del catálogo de FarmaYa. */
@Document("categories")
public class Category {
    @Id public String id;
    @Indexed(unique = true) public String code;
    public String name;
    public String description;
    public boolean active = true;
    public int sortOrder;

    public Category() {}
    public Category(String code, String name, String description, int sortOrder) {
        this.code = code;
        this.name = name;
        this.description = description;
        this.sortOrder = sortOrder;
        this.active = true;
    }
}
