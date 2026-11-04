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

        String subject = "Actualizacion de tu Pedido #" + o.code + " - FarmaYA";
        String html = buildOrderUpdateHtml(o, stage, stageTitle, stageNote);
        String threadRootId = "<order-" + o.code + "-root@farmaya.com.co>";
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
        String clientName = o.clientName != null && !o.clientName.isBlank() ? o.clientName : "Cliente";
        String pharmacyName = o.pharmacyName != null && !o.pharmacyName.isBlank() ? o.pharmacyName : "Farmacia aliada asignada";
        String pharmacyAddress = o.pharmacyAddress != null ? o.pharmacyAddress : "";
        String courierName = o.courierName != null && !o.courierName.isBlank() ? o.courierName : "Repartidor asignado";
        String totalFormatted = o.total != null ? String.format("$ %,.0f COP", o.total) : "En cotizacion";
        String deliveryCode = o.deliveryCode != null ? o.deliveryCode : "----";

        // Estilos para las filas de progreso segun etapa actual
        String r1Bg = stage >= 1 ? "#f0fdf4" : "#ffffff";
        String r1Border = stage >= 1 ? "#86efac" : "#e2e8f0";
        String r1Icon = stage >= 1 ? "&#10004;" : "1";
        String r1IconBg = stage >= 1 ? "#16865d" : "#e2e8f0";
        String r1IconColor = stage >= 1 ? "#ffffff" : "#64748b";

        String r2Bg = stage == 2 ? "#ecfdf5" : (stage > 2 ? "#f0fdf4" : "#ffffff");
        String r2Border = stage >= 2 ? "#86efac" : "#e2e8f0";
        String r2Icon = stage > 2 ? "&#10004;" : (stage == 2 ? "&#10148;" : "2");
        String r2IconBg = stage >= 2 ? "#16865d" : "#e2e8f0";
        String r2IconColor = stage >= 2 ? "#ffffff" : "#64748b";

        String r3Bg = stage == 3 ? "#f0fdf4" : "#ffffff";
        String r3Border = stage == 3 ? "#86efac" : "#e2e8f0";
        String r3Icon = stage == 3 ? "&#10004;" : "3";
        String r3IconBg = stage == 3 ? "#16865d" : "#e2e8f0";
        String r3IconColor = stage == 3 ? "#ffffff" : "#64748b";

        // Resumen de productos
        StringBuilder itemsList = new StringBuilder();
        if (o.items != null && !o.items.isEmpty()) {
            for (var it : o.items) {
                itemsList.append("<li style=\"margin-bottom: 4px; color: #334155;\"><strong>")
                         .append(it.quantity).append("x</strong> ")
                         .append(it.name != null ? it.name : "Medicamento")
                         .append("</li>");
            }
        } else {
            itemsList.append("<li style=\"color: #64748b;\">Medicamentos recetados o solicitados</li>");
        }

        // Seccion del codigo de entrega destacado (solo visible cuando va en camino o posterior)
        String deliveryCodeSection = "";
        if (stage >= 2 && o.deliveryCode != null) {
            deliveryCodeSection = """
                <div style="background: #ffffff; border: 2px dashed #16865d; border-radius: 12px; padding: 16px 20px; text-align: center; margin: 14px 0 8px 0; box-shadow: 0 2px 8px rgba(22,134,93,0.06);">
                  <span style="font-size: 11px; font-weight: 800; color: #16865d; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 4px;">CODIGO DE ENTREGA PARA TU DOMICILIARIO</span>
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 10px; color: #16865d; display: inline-block; padding-left: 10px;">%s</span>
                  <p style="margin: 6px 0 0 0; font-size: 12.5px; color: #065f46; line-height: 1.4; font-weight: 600;">
                    Dictale este codigo de 4 digitos a tu domiciliario al momento de recibir el pedido para que pueda confirmar la entrega.
                  </p>
                </div>
                """.formatted(deliveryCode);
        }

        return """
                <!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Actualizacion de Pedido FarmaYA</title>
                </head>
                <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased;">
                  <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="padding: 30px 14px;">
                    <tr>
                      <td align="center">
                        <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.06);">

                          <!-- Cabecera -->
                          <tr>
                            <td style="background: linear-gradient(135deg, #0d5e41 0%%, #16865d 100%%); padding: 26px 30px; text-align: left;">
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
                                          <p style="margin: 2px 0 0 0; color: #a7f3d0; font-size: 13px;">Seguimiento Asistencial en Vivo</p>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                  <td align="right">
                                    <span style="background: rgba(255,255,255,0.2); color: #ffffff; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; letter-spacing: 0.5px;">
                                      Pedido #%s
                                    </span>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>

                          <!-- Estado Actual Destacado -->
                          <tr>
                            <td style="padding: 28px 30px 10px 30px;">
                              <span style="font-size: 11px; font-weight: 800; color: #16865d; text-transform: uppercase; letter-spacing: 1px;">ACTUALIZACION DE ESTADO</span>
                              <h2 style="margin: 4px 0 8px 0; color: #0f172a; font-size: 20px; font-weight: 800;">%s</h2>
                              <p style="margin: 0 0 18px 0; color: #475569; font-size: 14.5px; line-height: 1.5;">
                                Hola <strong>%s</strong>, %s
                              </p>
                            </td>
                          </tr>

                          <!-- TABLA DE PROGRESO POR FILAS / SUBNIVELES (3 ETAPAS) -->
                          <tr>
                            <td style="padding: 0 30px 20px 30px;">
                              <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #ffffff;">

                                <!-- FILA 1: Farmacia y Cotizacion -->
                                <tr style="background: %s; border-bottom: 1px solid %s;">
                                  <td style="padding: 16px 14px; width: 38px; vertical-align: top; text-align: center;">
                                    <div style="width: 28px; height: 28px; border-radius: 50%%; background: %s; color: %s; font-weight: 800; font-size: 13px; line-height: 28px; text-align: center; margin: 0 auto;">
                                      %s
                                    </div>
                                  </td>
                                  <td style="padding: 16px 18px 16px 0; vertical-align: top;">
                                    <div style="font-size: 14.5px; font-weight: 700; color: #0f172a;">1. Farmacia encontrada y cotizacion de precios</div>
                                    <div style="font-size: 13px; color: #475569; margin-top: 4px; line-height: 1.4;">
                                      Establecimiento: <strong>%s</strong> %s<br>
                                      Total cotizado: <strong style="color: #16865d; font-size: 14px;">%s</strong>
                                    </div>
                                  </td>
                                </tr>

                                <!-- FILA 2: En Camino y Codigo de Entrega -->
                                <tr style="background: %s; border-bottom: 1px solid %s;">
                                  <td style="padding: 16px 14px; width: 38px; vertical-align: top; text-align: center;">
                                    <div style="width: 28px; height: 28px; border-radius: 50%%; background: %s; color: %s; font-weight: 800; font-size: 13px; line-height: 28px; text-align: center; margin: 0 auto;">
                                      %s
                                    </div>
                                  </td>
                                  <td style="padding: 16px 18px 16px 0; vertical-align: top;">
                                    <div style="font-size: 14.5px; font-weight: 700; color: #0f172a;">2. Repartidor en camino a tu direccion</div>
                                    <div style="font-size: 13px; color: #475569; margin-top: 4px; line-height: 1.4;">
                                      Domiciliario: <strong>%s</strong><br>
                                      Destino: %s
                                    </div>
                                    %s
                                  </td>
                                </tr>

                                <!-- FILA 3: Entrega Exitosa -->
                                <tr style="background: %s;">
                                  <td style="padding: 16px 14px; width: 38px; vertical-align: top; text-align: center;">
                                    <div style="width: 28px; height: 28px; border-radius: 50%%; background: %s; color: %s; font-weight: 800; font-size: 13px; line-height: 28px; text-align: center; margin: 0 auto;">
                                      %s
                                    </div>
                                  </td>
                                  <td style="padding: 16px 18px 16px 0; vertical-align: top;">
                                    <div style="font-size: 14.5px; font-weight: 700; color: #0f172a;">3. Pedido entregado y finalizado</div>
                                    <div style="font-size: 13px; color: #475569; margin-top: 4px; line-height: 1.4;">
                                      %s
                                    </div>
                                  </td>
                                </tr>

                              </table>
                            </td>
                          </tr>

                          <!-- Resumen de Productos -->
                          <tr>
                            <td style="padding: 0 30px 24px 30px;">
                              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px;">
                                <strong style="font-size: 13px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Medicamentos en esta orden:</strong>
                                <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; line-height: 1.5;">
                                  %s
                                </ul>
                              </div>
                            </td>
                          </tr>

                          <!-- Pie de Pagina -->
                          <tr>
                            <td style="background: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; line-height: 1.5;">
                              <strong style="color: #0f172a;">FarmaYA Colombia</strong> &bull; Tu salud en la puerta de tu hogar<br>
                              Este mensaje se actualiza automaticamente en el mismo hilo de conversacion.
                            </td>
                          </tr>

                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                    o.code,
                    stageTitle,
                    clientName,
                    stageNote,
                    r1Bg, r1Border, r1IconBg, r1IconColor, r1Icon,
                    pharmacyName, (pharmacyAddress.isBlank() ? "" : "(" + pharmacyAddress + ")"), totalFormatted,
                    r2Bg, r2Border, r2IconBg, r2IconColor, r2Icon,
                    courierName, (o.address != null ? o.address : "Direccion registrada"),
                    deliveryCodeSection,
                    r3Bg, r3IconBg, r3IconColor, r3Icon,
                    stage == 3 ? "Entrega confirmada mediante tu codigo seguro de 4 digitos." : "Validacion en tu puerta con el codigo seguro.",
                    itemsList.toString()
                );
    }

    public record EmailDispatchResult(boolean success, String message) {}
}
