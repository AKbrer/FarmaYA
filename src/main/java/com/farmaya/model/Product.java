package com.farmaya.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/** Producto del catálogo asistencial de FarmaYA almacenado en la colección `productos`. */
@Document("productos")
public class Product {
    @Id
    public String id;
    public String name;
    public String cat;
    public double price;
    public String art = "box";
    public String color = "#16865d";
    public boolean featured = false;
    public boolean rx = false;
    public String lab;
    public String presentation;
    public String invima;
    public String active;
    public String indication;
    public String storage;
    public String imageUrl;

    public Product() {}

    public Product(String name, String cat, double price, String art, String color, boolean featured, boolean rx,
                   String lab, String presentation, String invima, String active, String indication, String storage, String imageUrl) {
        this.name = name;
        this.cat = cat;
        this.price = price;
        this.art = art != null ? art : "box";
        this.color = color != null ? color : "#16865d";
        this.featured = featured;
        this.rx = rx;
        this.lab = lab;
        this.presentation = presentation;
        this.invima = invima;
        this.active = active;
        this.indication = indication;
        this.storage = storage;
        this.imageUrl = imageUrl;
    }
}
