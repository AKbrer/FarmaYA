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
        return Map.of("zones", props.zones(), "statuses", statuses, "demo", props.seedDemo());
    }
}
