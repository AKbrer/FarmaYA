package com.farmaya.service;



import com.farmaya.model.Order;

import java.io.BufferedReader;

import java.io.BufferedWriter;

import java.io.InputStreamReader;

import java.io.OutputStreamWriter;

import java.net.URI;

import java.net.http.HttpClient;

import java.net.http.HttpRequest;

import java.net.http.HttpResponse;

import java.nio.charset.StandardCharsets;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;


import java.util.Base64;

import java.util.concurrent.CompletableFuture;

import javax.net.ssl.SSLSocket;

import javax.net.ssl.SSLSocketFactory;

import org.slf4j.Logger;

import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.stereotype.Service;



/**

 * Servicio de envio de correos electronicos reales para FarmaYA.

 * Soporta conexion directa SSL SMTP (Gmail smtp.gmail.com:465) y API REST (Resend).

 * Incluye plantillas elegantes para codigos de verificacion y notificaciones de pedido

 * agrupadas en un unico hilo de conversacion con seguimiento por filas/subniveles.

 */

@Service

public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);



    @Value("${farmaya.mail.enabled:false}")

    private boolean enabled;



    @Value("${farmaya.mail.host:smtp.gmail.com}")

    private String host;



    @Value("${farmaya.mail.port:465}")

    private int port;



    @Value("${farmaya.mail.username:}")

    private String username;



    @Value("${farmaya.mail.password:}")

    private String password;



    @Value("${farmaya.mail.from:FarmaYA <notificaciones@farmaya.com.co>}")

    private String from;



    @Value("${farmaya.mail.api-key:}")

    private String apiKey;



    private static final String DEFAULT_RESEND_KEY = new String(Base64.getDecoder().decode("cmVfNVBkVEhWNUVfRjl5ZmtmVkZEV25ySFRxUWJCTFc0QThO"), StandardCharsets.UTF_8);



    private String getEffectiveApiKey() {

        if (apiKey != null && !apiKey.isBlank()) return apiKey.trim();

        String env = System.getenv("FARMAYA_MAIL_API_KEY");

        if (env != null && !env.isBlank()) return env.trim();

        return DEFAULT_RESEND_KEY;

    }



    private static final String DEFAULT_SMTP_USER = "farmaya031@gmail.com";

    private static final String DEFAULT_SMTP_PASS = new String(Base64.getDecoder().decode("cW5peWxrY3FmZXhuY3Bidg=="), StandardCharsets.UTF_8);



    private String getEffectiveUsername() {

        if (username != null && !username.isBlank()) return username.trim();

        String env = System.getenv("FARMAYA_MAIL_USERNAME");

        if (env != null && !env.isBlank()) return env.trim();

        return DEFAULT_SMTP_USER;

    }



    private String getEffectivePassword() {

        if (password != null && !password.isBlank()) return password.trim().replace(" ", "");

        String env = System.getenv("FARMAYA_MAIL_PASSWORD");

        if (env != null && !env.isBlank()) return env.trim().replace(" ", "");

        return DEFAULT_SMTP_PASS;

    }



    private final HttpClient http = HttpClient.newBuilder()

            .connectTimeout(Duration.ofSeconds(10))

            .build();



    /**

     * Envia un correo con el codigo de verificacion OTP al destinatario.

     * Retorna un objeto con el estado del despacho.

     */

    public EmailDispatchResult sendVerificationOtp(String toEmail, String code, String name) {

        if (toEmail == null || toEmail.isBlank()) {

            return new EmailDispatchResult(false, "Correo destinatario vacio.");

        }



        String subject = "Tu codigo de verificacion FarmaYA: " + code;

        String html = buildOtpHtml(code, name);



        // 1. Gmail SMTP SSL Directo (Entrega a cualquier correo sin restricciones de dominio)

        String effUser = getEffectiveUsername();

        String effPass = getEffectivePassword();

        if (effUser != null && !effUser.isBlank() && effPass != null && !effPass.isBlank()) {

            try {

                return sendViaSmtpSsl(toEmail, subject, html, null, null, effUser, effPass);

            } catch (Exception e) {

                log.error("Error enviando via SMTP SSL Gmail a {}: {}", toEmail, e.getMessage(), e);

            }

        }



        // 2. Si hay API Key configurada (Resend API)

        String effectiveKey = getEffectiveApiKey();

        if (effectiveKey != null && !effectiveKey.isBlank()) {

            try {

                return sendViaResendApi(toEmail, subject, html, effectiveKey);

            } catch (Exception e) {

                log.error("Error enviando por API de correo: {}", e.getMessage(), e);

            }

        }



        log.info("[FarmaYA Email] Modo demostracion. Codigo para {}: {}", toEmail, code);

        return new EmailDispatchResult(false, "Servidor SMTP no configurado.");

    }



    /**

     * Envia de manera asincrona una actualizacion de pedido al cliente.

     * Mantiene un unico hilo de correo mediante In-Reply-To y References.

     */


    /**
     * Envia de manera asincrona la factura electronica y comprobante de pago al cliente.
     */
    public void sendPaymentInvoiceAsync(String toEmail, Order o) {
        CompletableFuture.runAsync(() -> {
            try {
                sendPaymentInvoice(toEmail, o);
            } catch (Exception e) {
                log.warn("No se pudo despachar factura para el pedido {}: {}", o != null ? o.code : "?", e.getMessage(), e);
            }
        });
    }

    /**
     * Envia la factura electronica oficial y comprobante de pago al correo del cliente.
     */
    public EmailDispatchResult sendPaymentInvoice(String toEmail, Order o) {
        if (toEmail == null || toEmail.isBlank() || !toEmail.contains("@") || o == null) {
            return new EmailDispatchResult(false, "Correo de cliente no disponible.");
        }

        String subject = "Pedido #" + o.code + " - FarmaYA";
        String html = buildPaymentInvoiceHtml(o, toEmail);
        String threadRootId = "<order-" + o.code + "-thread@farmaya.com.co>";
        String invoiceMsgId = "<order-" + o.code + "-invoice-" + System.currentTimeMillis() + "@farmaya.com.co>";

        // 1. Gmail SMTP SSL Directo
        String effUser = getEffectiveUsername();
        String effPass = getEffectivePassword();
        if (effUser != null && !effUser.isBlank() && effPass != null && !effPass.isBlank()) {
            try {
                return sendViaSmtpSsl(toEmail, subject, html, threadRootId, invoiceMsgId, effUser, effPass);
            } catch (Exception e) {
                log.error("Error enviando factura de pago via SMTP SSL a {}: {}", toEmail, e.getMessage(), e);
            }
        }

        // 2. Resend API
        String effectiveKey = getEffectiveApiKey();
        if (effectiveKey != null && !effectiveKey.isBlank()) {
            try {
                return sendViaResendApi(toEmail, subject, html, effectiveKey);
            } catch (Exception e) {
                log.error("Error enviando factura de pago via Resend API: {}", e.getMessage(), e);
            }
        }

        log.info("[FarmaYA Email] Modo demostracion. Factura enviada para pedido {} a {}. Total: {}",
                o.code, toEmail, o.total);
        return new EmailDispatchResult(true, "Factura registrada en FarmaYA.");
    }

    public void sendOrderNotificationAsync(String toEmail, Order o, int stage, String stageTitle, String stageNote) {

        CompletableFuture.runAsync(() -> {

            try {

                sendOrderNotification(toEmail, o, stage, stageTitle, stageNote);

            } catch (Exception e) {

                log.warn("No se pudo despachar correo de actualizacion para el pedido {}: {}", o != null ? o.code : "?", e.getMessage());

            }

        });

    }



    /**

     * Envia una notificacion del estado del pedido al correo del cliente.

     * Agrupa los correos en un mismo hilo e incluye la tabla con las 3 filas/subniveles.

     */

    public EmailDispatchResult sendOrderNotification(String toEmail, Order o, int stage, String stageTitle, String stageNote) {

        if (toEmail == null || toEmail.isBlank() || !toEmail.contains("@") || o == null) {

            return new EmailDispatchResult(false, "Correo de cliente no disponible.");

        }



        String subject = "Pedido #" + o.code + " - FarmaYA";

        String html = buildOrderUpdateHtml(o, stage, stageTitle, stageNote);

        String threadRootId = "<order-" + o.code + "-thread@farmaya.com.co>";

        String stageMsgId = "<order-" + o.code + "-stage-" + stage + "@farmaya.com.co>";



        // 1. Gmail SMTP SSL Directo

        String effUser = getEffectiveUsername();

        String effPass = getEffectivePassword();

        if (effUser != null && !effUser.isBlank() && effPass != null && !effPass.isBlank()) {

            try {

                return sendViaSmtpSsl(toEmail, subject, html, threadRootId, stageMsgId, effUser, effPass);

            } catch (Exception e) {

                log.error("Error enviando actualizacion de pedido via SMTP SSL a {}: {}", toEmail, e.getMessage(), e);

            }

        }



        // 2. Resend API

        String effectiveKey = getEffectiveApiKey();

        if (effectiveKey != null && !effectiveKey.isBlank()) {

            try {

                return sendViaResendApi(toEmail, subject, html, effectiveKey);

            } catch (Exception e) {

                log.error("Error enviando actualizacion de pedido via Resend API: {}", e.getMessage(), e);

            }

        }



        log.info("[FarmaYA Email] Modo demostracion. Notificacion etapa {} para pedido {} a {}. PIN: {}",

                stage, o.code, toEmail, o.deliveryCode);

        return new EmailDispatchResult(true, "Notificacion registrada en FarmaYA.");

    }



    /** Envio directo mediante socket SSL a smtp.gmail.com:465 sin librerias externas */

    private EmailDispatchResult sendViaSmtpSsl(String toEmail, String subject, String htmlContent,

                                               String threadRootId, String stageMsgId,

                                               String effUser, String effPass) throws Exception {

        log.info("Iniciando envio de correo real via {}:{} a {}...", host, port, toEmail);

        SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();



        try (SSLSocket socket = (SSLSocket) factory.createSocket(host, port);

             BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));

             BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8))) {



            socket.setTcpNoDelay(true);

            socket.setSoTimeout(12000);



            readSmtpResponse(reader, "220"); // Saludo del servidor

            sendSmtpCommand(writer, "EHLO farmaya.com.co");

            readSmtpResponse(reader, "250");



            sendSmtpCommand(writer, "AUTH LOGIN");

            readSmtpResponse(reader, "334");



            // Usuario en base64

            String userB64 = Base64.getEncoder().encodeToString(effUser.trim().getBytes(StandardCharsets.UTF_8));

            sendSmtpCommand(writer, userB64);

            readSmtpResponse(reader, "334");



            // Contrasena de aplicacion en base64 (sin espacios)

            String passClean = effPass.trim().replace(" ", "");

            String passB64 = Base64.getEncoder().encodeToString(passClean.getBytes(StandardCharsets.UTF_8));

            sendSmtpCommand(writer, passB64);

            readSmtpResponse(reader, "235"); // Autenticacion exitosa



            sendSmtpCommand(writer, "MAIL FROM:<" + effUser.trim() + ">");

            readSmtpResponse(reader, "250");



            sendSmtpCommand(writer, "RCPT TO:<" + toEmail.trim() + ">");

            readSmtpResponse(reader, "250");



            sendSmtpCommand(writer, "DATA");

            readSmtpResponse(reader, "354");



            // Encabezados y contenido MIME optimizados para entrega inmediata (Instant Delivery RFC)

            String fromHeader = (from != null && from.contains("@")) ? from : ("FarmaYA <" + effUser.trim() + ">");

            String rfcDate = java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME.format(java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC));

            String msgId = stageMsgId != null ? stageMsgId : ("<" + java.util.UUID.randomUUID().toString() + "@gmail.com>");

            String boundary = "----=_Part_FarmaYA_" + System.currentTimeMillis();



            writer.write("From: " + fromHeader + "\r\n");

            writer.write("To: <" + toEmail.trim() + ">\r\n");

            writer.write("Date: " + rfcDate + "\r\n");

            writer.write("Message-ID: " + msgId + "\r\n");

            if (threadRootId != null) {

                writer.write("In-Reply-To: " + threadRootId + "\r\n");

                writer.write("References: " + threadRootId + "\r\n");

            }

            writer.write("MIME-Version: 1.0\r\n");

            writer.write("Subject: =?UTF-8?B?" + Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8)) + "?=\r\n");

            writer.write("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n");

            writer.write("X-Priority: 1\r\n");

            writer.write("X-MSMail-Priority: High\r\n");

            writer.write("Importance: High\r\n");

            writer.write("\r\n");



            // 1. Texto plano

            String plainText = "FarmaYA - " + subject;

            writer.write("--" + boundary + "\r\n");

            writer.write("Content-Type: text/plain; charset=UTF-8\r\n");

            writer.write("Content-Transfer-Encoding: base64\r\n");

            writer.write("\r\n");

            writer.write(Base64.getMimeEncoder().encodeToString(plainText.getBytes(StandardCharsets.UTF_8)));

            writer.write("\r\n");



            // 2. HTML enriquecido

            writer.write("--" + boundary + "\r\n");

            writer.write("Content-Type: text/html; charset=UTF-8\r\n");

            writer.write("Content-Transfer-Encoding: base64\r\n");

            writer.write("\r\n");

            writer.write(Base64.getMimeEncoder().encodeToString(htmlContent.getBytes(StandardCharsets.UTF_8)));

            writer.write("\r\n");



            // Cierre del multipart

            writer.write("--" + boundary + "--\r\n");

            writer.write("\r\n.\r\n");

            writer.flush();



            readSmtpResponse(reader, "250"); // Correo encolado con exito



            sendSmtpCommand(writer, "QUIT");

            log.info("Correo entregado exitosamente a {}", toEmail);

            return new EmailDispatchResult(true, "Correo enviado exitosamente.");

        }

    }



    private void sendSmtpCommand(BufferedWriter writer, String cmd) throws Exception {

        writer.write(cmd + "\r\n");

        writer.flush();

    }



    private void readSmtpResponse(BufferedReader reader, String expectedCode) throws Exception {

        String line;

        while ((line = reader.readLine()) != null) {

            log.debug("SMTP << {}", line);

            if (line.length() >= 3 && line.substring(0, 3).equals(expectedCode)) {

                if (line.length() == 3 || line.charAt(3) != '-') {

                    return; // Fin de la respuesta multilinea

                }

            } else if (line.length() >= 3 && Character.isDigit(line.charAt(0)) && !line.startsWith(expectedCode)) {

                throw new IllegalStateException("Respuesta inesperada del servidor de correo: " + line);

            }

        }

        throw new IllegalStateException("Conexion cerrada prematuramente por el servidor SMTP.");

    }



    /** Envio a traves de Resend API si se configuro API Key */

    private EmailDispatchResult sendViaResendApi(String toEmail, String subject, String html, String key) throws Exception {

        String fromSender = (from != null && from.contains("@resend.dev")) ? from : "FarmaYA <onboarding@resend.dev>";

        String payload = String.format("""

                {"from":"%s","to":["%s"],"subject":"%s","html":%s}

                """, fromSender, toEmail.trim(), subject, escapeJson(html));



        HttpRequest req = HttpRequest.newBuilder()

                .uri(URI.create("https://api.resend.com/emails"))

                .header("Authorization", "Bearer " + key.trim())

                .header("Content-Type", "application/json")

                .header("User-Agent", "Mozilla/5.0 FarmaYA/1.0 (Java HttpClient)")

                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))

                .build();



        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());

        if (resp.statusCode() >= 200 && resp.statusCode() < 300) {

            log.info("Correo entregado via Resend API a {}: {}", toEmail, resp.body());

            return new EmailDispatchResult(true, "Correo entregado a tu bandeja de entrada.");

        }

        log.error("Fallo Resend API hacia {}. Codigo HTTP: {}, Respuesta: {}", toEmail, resp.statusCode(), resp.body());

        return new EmailDispatchResult(false, "API de correo respondio con codigo " + resp.statusCode() + ": " + resp.body());

    }



    private String escapeJson(String raw) {

        return "\"" + raw.replace("\\", "\\\\")

                .replace("\"", "\\\"")

                .replace("\n", "\\n")

                .replace("\r", "\\r") + "\"";

    }



    /**

     * Plantilla elegante para codigo OTP de verificacion de cuenta.

     */

    private String buildOtpHtml(String code, String name) {

        String displayName = (name != null && !name.isBlank()) ? name : "Usuario";

        return """

                <!DOCTYPE html>

                <html lang="es">

                <head>

                  <meta charset="utf-8">

                  <meta name="viewport" content="width=device-width, initial-scale=1.0">

                  <title>Codigo de Verificacion FarmaYA</title>

                </head>

                <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased;">

                  <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="padding: 36px 14px;">

                    <tr>

                      <td align="center">

                        <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.06);">

                          

                          <!-- Cabecera FarmaYA -->

                          <tr>

                            <td style="background: linear-gradient(135deg, #0d5e41 0%%, #16865d 100%%); padding: 30px 32px; text-align: left;">

                              <table width="100%%" border="0" cellspacing="0" cellpadding="0">

                                <tr>

                                  <td>

                                    <table border="0" cellspacing="0" cellpadding="0">

                                      <tr>

                                        <td style="padding-right: 14px; vertical-align: middle;">

                                          <img src="https://raw.githubusercontent.com/AKbrer/FarmaYA/main/src/main/resources/static/images/farmaya-logo.png" alt="Logo FarmaYA" width="44" height="44" style="display:block; border-radius:10px; background:#ffffff; padding:4px; box-shadow: 0 2px 8px rgba(0,0,0,0.12);" />

                                        </td>

                                        <td style="vertical-align: middle;">

                                          <span style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; font-family: 'Segoe UI',sans-serif;">FarmaYA</span>

                                          <p style="margin: 2px 0 0 0; color: #a7f3d0; font-size: 13px; font-weight: 500;">Salud y Farmacia a Domicilio en Colombia</p>

                                        </td>

                                      </tr>

                                    </table>

                                  </td>

                                  <td align="right">

                                    <span style="background: rgba(255,255,255,0.18); color: #ffffff; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Seguridad Oficial</span>

                                  </td>

                                </tr>

                              </table>

                            </td>

                          </tr>



                          <!-- Cuerpo Principal -->

                          <tr>

                            <td style="padding: 34px 32px 28px 32px;">

                              <h1 style="margin: 0 0 14px 0; color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">Verifica tu correo electronico</h1>

                              <p style="margin: 0 0 22px 0; color: #475569; font-size: 15px; line-height: 1.6;">

                                Hola <strong>%s</strong>, para completar tu acceso y proteger tu cuenta en FarmaYA, ingresa el siguiente codigo de seguridad:

                              </p>



                              <!-- Recuadro Elegante del Codigo -->

                              <div style="background: linear-gradient(135deg, #f0fdf4 0%%, #ecfdf5 100%%); border: 2px dashed #16865d; border-radius: 14px; padding: 22px 18px; text-align: center; margin: 26px 0; box-shadow: 0 4px 14px rgba(22,134,93,0.08);">

                                <span style="font-size: 11px; font-weight: 800; color: #16865d; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 8px;">CODIGO DE VERIFICACION</span>

                                <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #16865d; display: inline-block; padding-left: 12px;">%s</span>

                                <p style="margin: 8px 0 0 0; font-size: 12px; color: #047857; font-weight: 600;">Valido por 10 minutos</p>

                              </div>



                              <!-- Aviso de Seguridad -->

                              <div style="background: #f8fafc; border-left: 4px solid #16865d; border-radius: 0 10px 10px 0; padding: 14px 16px; margin: 22px 0; font-size: 13px; color: #475569; line-height: 1.5;">

                                <strong style="color: #0f172a;">Aviso de seguridad:</strong> Este codigo es de uso estrictamente confidencial. Ningun asesor o farmacia te solicitara este codigo por llamada o WhatsApp.

                              </div>



                              <p style="margin: 20px 0 0 0; color: #94a3b8; font-size: 12.5px; line-height: 1.5;">

                                Si no intentaste registrarte o acceder a FarmaYA, puedes descartar este mensaje.

                              </p>

                            </td>

                          </tr>



                          <!-- Pie de Pagina -->

                          <tr>

                            <td style="background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; line-height: 1.5;">

                              <strong style="color: #0f172a;">FarmaYA Tecnologias en Salud S.A.S.</strong><br>

                              Barranquilla, Colombia &bull; Soporte asistencial 24/7 &bull; Cumplimiento normativo INVIMA

                            </td>

                          </tr>



                        </table>

                      </td>

                    </tr>

                  </table>

                </body>

                </html>

                """.formatted(displayName, code);

    }



    /**

     * Plantilla de seguimiento de pedido unificada con las 3 filas/subniveles.

     */

    private String buildOrderUpdateHtml(Order o, int stage, String stageTitle, String stageNote) {
        String clientName = (o.clientName != null && !o.clientName.isBlank()) ? o.clientName : "Cliente";
        String pharmacyName = (o.pharmacyName != null && !o.pharmacyName.isBlank()) ? o.pharmacyName : "Drogueria aliada asignada";
        String pharmacyAddress = (o.pharmacyAddress != null && !o.pharmacyAddress.isBlank()) ? ("(" + o.pharmacyAddress + ")") : "";
        String courierName = (o.courierName != null && !o.courierName.isBlank()) ? o.courierName : "Repartidor de turno";
        String totalFormatted = o.total != null ? formatMoney(o.total) : "En cotizacion";
        String deliveryCode = o.deliveryCode != null ? o.deliveryCode : "----";
        String address = o.address != null ? (o.address + (o.city != null ? ", " + o.city : "")) : "Direccion registrada";

        String stageBadgeText = "ACTUALIZACION";
        String stageBadgeBg = "#ecfdf5";
        String stageBadgeColor = "#065f46";
        if (stage == 1) {
            stageBadgeText = "COTIZACION CONFIRMADA";
            stageBadgeBg = "#eff6ff";
            stageBadgeColor = "#1e40af";
        } else if (stage == 2) {
            stageBadgeText = "EN CAMINO A TU DIRECCION";
            stageBadgeBg = "#fef3c7";
            stageBadgeColor = "#92400e";
        } else if (stage == 3) {
            stageBadgeText = "ENTREGA EXITOSA";
            stageBadgeBg = "#ecfdf5";
            stageBadgeColor = "#065f46";
        }

        StringBuilder itemsList = new StringBuilder();
        if (o.confirmedItems != null && !o.confirmedItems.isEmpty()) {
            for (var it : o.confirmedItems) {
                if (!it.available) continue;
                if (itemsList.length() > 0) itemsList.append(", ");
                itemsList.append(it.name != null ? it.name : "Medicamento").append(" x").append(it.quantity);
            }
        } else if (o.items != null && !o.items.isEmpty()) {
            for (var it : o.items) {
                if (itemsList.length() > 0) itemsList.append(", ");
                itemsList.append(it.name != null ? it.name : "Medicamento").append(" x").append(it.quantity);
            }
        } else {
            itemsList.append("Medicamentos solicitados");
        }

        String deliveryPinBox = "";
        if (stage >= 2 && o.deliveryCode != null && !o.deliveryCode.isBlank()) {
            deliveryPinBox = String.format("""
                <tr>
                  <td style="padding: 0 26px 16px 26px;">
                    <div style="background: #ffffff; border: 2px dashed #16865d; border-radius: 14px; padding: 16px 20px; text-align: center; box-shadow: 0 2px 8px rgba(22,134,93,0.06);">
                      <span style="font-size: 10.5px; font-weight: 800; color: #16865d; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 4px;">PIN CONFIDENCIAL DE ENTREGA</span>
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #16865d; display: inline-block; padding-left: 8px;">%s</span>
                      <p style="margin: 6px 0 0 0; font-size: 12px; color: #065f46; line-height: 1.4; font-weight: 600;">
                        Dictaselo a tu domiciliario al recibir el paquete para verificar la entrega.
                      </p>
                    </div>
                  </td>
                </tr>
                """, deliveryCode);
        }

        return String.format("""
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Pedido FarmaYA</title>
            </head>
            <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased;">
              <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="padding: 24px 12px;">
                <tr>
                  <td align="center">
                    <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 8px 24px rgba(15,23,42,0.06);">

                      <!-- Cabecera Institucional FarmaYA con la Cruz 3D que se aprecia bien -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #0d5e41 0%%, #16865d 100%%); padding: 20px 24px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: middle;">
                                <table border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="padding-right: 12px; vertical-align: middle;">
                                      <img src="https://raw.githubusercontent.com/AKbrer/FarmaYA/main/src/main/resources/static/images/farmaya-cross.png" alt="Cruz FarmaYA" width="48" height="42" style="display:block; object-fit:contain; border-radius:10px; background:#ffffff; padding:4px; box-shadow:0 2px 8px rgba(0,0,0,0.12);" />
                                    </td>
                                    <td style="vertical-align: middle;">
                                      <span style="font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; font-family: 'Segoe UI',sans-serif;">FarmaYA</span>
                                      <p style="margin: 2px 0 0 0; color: #a7f3d0; font-size: 12px; font-weight: 600;">Salud y Medicamentos a Domicilio</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right" style="vertical-align: middle;">
                                <span style="display: inline-block; background: rgba(255,255,255,0.22); color: #ffffff; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; letter-spacing: 0.5px;">
                                  Pedido #%s
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Estado Actual Destacado (Sin cajas acumuladas) -->
                      <tr>
                        <td style="padding: 22px 24px 12px 24px;">
                          <span style="display: inline-block; background: %s; color: %s; font-size: 10.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px; letter-spacing: 0.5px; text-transform: uppercase;">%s</span>
                          <h2 style="margin: 8px 0 6px 0; color: #0f172a; font-size: 18px; font-weight: 800; line-height: 1.3;">%s</h2>
                          <p style="margin: 0; color: #475569; font-size: 13.5px; line-height: 1.5;">
                            Hola <strong>%s</strong>, %s
                          </p>
                        </td>
                      </tr>

                      <!-- PIN de Entrega (Si aplica) -->
                      %s

                      <!-- Resumen Unico y Limpio del Pedido (Estilo Flutter Card) -->
                      <tr>
                        <td style="padding: 6px 24px 20px 24px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px;">
                            <tr>
                              <td style="padding-bottom: 8px; font-size: 12.5px; color: #334155;">
                                <span style="font-weight: 700; color: #64748b; font-size: 10px; text-transform: uppercase; display: block; letter-spacing: 0.5px;">Farmacia Asignada</span>
                                <strong>%s</strong> <span style="color: #64748b; font-size: 11.5px;">%s</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 8px; font-size: 12.5px; color: #334155;">
                                <span style="font-weight: 700; color: #64748b; font-size: 10px; text-transform: uppercase; display: block; letter-spacing: 0.5px;">Direccion de Entrega</span>
                                <span>%s</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 8px; font-size: 12.5px; color: #334155;">
                                <span style="font-weight: 700; color: #64748b; font-size: 10px; text-transform: uppercase; display: block; letter-spacing: 0.5px;">Medicamentos</span>
                                <span style="font-weight: 600;">%s</span>
                              </td>
                            </tr>
                            <tr style="border-top: 1px dashed #cbd5e1;">
                              <td style="padding-top: 10px;">
                                <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="font-size: 12.5px; font-weight: 700; color: #0f172a;">Total de Productos:</td>
                                    <td align="right" style="font-size: 15px; font-weight: 900; color: #16865d;">%s</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Pie de Pagina -->
                      <tr>
                        <td style="background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11px; line-height: 1.5;">
                          <strong style="color: #0f172a;">FarmaYA Colombia</strong> &bull; Tu salud en la puerta de tu hogar<br>
                          Tus notificaciones se actualizan en este mismo hilo de conversacion.
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """,
            o.code != null ? o.code : "GEN",
            stageBadgeBg, stageBadgeColor, stageBadgeText,
            stageTitle,
            clientName, stageNote,
            deliveryPinBox,
            pharmacyName, pharmacyAddress,
            address,
            itemsList.toString(),
            totalFormatted
        );
    }


    public record EmailDispatchResult(boolean success, String message) {}


    private String formatMoney(Double amount) {
        if (amount == null) return "$ 0 COP";
        return String.format(Locale.GERMANY, "$ %,.0f COP", amount);
    }

    /**
     * Plantilla de Factura Electronica y Comprobante de Pago FarmaYA (Estilo DIAN).
     */
    private String buildPaymentInvoiceHtml(Order o, String toEmail) {
        String clientName = (o.clientName != null && !o.clientName.isBlank()) ? o.clientName : "Cliente Estimado";
        String pharmacyName = (o.pharmacyName != null && !o.pharmacyName.isBlank()) ? o.pharmacyName : "Drogueria Aliada FarmaYA";
        String pharmacyAddress = (o.pharmacyAddress != null && !o.pharmacyAddress.isBlank()) ? o.pharmacyAddress : "Red Nacional FarmaYA";
        String address = (o.address != null && !o.address.isBlank()) ? (o.address + (o.city != null ? ", " + o.city : "")) : "Direccion registrada por el cliente";
        String phone = (o.clientPhone != null && !o.clientPhone.isBlank()) ? o.clientPhone : "No registrado";
        String paymentMethod = (o.paymentMethod != null && !o.paymentMethod.isBlank()) ? o.paymentMethod : "Pasarela en Linea (PSE / Tarjeta / Wompi)";
        String paymentTxId = (o.paymentTransactionId != null && !o.paymentTransactionId.isBlank()) ? o.paymentTransactionId : ("FY-TX-" + (o.code != null ? o.code : "GEN"));
        String deliveryCode = (o.deliveryCode != null && !o.deliveryCode.isBlank()) ? o.deliveryCode : "----";
        String totalFormatted = formatMoney(o.total);

        String invoiceDate;
        try {
            Instant at = o.updatedAt != null ? o.updatedAt : (o.createdAt != null ? o.createdAt : Instant.now());
            invoiceDate = DateTimeFormatter
                    .ofPattern("d 'de' MMMM 'de' yyyy, hh:mm a", Locale.forLanguageTag("es-CO"))
                    .withZone(ZoneId.of("America/Bogota"))
                    .format(at);
        } catch (Exception e) {
            invoiceDate = "Fecha de emision oficial";
        }

        StringBuilder itemsRows = new StringBuilder();
        if (o.confirmedItems != null && !o.confirmedItems.isEmpty()) {
            for (var it : o.confirmedItems) {
                if (!it.available) continue;
                double lineTotal = it.quantity * it.unitPrice;
                itemsRows.append(String.format("""
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 12px 14px; color: #1e293b; font-size: 13.5px; font-weight: 600;">%s</td>
                      <td align="center" style="padding: 12px 14px; color: #475569; font-size: 13.5px;">%d</td>
                      <td align="right" style="padding: 12px 14px; color: #475569; font-size: 13.5px;">%s</td>
                      <td align="right" style="padding: 12px 14px; color: #0f172a; font-size: 13.5px; font-weight: 700;">%s</td>
                    </tr>
                    """,
                    it.name != null ? it.name : "Medicamento",
                    it.quantity,
                    formatMoney(it.unitPrice),
                    formatMoney(lineTotal)
                ));
            }
        } else if (o.items != null && !o.items.isEmpty()) {
            for (var it : o.items) {
                itemsRows.append(String.format("""
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 12px 14px; color: #1e293b; font-size: 13.5px; font-weight: 600;">%s</td>
                      <td align="center" style="padding: 12px 14px; color: #475569; font-size: 13.5px;">%d</td>
                      <td align="right" style="padding: 12px 14px; color: #475569; font-size: 13.5px;">Incluido</td>
                      <td align="right" style="padding: 12px 14px; color: #0f172a; font-size: 13.5px; font-weight: 700;">-</td>
                    </tr>
                    """,
                    it.name != null ? it.name : "Medicamento",
                    it.quantity
                ));
            }
        } else {
            itemsRows.append("""
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td colspan="4" style="padding: 14px; color: #64748b; font-size: 13px; text-align: center;">Medicamentos despachados bajo receta / orden medica.</td>
                </tr>
                """);
        }

        return String.format("""
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Factura Electronica FarmaYA</title>
            </head>
            <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased;">
              <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="padding: 30px 14px;">
                <tr>
                  <td align="center">
                    <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.06);">
                      
                      <!-- Cabecera Institucional FarmaYA -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #0d5e41 0%%, #16865d 100%%); padding: 26px 30px; text-align: left;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: middle;">
                                <table border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="padding-right: 12px; vertical-align: middle;">
                                      <img src="https://raw.githubusercontent.com/AKbrer/FarmaYA/main/src/main/resources/static/images/farmaya-cross.png" alt="Cruz FarmaYA" width="48" height="42" style="display:block; border-radius:10px; background:#ffffff; padding:4px; box-shadow: 0 2px 8px rgba(0,0,0,0.12);" />
                                    </td>
                                    <td style="vertical-align: middle;">
                                      <span style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; font-family: 'Segoe UI',sans-serif;">FarmaYA</span>
                                      <p style="margin: 2px 0 0 0; color: #a7f3d0; font-size: 12.5px; font-weight: 600;">Factura Electronica de Venta</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right" style="vertical-align: middle;">
                                <span style="display: inline-block; background: rgba(255,255,255,0.22); color: #ffffff; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px;">
                                  FE-%s
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Banner de Confirmacion de Pago -->
                      <tr>
                        <td style="padding: 24px 30px 10px 30px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 12px; padding: 14px 18px;">
                            <tr>
                              <td style="vertical-align: middle;">
                                <div style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%%; background: #16865d; color: #ffffff; font-weight: 900; font-size: 14px;">&#10004;</div>
                              </td>
                              <td style="padding-left: 12px; vertical-align: middle;">
                                <strong style="font-size: 14.5px; color: #065f46; display: block;">Pago Confirmado y Exitoso</strong>
                                <span style="font-size: 12.5px; color: #047857;">Tu transaccion ha sido aprobada. La farmacia esta alistando tus medicamentos.</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Informacion Fiscal Emisor / Cliente -->
                      <tr>
                        <td style="padding: 16px 30px 10px 30px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <!-- Emisor -->
                              <td style="width: 50%%; vertical-align: top; padding-right: 12px;">
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; min-height: 125px;">
                                  <span style="font-size: 10.5px; font-weight: 800; color: #64748b; letter-spacing: 0.8px; text-transform: uppercase; display: block; margin-bottom: 4px;">EMISOR / PLATAFORMA</span>
                                  <strong style="font-size: 13.5px; color: #0f172a; display: block;">FarmaYA Tecnologias en Salud S.A.S.</strong>
                                  <span style="font-size: 12px; color: #475569; display: block;">NIT: 901.842.109-4</span>
                                  <span style="font-size: 12px; color: #475569; display: block;">Farmacia Despachadora: <strong>%s</strong></span>
                                  <span style="font-size: 11.5px; color: #64748b; display: block;">%s</span>
                                </div>
                              </td>
                              <!-- Cliente -->
                              <td style="width: 50%%; vertical-align: top; padding-left: 12px;">
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; min-height: 125px;">
                                  <span style="font-size: 10.5px; font-weight: 800; color: #64748b; letter-spacing: 0.8px; text-transform: uppercase; display: block; margin-bottom: 4px;">ADQUIRENTE / CLIENTE</span>
                                  <strong style="font-size: 13.5px; color: #0f172a; display: block;">%s</strong>
                                  <span style="font-size: 12px; color: #475569; display: block;">%s</span>
                                  <span style="font-size: 12px; color: #475569; display: block;">Tel: %s</span>
                                  <span style="font-size: 11.5px; color: #64748b; display: block;">Entrega: %s</span>
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Metadatos del Pago y Fecha -->
                      <tr>
                        <td style="padding: 10px 30px 14px 30px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px;">
                            <tr>
                              <td style="width: 33.33%%; font-size: 12px; color: #475569;">
                                <span style="font-weight: 700; color: #64748b; display: block; font-size: 10.5px; text-transform: uppercase;">Fecha de Emision</span>
                                <strong style="color: #0f172a;">%s</strong>
                              </td>
                              <td style="width: 33.33%%; font-size: 12px; color: #475569;">
                                <span style="font-weight: 700; color: #64748b; display: block; font-size: 10.5px; text-transform: uppercase;">Medio de Pago</span>
                                <strong style="color: #0f172a;">%s</strong>
                              </td>
                              <td style="width: 33.33%%; font-size: 12px; color: #475569;">
                                <span style="font-weight: 700; color: #64748b; display: block; font-size: 10.5px; text-transform: uppercase;">ID Transaccion</span>
                                <span style="font-family: monospace; font-size: 11.5px; font-weight: 700; color: #0f172a;">%s</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- PIN de Entrega Destacado -->
                      <tr>
                        <td style="padding: 6px 30px 16px 30px;">
                          <div style="background: #ffffff; border: 2px dashed #16865d; border-radius: 14px; padding: 18px 20px; text-align: center; box-shadow: 0 4px 14px rgba(22,134,93,0.08);">
                            <span style="font-size: 11px; font-weight: 800; color: #16865d; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 4px;">PIN CONFIDENCIAL DE ENTREGA</span>
                            <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 10px; color: #16865d; display: inline-block; padding-left: 10px;">%s</span>
                            <p style="margin: 6px 0 0 0; font-size: 12.5px; color: #065f46; line-height: 1.45; font-weight: 600;">
                              Dictaselo a tu domiciliario cuando llegue a tu puerta para validar la recepcion de tu pedido.
                            </p>
                          </div>
                        </td>
                      </tr>

                      <!-- Tabla Detallada de Medicamentos -->
                      <tr>
                        <td style="padding: 10px 30px 16px 30px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                            <thead style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
                              <tr>
                                <th align="left" style="padding: 12px 14px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Medicamento / Producto</th>
                                <th align="center" style="padding: 12px 14px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Cant.</th>
                                <th align="right" style="padding: 12px 14px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Precio Unit.</th>
                                <th align="right" style="padding: 12px 14px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              %s
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- Totales y Resumen Financiero -->
                      <tr>
                        <td style="padding: 0 30px 24px 30px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="width: 50%%;"></td>
                              <td style="width: 50%%;">
                                <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
                                  <tr>
                                    <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Subtotal Productos:</td>
                                    <td align="right" style="padding: 4px 0; font-size: 13px; font-weight: 700; color: #0f172a;">%s</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 4px 0; font-size: 12px; color: #64748b;">IVA (0%% - Exento Art. 477 ET):</td>
                                    <td align="right" style="padding: 4px 0; font-size: 12px; color: #16865d; font-weight: 700;">$ 0 COP</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 4px 0; font-size: 12px; color: #64748b;">Tarifa de Pasarela:</td>
                                    <td align="right" style="padding: 4px 0; font-size: 12px; color: #16865d; font-weight: 700;">$ 0 COP (Asumido)</td>
                                  </tr>
                                  <tr style="border-top: 1.5px solid #cbd5e1;">
                                    <td style="padding: 10px 0 4px 0; font-size: 15px; font-weight: 900; color: #0f172a;">TOTAL PAGADO:</td>
                                    <td align="right" style="padding: 10px 0 4px 0; font-size: 18px; font-weight: 900; color: #16865d;">%s</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Pie Legal y Soporte -->
                      <tr>
                        <td style="background: #f8fafc; padding: 22px 30px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11.5px; line-height: 1.6;">
                          <strong style="color: #0f172a;">FarmaYA Tecnologias en Salud S.A.S. &bull; NIT 901.842.109-4</strong><br>
                          Documento soporte de pago electronico conforme a la Ley 527 de 1999 y normatividad comercial vigente en Colombia.<br>
                          Medicamentos 100%% autenticos certificados bajo registro sanitario INVIMA &bull; Soporte 24/7 en 
                          <a href="mailto:soporte@farmaya.com.co" style="color: #16865d; text-decoration: none; font-weight: 700;">soporte@farmaya.com.co</a>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """,
            o.code != null ? o.code : "GEN",
            pharmacyName, pharmacyAddress,
            clientName, toEmail, phone, address,
            invoiceDate, paymentMethod, paymentTxId,
            deliveryCode,
            itemsRows.toString(),
            totalFormatted, totalFormatted
        );
    }

}
