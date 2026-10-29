package com.farmaya.web;

import com.farmaya.model.Dtos.FlagRequest;
import com.farmaya.model.Dtos.NoteRequest;
import com.farmaya.model.Dtos.ResolveRequest;
import com.farmaya.model.Order;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.service.AdminService;
import com.farmaya.service.OrderService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@Roles(Role.ADMIN)
public class AdminController {
    private final AdminService admin;
    private final OrderService orders;

    public AdminController(AdminService admin, OrderService orders) {
        this.admin = admin;
        this.orders = orders;
    }

    @GetMapping("/movements")
    public List<com.farmaya.model.Movement> movements() {
        return admin.movements();
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return admin.stats();
    }

    @GetMapping("/users")
    public List<User> users(@RequestParam(name = "role", required = false) String role) {
        return admin.users(role);
    }

    @GetMapping("/verifications")
    public List<User> verifications() {
        return admin.pendingVerifications();
    }

    @PostMapping("/administrators")
    public User createAdministrator(@RequestBody com.farmaya.model.Dtos.CreateAdminRequest req, @RequestAttribute("user") User me) {
        return admin.createAdmin(req, me);
    }

    @PostMapping("/users/{id}/verified")
    public User verified(@PathVariable("id") String id, @RequestBody FlagRequest f, @RequestAttribute("user") User me) {
        return admin.setVerified(id, f.value(), me);
    }

    @PostMapping("/users/{id}/enabled")
    public User enabled(@PathVariable("id") String id, @RequestBody FlagRequest f, @RequestAttribute("user") User me) {
        return admin.setEnabled(id, f.value(), me);
    }

    @PostMapping("/users/{id}/edit-permission")
    public User editPermission(@PathVariable("id") String id, @RequestBody FlagRequest f, @RequestAttribute("user") User me) {
        return admin.setEditPermission(id, f.value(), me);
    }

    @GetMapping("/orders")
    public List<Order> orders(@RequestParam(name = "status", required = false) String status) {
        return orders.listForAdmin(status);
    }

    @PostMapping("/orders/{id}/resolve")
    public Order resolve(@PathVariable("id") String id, @RequestAttribute("user") User me, @RequestBody ResolveRequest r) {
        return orders.resolveIncident(id, me, r.action(), r.note());
    }

    @PostMapping("/orders/{id}/cancel")
    public Order cancel(@PathVariable("id") String id, @RequestAttribute("user") User me, @RequestBody NoteRequest r) {
        return orders.cancelByAdmin(id, me, r.note());
    }
}
