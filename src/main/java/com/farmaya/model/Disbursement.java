package com.farmaya.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("liquidaciones")
public class Disbursement {
    @Id
    public String id;

    @Indexed(unique = true)
    public String code;

    public String pharmacyId;
    public String pharmacyName;
    public String pharmacyEmail;
    public String pharmacyPhone;
    public String pharmacyCity;

    // Datos bancarios donde se transfirió
    public String bankName;
    public String accountType;
    public String accountNumber;
    public String accountHolder;
    public String accountDocNumber;

    // Pedidos liquidados
    public List<String> orderIds = new ArrayList<>();
    public List<String> orderCodes = new ArrayList<>();
    public int orderCount;

    // Cifras financieras en COP
    public Double grossTotal;          // Total ventas brutas de medicamentos
    public Double platformCommissionRate = 0.05; // 5% de comisión FarmaYA
    public Double platformEarnings;   // Monto retenido por FarmaYA (5%)
    public Double netAmount;          // Monto neto transferido a la farmacia (95%)

    // Detalles del desembolso
    public String reference;          // Comprobante bancario / Referencia de transferencia
    public String method = "TRANSFERENCIA_BANCARIA"; // "TRANSFERENCIA_BANCARIA", "WOMPI_PAYOUT", "ACH_AUTOMATICO"
    public String status = "COMPLETADO"; // "COMPLETADO", "PROCESANDO"
    public String notes;

    public String disbursedBy;        // Nombre o email del admin que ejecutó
    public Instant createdAt = Instant.now();
}
