package com.farmaya.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OrderScheduler {
    private static final Logger log = LoggerFactory.getLogger(OrderScheduler.class);
    private final OrderService orders;

    public OrderScheduler(OrderService orders) {
        this.orders = orders;
    }

    @Scheduled(fixedDelay = 15_000, initialDelay = 20_000)
    public void sweep() {
        try {
            orders.sweep();
        } catch (Exception e) {
            log.warn("No se pudo revisar los pedidos pendientes", e);
        }
    }
}
