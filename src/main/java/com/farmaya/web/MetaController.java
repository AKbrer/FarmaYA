package com.farmaya.web;

import com.farmaya.config.FarmaYaProperties;
import com.farmaya.model.OrderStatus;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/meta")
public class MetaController {
    private final FarmaYaProperties props;

    public MetaController(FarmaYaProperties props) {
        this.props = props;
    }

    @Public
    @GetMapping
    public Map<String, Object> meta() {
        Map<String, String> statuses = new LinkedHashMap<>();
        for (OrderStatus s : OrderStatus.values()) statuses.put(s.name(), s.label);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("zones", props.zones());
        res.put("statuses", statuses);
        res.put("demo", props.seedDemo());
        res.put("googleClientId", props.googleClientId() != null ? props.googleClientId() : "");
        res.put("wompiPublicKey", props.wompiPublicKey() != null && !props.wompiPublicKey().isBlank() ? props.wompiPublicKey() : "pub_test_X0zDA9xoKdePzhSGeVe9HAhes1ScGZqq");
        res.put("wompiCurrency", props.wompiCurrency() != null && !props.wompiCurrency().isBlank() ? props.wompiCurrency() : "COP");
        return res;
    }
}
