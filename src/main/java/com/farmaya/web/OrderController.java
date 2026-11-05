package com.farmaya.web;

import com.farmaya.config.FarmaYaProperties;
import com.farmaya.model.Dtos;
import com.farmaya.model.Dtos.CreateOrderRequest;
import com.farmaya.model.Dtos.NoteRequest;
import com.farmaya.model.Order;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.service.OrderService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
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
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService orders;
    private final FarmaYaProperties props;

    public OrderController(OrderService orders, FarmaYaProperties props) {
        this.orders = orders;
        this.props = props;
    }

    @Public
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

    @Roles({Role.CLIENTE, Role.ADMIN})
    @GetMapping("/{id}/wompi-signature")
    public Map<String, Object> wompiSignature(@PathVariable String id, @RequestAttribute("user") User user) {
        Order o = orders.get(id, user);
        long amountInCents = Math.round((o.total != null ? o.total : 0.0) * 100);
        String currency = props.wompiCurrency() != null && !props.wompiCurrency().isBlank() ? props.wompiCurrency() : "COP";
        String baseRef = (o.code != null && !o.code.isBlank()) ? o.code : o.id;
        String reference = baseRef + "-" + (System.currentTimeMillis() / 1000);
        String secret = props.wompiIntegritySecret() != null ? props.wompiIntegritySecret() : "";

        String raw = reference + amountInCents + currency + secret;
        String signature = computeSha256(raw);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("reference", reference);
        res.put("amountInCents", amountInCents);
        res.put("currency", currency);
        res.put("publicKey", props.wompiPublicKey() != null && !props.wompiPublicKey().isBlank() ? props.wompiPublicKey() : "pub_test_tjFaTiEBqNnV6tjvh6QjeuEt2Jsa74bd");
        res.put("signature", signature);
        return res;
    }

    private static String computeSha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
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

    @Roles({Role.CLIENTE, Role.ADMIN})
    @PostMapping("/{id}/resend-invoice")
    public java.util.Map<String, Object> resendInvoice(@PathVariable String id, @RequestAttribute("user") User user) {
        orders.resendPaymentInvoice(id, user);
        return java.util.Map.of("ok", true, "message", "Factura electrónica y comprobante de pago enviados a tu correo.");
    }
}
