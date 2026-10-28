package com.farmaya.model;

/** Estados del pedido. El orden refleja el flujo normal; los últimos son alternativos. */
public enum OrderStatus {
    SOLICITUD_ENVIADA("Solicitud enviada"),
    BUSCANDO_FARMACIA("Buscando farmacia"),
    FARMACIA_ASIGNADA("Farmacia asignada"),
    PRECIO_POR_ACEPTAR("Precio por aceptar"),
    PRECIO_CONFIRMADO("Precio confirmado"),
    PEDIDO_EN_PREPARACION("Pedido en preparación"),
    PEDIDO_LISTO("Pedido listo"),
    BUSCANDO_REPARTIDOR("Buscando repartidor"),
    REPARTIDOR_ASIGNADO("Repartidor asignado"),
    PEDIDO_RECOGIDO("Pedido recogido"),
    EN_CAMINO("En camino"),
    ENTREGADO("Entregado"),
    RECHAZADA("Rechazada"),
    CANCELADA("Cancelada"),
    VENCIDA("Vencida"),
    CON_INCIDENCIA("Con incidencia");

    public final String label;

    OrderStatus(String label) {
        this.label = label;
    }
}
