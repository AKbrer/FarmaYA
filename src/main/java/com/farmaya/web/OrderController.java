package com.farmaya.web;

import com.farmaya.model.Dtos;
import com.farmaya.model.Dtos.CreateOrderRequest;
import com.farmaya.model.Dtos.NoteRequest;
import com.farmaya.model.Order;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.service.OrderService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService orders;

    public OrderController(OrderService orders) {
        this.orders = orders;
    }

    @GetMapping("/check-availability")
    public Dtos.AvailabilityResponse checkAvailability(
            @RequestParam(value = "city", required = false) String city,
            @RequestParam(value = "lat", required = false) Double lat,
            @RequestParam(value = "lng", required = false) Double lng) {
        return orders.checkPharmacyAvailability(city, lat, lng);
    }

    @Roles(Role.CLIENTE)
    @PostMapping
    public Order create(@RequestAttribute("user") User user, @RequestBody CreateOrderRequest r) {
        return orders.create(user, r);
    }

    @Roles(Role.CLIENTE)
    @GetMapping("/mine")
    public List<Order> mine(@RequestAttribute("user") User user) {
        return orders.listForClient(user);
    }

    @GetMapping("/{id}")
    public Order get(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.get(id, user);
    }

    @Roles(Role.CLIENTE)
    @PostMapping("/{id}/accept-price")
    public Order acceptPrice(@PathVariable String id, @RequestAttribute("user") User user,
                             @RequestBody(required = false) java.util.Map<String, Object> paymentData) {
        return orders.acceptPrice(id, user, paymentData);
    }

    @Roles(Role.CLIENTE)
    @PostMapping("/{id}/decline-price")
    public Order declinePrice(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.declinePrice(id, user);
    }

    @Roles(Role.CLIENTE)
    @PostMapping("/{id}/cancel")
    public Order cancel(@PathVariable String id, @RequestAttribute("user") User user) {
        return orders.cancelByClient(id, user);
    }

    @Roles({Role.CLIENTE, Role.FARMACIA, Role.REPARTIDOR})
    @PostMapping("/{id}/incident")
    public Order incident(@PathVariable String id, @RequestAttribute("user") User user, @RequestBody NoteRequest r) {
        return orders.reportIncident(id, user, r.note());
    }
}
