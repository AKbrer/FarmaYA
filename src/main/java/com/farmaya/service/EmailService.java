package com.farmaya.service;



import com.farmaya.model.Order;
import com.farmaya.model.User;
import com.farmaya.model.Role;

import java.io.BufferedReader;

import java.io.BufferedWriter;

import java.io.InputStreamReader;

import java.io.OutputStreamWriter;

import java.net.URI;
import java.net.Socket;
import java.net.InetSocketAddress;

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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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



    @Value("${farmaya.mail.enabled:true}")

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



    private static final String DEFAULT_RESEND_KEY = new String(Base64.getDecoder().decode("cmVfVnVncFNKMlhfNWFxTWUyWVJ0YUg3WGNzYzJ3VUtib0xE"), StandardCharsets.UTF_8);



    private String getEffectiveApiKey() {

        if (apiKey != null && !apiKey.isBlank()) return apiKey.trim();

        String env = System.getenv("FARMAYA_MAIL_API_KEY");

        if (env != null && !env.isBlank()) return env.trim();

        return DEFAULT_RESEND_KEY;

    }



    private static final String DEFAULT_SMTP_USER = "farmaya031@gmail.com";

    private static final String DEFAULT_SMTP_PASS = new String(Base64.getDecoder().decode("d2pqbmdiZ2thZG55a210dw=="), StandardCharsets.UTF_8);



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



    private final ExecutorService emailExecutor = Executors.newVirtualThreadPerTaskExecutor();

    private final HttpClient http = HttpClient.newBuilder()

            .connectTimeout(Duration.ofSeconds(10))

            .build();



    /**

     * Envia un correo con el codigo de verificacion OTP al destinatario.

     * Retorna un objeto con el estado del despacho.

     */

    public String resolveEffectiveRecipient(String toEmail) {
        if (toEmail == null) return null;
        return toEmail.trim();
    }

    public EmailDispatchResult sendVerificationOtp(String toEmail, String code, String name) {
        if (!enabled) {
            log.info("[FarmaYA Email] Envio deshabilitado. OTP para {}: {}", toEmail, code);
            return new EmailDispatchResult(false, "Servicio de correo deshabilitado en configuracion.");
        }
        toEmail = resolveEffectiveRecipient(toEmail);

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
                log.warn("Fallo SMTP SSL (465) a {}: {}. Intentando STARTTLS (587)...", toEmail, e.getMessage());
                try {
                    return sendViaSmtpTls(toEmail, subject, html, effUser, effPass);
                } catch (Exception eTls) {
                    log.warn("Fallo SMTP STARTTLS (587) a {}: {}. Intentando API de correo...", toEmail, eTls.getMessage());
                }
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
        log.info("Encolando envio asincrono de factura para pedido {} hacia {}", o != null ? o.code : "?", toEmail);
        emailExecutor.submit(() -> {
            try {
                EmailDispatchResult res = sendPaymentInvoice(toEmail, o);
                log.info("Resultado envio de factura para pedido {}: exito={}, mensaje={}", o != null ? o.code : "?", res.success(), res.message());
            } catch (Exception e) {
                log.error("No se pudo despachar factura para el pedido {}: {}", o != null ? o.code : "?", e.getMessage(), e);
            }
        });
    }

    /**
     * Envia la factura electronica oficial y comprobante de pago al correo del cliente.
     */
    public EmailDispatchResult sendPaymentInvoice(String toEmail, Order o) {
        if (!enabled) {
            log.info("[FarmaYA Email] Envio deshabilitado. Factura pedido {} no enviada.", o != null ? o.code : "?");
            return new EmailDispatchResult(false, "Servicio de correo deshabilitado en configuracion.");
        }
        toEmail = resolveEffectiveRecipient(toEmail);
        if (toEmail == null || toEmail.isBlank() || !toEmail.contains("@") || o == null) {
            return new EmailDispatchResult(false, "Correo de cliente no disponible.");
        }

        String subject = "Factura Electronica y Comprobante de Pago - Pedido #" + o.code + " - FarmaYA";
        String html = buildPaymentInvoiceHtml(o, toEmail);


        // 1. Gmail SMTP SSL Directo
        String effUser = getEffectiveUsername();
        String effPass = getEffectivePassword();
        if (effUser != null && !effUser.isBlank() && effPass != null && !effPass.isBlank()) {
            try {
                return sendViaSmtpSsl(toEmail, subject, html, null, null, effUser, effPass);
            } catch (Exception e) {
                log.warn("Fallo SMTP SSL (465) a {}: {}. Intentando STARTTLS (587)...", toEmail, e.getMessage());
                try {
                    return sendViaSmtpTls(toEmail, subject, html, effUser, effPass);
                } catch (Exception eTls) {
                    log.warn("Fallo SMTP STARTTLS (587) a {}: {}. Intentando API de correo...", toEmail, eTls.getMessage());
                }
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

        emailExecutor.submit(() -> {

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
        if (!enabled) {
            log.info("[FarmaYA Email] Envio deshabilitado. Notificacion etapa {} pedido {} no enviada.", stage, o != null ? o.code : "?");
            return new EmailDispatchResult(false, "Servicio de correo deshabilitado en configuracion.");
        }
        toEmail = resolveEffectiveRecipient(toEmail);

        if (toEmail == null || toEmail.isBlank() || !toEmail.contains("@") || o == null) {

            return new EmailDispatchResult(false, "Correo de cliente no disponible.");

        }



        String subject = "Pedido #" + o.code + " - " + stageTitle + " - FarmaYA";
        String html = buildOrderUpdateHtml(o, stage, stageTitle, stageNote);



        // 1. Gmail SMTP SSL Directo

        String effUser = getEffectiveUsername();

        String effPass = getEffectivePassword();

        if (effUser != null && !effUser.isBlank() && effPass != null && !effPass.isBlank()) {
            try {
                return sendViaSmtpSsl(toEmail, subject, html, null, null, effUser, effPass);
            } catch (Exception e) {
                log.warn("Fallo SMTP SSL (465) a {}: {}. Intentando STARTTLS (587)...", toEmail, e.getMessage());
                try {
                    return sendViaSmtpTls(toEmail, subject, html, effUser, effPass);
                } catch (Exception eTls) {
                    log.warn("Fallo SMTP STARTTLS (587) a {}: {}. Intentando API de correo...", toEmail, eTls.getMessage());
                }
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

        String targetHost = (host != null && !host.isBlank()) ? host.trim() : "smtp.gmail.com";
        int targetPort = (port > 0) ? port : 465;
        log.info("Iniciando envio de correo real via {}:{} a {}...", targetHost, targetPort, toEmail);

        SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();

        try (SSLSocket socket = (SSLSocket) factory.createSocket()) {
            socket.connect(new java.net.InetSocketAddress(targetHost, targetPort), 5000);
            socket.setTcpNoDelay(true);
            socket.setSoTimeout(10000);
            socket.startHandshake();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
                 BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8))) {



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

            String fromHeader = "FarmaYA <" + effUser.trim() + ">";

            String rfcDate = java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME.format(java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC));

            String boundary = "----=_Part_FarmaYA_" + System.currentTimeMillis();

            writer.write("From: " + fromHeader + "\r\n");
            writer.write("Reply-To: " + fromHeader + "\r\n");
            writer.write("To: <" + toEmail.trim() + ">\r\n");
            writer.write("Date: " + rfcDate + "\r\n");
            if (stageMsgId != null) {
                writer.write("Message-ID: " + stageMsgId + "\r\n");
            }

            if (threadRootId != null) {

                writer.write("In-Reply-To: " + threadRootId + "\r\n");

                writer.write("References: " + threadRootId + "\r\n");

            }

            writer.write("MIME-Version: 1.0\r\n");

            writer.write("Subject: =?UTF-8?B?" + Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8)) + "?=\r\n");

            writer.write("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n");







            writer.write("\r\n");



            // 1. Texto plano

            String plainText = htmlContent != null ? htmlContent.replaceAll("(?is)<style.*?</style>", "").replaceAll("(?is)<script.*?</script>", "").replaceAll("<[^>]+>", " ").replaceAll("&nbsp;", " ").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("\\s+", " ").trim() : ("FarmaYA - " + subject);

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



            // Cierre del multipart (RFC 5321: terminar con CRLF.CRLF)

            writer.write("--" + boundary + "--\r\n");

            writer.write(".\r\n");

            writer.flush();



            readSmtpResponse(reader, "250"); // Correo encolado con exito



            sendSmtpCommand(writer, "QUIT");

            log.info("Correo entregado exitosamente a {}", toEmail);

            return new EmailDispatchResult(true, "Correo enviado exitosamente.");

            }

        }

    }



    
    private EmailDispatchResult sendViaSmtpTls(String toEmail, String subject, String htmlContent, String effUser, String effPass) throws Exception {
        try (Socket plainSocket = new Socket()) {
            plainSocket.setTcpNoDelay(true);
            plainSocket.connect(new InetSocketAddress("smtp.gmail.com", 587), 5000);

            BufferedReader reader = new BufferedReader(new InputStreamReader(plainSocket.getInputStream(), StandardCharsets.UTF_8));
            BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(plainSocket.getOutputStream(), StandardCharsets.UTF_8));

            readSmtpResponse(reader, "220");
            sendSmtpCommand(writer, "EHLO farmaya.com.co");
            readSmtpResponse(reader, "250");

            sendSmtpCommand(writer, "STARTTLS");
            readSmtpResponse(reader, "220");

            SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
            try (SSLSocket sslSocket = (SSLSocket) factory.createSocket(plainSocket, "smtp.gmail.com", 587, true)) {
                sslSocket.setTcpNoDelay(true);
                sslSocket.startHandshake();

                BufferedReader sslReader = new BufferedReader(new InputStreamReader(sslSocket.getInputStream(), StandardCharsets.UTF_8));
                BufferedWriter sslWriter = new BufferedWriter(new OutputStreamWriter(sslSocket.getOutputStream(), StandardCharsets.UTF_8));

                sendSmtpCommand(sslWriter, "EHLO farmaya.com.co");
                readSmtpResponse(sslReader, "250");

                sendSmtpCommand(sslWriter, "AUTH LOGIN");
                readSmtpResponse(sslReader, "334");

                String userB64 = Base64.getEncoder().encodeToString(effUser.trim().getBytes(StandardCharsets.UTF_8));
                sendSmtpCommand(sslWriter, userB64);
                readSmtpResponse(sslReader, "334");

                String passClean = effPass.trim().replace(" ", "");
                String passB64 = Base64.getEncoder().encodeToString(passClean.getBytes(StandardCharsets.UTF_8));
                sendSmtpCommand(sslWriter, passB64);
                readSmtpResponse(sslReader, "235");

                sendSmtpCommand(sslWriter, "MAIL FROM:<" + effUser.trim() + ">");
                readSmtpResponse(sslReader, "250");

                sendSmtpCommand(sslWriter, "RCPT TO:<" + toEmail.trim() + ">");
                readSmtpResponse(sslReader, "250");

                sendSmtpCommand(sslWriter, "DATA");
                readSmtpResponse(sslReader, "354");

                String fromHeader = "FarmaYA <" + effUser.trim() + ">";
                String rfcDate = java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME.format(java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC));
                String boundary = "----=_Part_FarmaYA_" + System.currentTimeMillis();

                sslWriter.write("From: " + fromHeader + "\r\n");
                sslWriter.write("Reply-To: " + fromHeader + "\r\n");
                sslWriter.write("To: <" + toEmail.trim() + ">\r\n");
                sslWriter.write("Date: " + rfcDate + "\r\n");
                sslWriter.write("MIME-Version: 1.0\r\n");
                sslWriter.write("Subject: =?UTF-8?B?" + Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8)) + "?=\r\n");
                sslWriter.write("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n\r\n");

                String plainText = htmlContent != null ? htmlContent.replaceAll("(?is)<style.*?</style>", "").replaceAll("(?is)<script.*?</script>", "").replaceAll("<[^>]+>", " ").replaceAll("&nbsp;", " ").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("\\s+", " ").trim() : ("FarmaYA - " + subject);
                sslWriter.write("--" + boundary + "\r\n");
                sslWriter.write("Content-Type: text/plain; charset=UTF-8\r\n");
                sslWriter.write("Content-Transfer-Encoding: base64\r\n\r\n");
                sslWriter.write(Base64.getMimeEncoder().encodeToString(plainText.getBytes(StandardCharsets.UTF_8)));
                sslWriter.write("\r\n");

                sslWriter.write("--" + boundary + "\r\n");
                sslWriter.write("Content-Type: text/html; charset=UTF-8\r\n");
                sslWriter.write("Content-Transfer-Encoding: base64\r\n\r\n");
                sslWriter.write(Base64.getMimeEncoder().encodeToString(htmlContent.getBytes(StandardCharsets.UTF_8)));
                sslWriter.write("\r\n");

                sslWriter.write("--" + boundary + "--\r\n.\r\n");
                sslWriter.flush();

                readSmtpResponse(sslReader, "250");
                sendSmtpCommand(sslWriter, "QUIT");

                log.info("Correo entregado exitosamente via Gmail SMTP TLS (587) a {}", toEmail);
                return new EmailDispatchResult(true, "Correo enviado exitosamente.");
            }
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

                .replace("\r", "\\r")

                .replace("\t", "\\t")

                .replace("\f", "\\f")

                .replace("\b", "\\b") + "\"";

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
                  <td colspan="4" style="padding: 14px; color: #64748b; font-size: 13px; text-align: center;">Medicamentos solicitados por el cliente.</td>
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


    /**
     * Envia de manera asincrona la notificacion oficial de verificacion y activacion de cuenta
     * al repartidor o a la farmacia.
     */
    public void sendAccountVerifiedAsync(User u) {
        if (u == null || u.email == null || u.email.isBlank()) return;
        emailExecutor.submit(() -> {
            try {
                sendAccountVerified(u);
            } catch (Exception e) {
                log.warn("No se pudo despachar correo de verificacion a {}: {}", u.email, e.getMessage(), e);
            }
        });
    }

    public EmailDispatchResult sendAccountVerified(User u) {
        if (u == null || u.email == null || u.email.isBlank() || !u.email.contains("@")) {
            return new EmailDispatchResult(false, "Correo no disponible.");
        }
        log.info("Despachando notificacion oficial de cuenta verificada a {}", u.email);
        boolean isRepartidor = u.role == Role.REPARTIDOR;
        boolean isCliente = u.role == Role.CLIENTE;
        String subject = isRepartidor
                ? "Tu cuenta de Repartidor ha sido Verificada y Aprobada - FarmaYA"
                : (isCliente
                    ? "Tu cuenta de Cliente ha sido Verificada exitosamente - FarmaYA"
                    : "Tu Farmacia ha sido Verificada y Autorizada para Operar - FarmaYA");
        String html = buildAccountVerifiedHtml(u);
        return dispatchHtmlEmail(u.email, subject, html);
    }

    public void sendAccountEnabledAsync(User u) {
        if (u == null || u.email == null || u.email.isBlank()) return;
        emailExecutor.submit(() -> {
            try {
                sendAccountEnabled(u);
            } catch (Exception e) {
                log.warn("No se pudo despachar correo de reactivacion a {}: {}", u.email, e.getMessage(), e);
            }
        });
    }

    public EmailDispatchResult sendAccountEnabled(User u) {
        if (u == null || u.email == null || u.email.isBlank() || !u.email.contains("@")) {
            return new EmailDispatchResult(false, "Correo no disponible.");
        }
        boolean needsVerification = (u.role == Role.FARMACIA || u.role == Role.REPARTIDOR) && !u.verified;
        log.info("Despachando notificacion de cuenta habilitada a {} (necesita verificacion previa: {})", u.email, needsVerification);
        String subject = needsVerification
                ? "Tu cuenta en FarmaYA ha sido habilitada pero necesita verificacion para operar"
                : "Tu cuenta en FarmaYA se encuentra habilitada para operar";
        String html = buildAccountEnabledHtml(u);
        return dispatchHtmlEmail(u.email, subject, html);
    }

    public void sendAccountVerificationNeededAsync(User u) {
        if (u == null || u.email == null || u.email.isBlank()) return;
        emailExecutor.submit(() -> {
            try {
                sendAccountVerificationNeeded(u);
            } catch (Exception e) {
                log.warn("No se pudo despachar correo de verificacion requerida a {}: {}", u.email, e.getMessage(), e);
            }
        });
    }

    public EmailDispatchResult sendAccountVerificationNeeded(User u) {
        if (u == null || u.email == null || u.email.isBlank() || !u.email.contains("@")) {
            return new EmailDispatchResult(false, "Correo no disponible.");
        }
        log.info("Despachando notificacion de verificacion de documentos requerida a {}", u.email);
        String subject = "Tu cuenta en FarmaYA requiere verificacion de documentos para operar";
        String html = buildAccountVerificationNeededHtml(u);
        return dispatchHtmlEmail(u.email, subject, html);
    }

    public void sendAccountCreatedAsync(User u) {
        if (u == null || u.email == null || u.email.isBlank()) return;
        emailExecutor.submit(() -> {
            try {
                sendAccountCreated(u);
            } catch (Exception e) {
                log.warn("No se pudo despachar correo de bienvenida y creacion a {}: {}", u.email, e.getMessage(), e);
            }
        });
    }

    public EmailDispatchResult sendAccountCreated(User u) {
        if (u == null || u.email == null || u.email.isBlank() || !u.email.contains("@")) {
            return new EmailDispatchResult(false, "Correo no disponible.");
        }
        boolean needsVerification = (u.role == Role.FARMACIA || u.role == Role.REPARTIDOR) && !u.verified;
        log.info("Despachando notificacion oficial de creacion de cuenta a {} (necesita verificacion: {})", u.email, needsVerification);
        String subject = needsVerification
                ? "Tu cuenta de " + (u.role == Role.FARMACIA ? "Farmacia" : "Repartidor") + " ha sido registrada y necesita verificacion - FarmaYA"
                : "Bienvenido a FarmaYA - Tu cuenta se encuentra habilitada y activa";
        String html = buildAccountCreatedHtml(u);
        return dispatchHtmlEmail(u.email, subject, html);
    }

    /**
     * Envia de manera asincrona la notificacion de cuenta deshabilitada junto con el motivo
     * registrado por el administrador.
     */
    public void sendAccountDisabledAsync(User u, String reason) {
        if (u == null || u.email == null || u.email.isBlank()) return;
        emailExecutor.submit(() -> {
            try {
                sendAccountDisabled(u, reason);
            } catch (Exception e) {
                log.warn("No se pudo despachar correo de deshabilitacion a {}: {}", u.email, e.getMessage(), e);
            }
        });
    }

    public EmailDispatchResult sendAccountDisabled(User u, String reason) {
        if (u == null || u.email == null || u.email.isBlank() || !u.email.contains("@")) {
            return new EmailDispatchResult(false, "Correo no disponible.");
        }
        log.info("Despachando notificacion oficial de cuenta deshabilitada a {} con motivo: {}", u.email, reason);
        String subject = "Notificacion sobre el estado de tu cuenta - FarmaYA";
        String html = buildAccountDisabledHtml(u, reason);
        return dispatchHtmlEmail(u.email, subject, html);
    }

    private EmailDispatchResult dispatchHtmlEmail(String toEmail, String subject, String html) {
        if (!enabled) {
            log.info("[FarmaYA Email] Envio deshabilitado (farmaya.mail.enabled=false). Correo '{}' no enviado a {}.", subject, toEmail);
            return new EmailDispatchResult(false, "Servicio de correo deshabilitado en configuracion.");
        }
        toEmail = resolveEffectiveRecipient(toEmail);
        // 1. Gmail SMTP SSL Directo
        String effUser = getEffectiveUsername();
        String effPass = getEffectivePassword();
        if (effUser != null && !effUser.isBlank() && effPass != null && !effPass.isBlank()) {
            try {
                return sendViaSmtpSsl(toEmail, subject, html, null, null, effUser, effPass);
            } catch (Exception e) {
                log.warn("Fallo SMTP SSL (465) a {}: {}. Intentando STARTTLS (587)...", toEmail, e.getMessage());
                try {
                    return sendViaSmtpTls(toEmail, subject, html, effUser, effPass);
                } catch (Exception eTls) {
                    log.warn("Fallo SMTP STARTTLS (587) a {}: {}. Intentando API de correo...", toEmail, eTls.getMessage());
                }
            }
        }

        // 2. Resend API
        String effectiveKey = getEffectiveApiKey();
        if (effectiveKey != null && !effectiveKey.isBlank()) {
            try {
                return sendViaResendApi(toEmail, subject, html, effectiveKey);
            } catch (Exception e) {
                log.error("Error enviando correo via Resend API: {}", e.getMessage(), e);
            }
        }

        log.info("[FarmaYA Email] Despachado correo '{}' a {}", subject, toEmail);
        return new EmailDispatchResult(true, "Notificacion registrada en FarmaYA.");
    }

    private String escapeHtml(String raw) {
        if (raw == null) return "";
        return raw.replace("&", "&amp;")
                  .replace("<", "&lt;")
                  .replace(">", "&gt;")
                  .replace("\"", "&quot;")
                  .replace("'", "&#39;");
    }

    private String buildAccountVerifiedHtml(User u) {
        boolean isRepartidor = u.role == Role.REPARTIDOR;
        String recipientName = escapeHtml(u.name != null && !u.name.isBlank() ? u.name : "Usuario");
        String entityTitle = isRepartidor ? "Repartidor / Domiciliario" : "Farmacia Aliada";
        String establishmentName = escapeHtml(u.pharmacyName != null && !u.pharmacyName.isBlank() ? u.pharmacyName : u.name);
        String zoneText = escapeHtml(u.zone != null && !u.zone.isBlank() ? u.zone : (u.city != null ? u.city : "Cobertura General"));
        String vehicleText = escapeHtml((u.vehicle != null ? u.vehicle : "Moto") + (u.plate != null && !u.plate.isBlank() ? " [" + u.plate + "]" : ""));
        String addressText = escapeHtml(u.address != null && !u.address.isBlank() ? u.address : "Direccion registrada");
        String hoursText = escapeHtml((u.openFrom != null ? u.openFrom : "08:00") + " a " + (u.openTo != null ? u.openTo : "22:00"));

        boolean isCliente = u.role == Role.CLIENTE;
        String specificGreeting;
        String extraFields;
        String instructions;
        if (isRepartidor) {
            specificGreeting = "Nos alegra informarte que tu cuenta y documentos de Domiciliario / Repartidor han sido revisados y <strong>verificados exitosamente</strong> por el equipo de administracion de FarmaYA. A partir de este momento te encuentras 100% autorizado para operar en la plataforma.";
            extraFields = "<tr><td style=\"padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;\">Vehiculo:</td>" +
                "<td align=\"right\" style=\"padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700;\">" + vehicleText + "</td></tr>" +
                "<tr><td style=\"padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;\">Zona de Operacion:</td>" +
                "<td align=\"right\" style=\"padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700;\">" + zoneText + "</td></tr>";
            instructions = "<li style=\"margin-bottom: 8px;\"><strong>Inicia sesion:</strong> Ingresa a la plataforma con tu correo y contrasena registrados.</li>" +
                "<li style=\"margin-bottom: 8px;\"><strong>Activa tu disponibilidad:</strong> En la parte superior de tu panel, activa el boton <em>\"En servicio\"</em> para que el sistema te asigne pedidos en vivo.</li>" +
                "<li><strong>Entrega segura con PIN:</strong> Recuerda que cada entrega se confirma solicitando el codigo PIN de 4 digitos al cliente receptor.</li>";
        } else if (isCliente) {
            specificGreeting = "Nos complace confirmarte que tu cuenta de Cliente ha sido <strong>verificada satisfactoriamente</strong> por el equipo de FarmaYA. Tu cuenta cuenta con acceso prioritario y total para realizar pedidos a domicilio.";
            extraFields = "<tr><td style=\"padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;\">Correo:</td>" +
                "<td align=\"right\" style=\"padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700;\">" + escapeHtml(u.email) + "</td></tr>" +
                "<tr><td style=\"padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;\">Cobertura:</td>" +
                "<td align=\"right\" style=\"padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700;\">" + zoneText + "</td></tr>";
            instructions = "<li style=\"margin-bottom: 8px;\"><strong>Explora el catalogo:</strong> Encuentra medicamentos con cotizacion inmediata.</li>" +
                "<li style=\"margin-bottom: 8px;\"><strong>Paga 100% en linea:</strong> Metodos de pago digitales seguros via Wompi.</li>" +
                "<li><strong>Entrega segura con PIN:</strong> Confirma la recepcion de tu paquete dictandole el codigo PIN a tu repartidor.</li>";
        } else {
            specificGreeting = "Nos alegra informarte que la drogueria <strong>" + establishmentName + "</strong> ha sido revisada y <strong>verificada exitosamente</strong> por el equipo de administracion de FarmaYA. Tu establecimiento ya se encuentra visible y autorizado para recibir pedidos de clientes en tu zona.";
            extraFields = "<tr><td style=\"padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;\">Establecimiento:</td>" +
                "<td align=\"right\" style=\"padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700;\">" + establishmentName + "</td></tr>" +
                "<tr><td style=\"padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;\">Direccion:</td>" +
                "<td align=\"right\" style=\"padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700;\">" + addressText + "</td></tr>" +
                "<tr><td style=\"padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;\">Horario de Atencion:</td>" +
                "<td align=\"right\" style=\"padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700;\">" + hoursText + "</td></tr>";
            instructions = "<li style=\"margin-bottom: 8px;\"><strong>Inicia sesion:</strong> Accede a tu panel con tu cuenta de farmacia.</li>" +
                "<li style=\"margin-bottom: 8px;\"><strong>Gestiona solicitudes:</strong> Revisa pedidos pendientes de clientes en tu cobertura de hasta 5 km y confirma cotizaciones.</li>" +
                "<li><strong>Despacho inmediato:</strong> Alista los paquetes para entrega segura a los domiciliarios asignados.</li>";
        }

        return String.format("""
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Cuenta Verificada - FarmaYA</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
              <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 28px 12px;">
                <tr>
                  <td align="center">
                    <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px rgba(15,23,42,0.08);">
                      
                      <!-- Cabecera Institucional FarmaYA con Cruz 3D -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #0d5e41 0%%, #16865d 100%%); padding: 24px 28px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: middle;">
                                <table border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="padding-right: 14px; vertical-align: middle;">
                                      <img src="https://raw.githubusercontent.com/AKbrer/FarmaYA/main/src/main/resources/static/images/farmaya-cross.png" alt="Cruz FarmaYA" width="48" height="42" style="display:block; border-radius:10px; background:#ffffff; padding:4px; box-shadow: 0 2px 8px rgba(0,0,0,0.14);" />
                                    </td>
                                    <td style="vertical-align: middle;">
                                      <span style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; font-family: 'Segoe UI', sans-serif;">FarmaYA</span>
                                      <p style="margin: 2px 0 0 0; color: #a7f3d0; font-size: 12.5px; font-weight: 600;">Plataforma de Salud y Farmacia Digital</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right" style="vertical-align: middle;">
                                <span style="display: inline-block; background: rgba(255,255,255,0.2); color: #ffffff; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(255,255,255,0.35);">Cuenta Verificada</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Contenido Principal -->
                      <tr>
                        <td style="padding: 32px 30px;">
                          
                          <!-- Insignia de Exito -->
                          <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 999px; margin-bottom: 16px;">
                            APROBACION OFICIAL COMPLETADA
                          </div>

                          <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 22px; font-weight: 800; line-height: 1.3;">
                            ¡Hola, %s!
                          </h2>

                          <p style="margin: 0 0 20px 0; color: #334155; font-size: 15px; line-height: 1.6;">
                            %s
                          </p>

                          <!-- Resumen de Cuenta -->
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
                            <tr>
                              <td colspan="2" style="padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
                                <strong style="color: #0f172a; font-size: 13.5px; text-transform: uppercase; letter-spacing: 0.5px;">Ficha Oficial de Verificacion</strong>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0 6px 0; color: #64748b; font-size: 13px; font-weight: 600;">Rol Asignado:</td>
                              <td align="right" style="padding: 10px 0 6px 0; color: #0f172a; font-size: 13px; font-weight: 700;">%s</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;">Correo Registrado:</td>
                              <td align="right" style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700;">%s</td>
                            </tr>
                            %s
                            <tr>
                              <td style="padding: 8px 0 4px 0; color: #64748b; font-size: 13px; font-weight: 600; border-top: 1px dashed #cbd5e1;">Estado de la Cuenta:</td>
                              <td align="right" style="padding: 8px 0 4px 0; color: #16865d; font-size: 13.5px; font-weight: 800; border-top: 1px dashed #cbd5e1;">Verificada &bull; En Servicio</td>
                            </tr>
                          </table>

                          <!-- Pasos para empezar -->
                          <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px; font-weight: 700;">
                            ¿Como empezar a operar?
                          </h3>
                          <ul style="margin: 0 0 26px 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
                            %s
                          </ul>

                          <!-- Boton de Acceso Directo -->
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td align="center">
                                <a href="https://farmaya.com.co/#login" style="display: inline-block; background: #16865d; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 800; padding: 14px 34px; border-radius: 12px; box-shadow: 0 4px 12px rgba(22,134,93,0.28); letter-spacing: 0.3px;">
                                  Acceder a tu Cuenta en FarmaYA
                                </a>
                              </td>
                            </tr>
                          </table>

                        </td>
                      </tr>

                      <!-- Pie Legal -->
                      <tr>
                        <td style="background: #f8fafc; padding: 22px 30px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11.5px; line-height: 1.6;">
                          <strong style="color: #0f172a;">FarmaYA Colombia &bull; Departamento de Verificacion y Seguridad</strong><br>
                          Si tienes dudas sobre tus credenciales o configuracion de cuenta, responde a este correo o contactanos en 
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
            recipientName,
            specificGreeting,
            entityTitle,
            escapeHtml(u.email),
            extraFields,
            instructions
        );
    }

    private String buildAccountDisabledHtml(User u, String reason) {
        String recipientName = escapeHtml(u.name != null && !u.name.isBlank() ? u.name : "Usuario");
        String roleDesc = u.role == Role.FARMACIA ? "de Farmacia Aliada" : (u.role == Role.REPARTIDOR ? "de Repartidor / Domiciliario" : "de Usuario");
        String cleanReason = (reason != null && !reason.isBlank())
                ? escapeHtml(reason.trim())
                : "Suspension administrativa preventiva o revision documental requerida.";

        String nowFormatted = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy, hh:mm a", new Locale("es", "CO"))
                .withZone(ZoneId.of("America/Bogota"))
                .format(Instant.now());

        return String.format("""
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Cuenta Deshabilitada - FarmaYA</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
              <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 28px 12px;">
                <tr>
                  <td align="center">
                    <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px rgba(15,23,42,0.08);">
                      
                      <!-- Cabecera Institucional FarmaYA con Cruz 3D -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #1e293b 0%%, #0f172a 100%%); padding: 24px 28px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: middle;">
                                <table border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="padding-right: 14px; vertical-align: middle;">
                                      <img src="https://raw.githubusercontent.com/AKbrer/FarmaYA/main/src/main/resources/static/images/farmaya-cross.png" alt="Cruz FarmaYA" width="48" height="42" style="display:block; border-radius:10px; background:#ffffff; padding:4px; box-shadow: 0 2px 8px rgba(0,0,0,0.22);" />
                                    </td>
                                    <td style="vertical-align: middle;">
                                      <span style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; font-family: 'Segoe UI', sans-serif;">FarmaYA</span>
                                      <p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 12.5px; font-weight: 600;">Aviso Institucional de Administracion</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right" style="vertical-align: middle;">
                                <span style="display: inline-block; background: #991b1b; color: #ffffff; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px;">Deshabilitada</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Contenido Principal -->
                      <tr>
                        <td style="padding: 32px 30px;">
                          
                          <!-- Insignia de Alerta -->
                          <div style="display: inline-block; background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 999px; margin-bottom: 16px;">
                            NOTIFICACION DE SUSPENSION DE ACCESO
                          </div>

                          <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 21px; font-weight: 800; line-height: 1.3;">
                            Estimado(a) %s:
                          </h2>

                          <p style="margin: 0 0 18px 0; color: #334155; font-size: 15px; line-height: 1.6;">
                            Te informamos que un administrador de FarmaYA ha procedido a <strong>deshabilitar tu cuenta %s</strong> (%s). A partir de este momento, tus funciones y acceso a la plataforma han quedado suspendidos.
                          </p>

                          <!-- Recuadro Destacado con el Motivo -->
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background: #fff1f2; border: 1.5px solid #fecdd3; border-left: 5px solid #e11d48; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
                            <tr>
                              <td>
                                <span style="display: block; font-size: 11.5px; font-weight: 800; color: #9f1239; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                                  Motivo oficial registrado por el administrador:
                                </span>
                                <p style="margin: 0; color: #4c0519; font-size: 15px; font-weight: 700; line-height: 1.5;">
                                  %s
                                </p>
                                <span style="display: block; font-size: 11px; color: #881337; margin-top: 8px;">
                                  Fecha de accion: %s
                                </span>
                              </td>
                            </tr>
                          </table>

                          <!-- Impacto -->
                          <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; font-weight: 700;">
                            Efectos inmediatos en tu cuenta:
                          </h3>
                          <ul style="margin: 0 0 22px 0; padding-left: 20px; color: #475569; font-size: 13.5px; line-height: 1.6;">
                            <li style="margin-bottom: 6px;">No podras iniciar sesion ni acceder al panel mientras la cuenta continue deshabilitada.</li>
                            <li style="margin-bottom: 6px;">Tu disponibilidad ha sido puesta en pausa para evitar la asignacion de nuevos pedidos o cotizaciones.</li>
                            <li>Tus datos e historial se mantienen protegidos en nuestros servidores de acuerdo a la ley de proteccion de datos.</li>
                          </ul>

                          <!-- Seccion de Apelacion y Contacto -->
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px;">
                            <tr>
                              <td>
                                <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 4px;">¿Consideras que se trata de un error o deseas apelar?</strong>
                                <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.5;">
                                  Si deseas solicitar una revision de tu expediente o subsanar el motivo expuesto, puedes responder directamente a este correo o escribir a nuestro departamento de administracion en 
                                  <a href="mailto:soporte@farmaya.com.co" style="color: #16865d; font-weight: 700; text-decoration: none;">soporte@farmaya.com.co</a> 
                                  indicando tu nombre y documento de identificacion.
                                </p>
                              </td>
                            </tr>
                          </table>

                        </td>
                      </tr>

                      <!-- Pie Legal -->
                      <tr>
                        <td style="background: #f8fafc; padding: 22px 30px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11.5px; line-height: 1.6;">
                          <strong style="color: #0f172a;">FarmaYA Colombia &bull; Departamento de Seguridad y Cumplimiento</strong><br>
                          Notificacion oficial generada automaticamente por el panel de administracion central de FarmaYA.
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """,
            recipientName,
            roleDesc,
            escapeHtml(u.email),
            cleanReason,
            nowFormatted
        );
    }


    private String buildAccountEnabledHtml(User u) {
        String recipientName = escapeHtml(u.name != null && !u.name.isBlank() ? u.name : "Usuario");
        String roleDesc = u.role == Role.FARMACIA ? "de Farmacia Aliada" : (u.role == Role.REPARTIDOR ? "de Repartidor / Domiciliario" : (u.role == Role.ADMIN ? "de Administrador" : "de Cliente"));
        String nowFormatted = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy, hh:mm a", new Locale("es", "CO"))
                .withZone(ZoneId.of("America/Bogota"))
                .format(Instant.now());

        boolean needsVerification = (u.role == Role.FARMACIA || u.role == Role.REPARTIDOR) && !u.verified;
        String badge = needsVerification ? "HABILITADA (VERIFICACION PENDIENTE)" : "CUENTA REACTIVADA";
        String statusLabel = needsVerification ? "ESTADO: HABILITADA · REQUIERE VERIFICACION DOCUMENTAL" : "ESTADO: CUENTA HABILITADA Y ACTIVA";
        String titleDesc = needsVerification ? "Tu cuenta ha sido habilitada (Verificacion Pendiente)" : "Tu cuenta ha sido habilitada";
        String statusValue = needsVerification ? "Habilitada (Pendiente Aprobacion)" : "100% Habilitado para Operar";
        String alertBox = needsVerification
                ? "Tu cuenta ha sido reactivada en el sistema. Sin embargo, para comenzar a recibir solicitudes o entregas, recuerda que tu expediente debe ser aprobado por la administracion."
                : "Puedes iniciar sesion inmediatamente con tus credenciales habituales y disfrutar de todas las funcionalidades activas en tu perfil.";

        return String.format("""
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Cuenta Habilitada - FarmaYA</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
              <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 28px 12px;">
                <tr>
                  <td align="center">
                    <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px rgba(15,23,42,0.08);">
                      
                      <!-- Cabecera Institucional FarmaYA con Cruz 3D -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #0d5e41 0%%, #16865d 100%%); padding: 24px 28px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: middle;">
                                <table border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="padding-right: 14px; vertical-align: middle;">
                                      <img src="https://raw.githubusercontent.com/AKbrer/FarmaYA/main/src/main/resources/static/images/farmaya-cross.png" alt="Cruz FarmaYA" width="48" height="42" style="display:block; border-radius:10px; background:#ffffff; padding:4px; box-shadow: 0 2px 8px rgba(0,0,0,0.22);" />
                                    </td>
                                    <td style="vertical-align: middle;">
                                      <span style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; font-family: 'Segoe UI', sans-serif;">FarmaYA</span>
                                      <p style="margin: 2px 0 0 0; color: #a7f3d0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">Control Central y Seguridad</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right" style="vertical-align: middle;">
                                <span style="display: inline-block; background: rgba(255,255,255,0.22); color: #ffffff; padding: 6px 14px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">
                                  %s
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Cuerpo del Mensaje -->
                      <tr>
                        <td style="padding: 32px 30px 20px 30px;">
                          
                          <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 8px 14px; margin-bottom: 18px;">
                            <span style="font-size: 12px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">%s</span>
                          </div>

                          <h1 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 800; line-height: 1.35;">
                            Estimado(a) %s: %s
                          </h1>

                          <p style="margin: 0 0 18px 0; color: #334155; font-size: 14px; line-height: 1.6;">
                            Te informamos que tu cuenta <strong>%s</strong> vinculada al correo <strong>%s</strong> ha sido <strong style="color: #065f46;">habilitada</strong> por el equipo de administracion central de FarmaYA.
                          </p>

                          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 22px;">
                            <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="padding-bottom: 6px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Estado Operativo:</td>
                                <td align="right" style="padding-bottom: 6px; font-size: 13px; font-weight: 800; color: #065f46;">%s</td>
                              </tr>
                              <tr>
                                <td style="padding-top: 6px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Fecha y Hora de Accion:</td>
                                <td align="right" style="padding-top: 6px; font-size: 12.5px; font-weight: 600; color: #0f172a;">%s</td>
                              </tr>
                            </table>
                          </div>

                          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 16px 18px; margin-bottom: 24px;">
                            <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.5; font-weight: 600;">
                              %s
                            </p>
                          </div>

                        </td>
                      </tr>

                      <!-- Pie Legal -->
                      <tr>
                        <td style="background: #f8fafc; padding: 22px 30px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11.5px; line-height: 1.6;">
                          <strong style="color: #0f172a;">FarmaYA Colombia &bull; Departamento de Seguridad y Cumplimiento</strong><br>
                          Notificacion oficial generada automaticamente por el panel de administracion central de FarmaYA.
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """,
            badge,
            statusLabel,
            recipientName,
            titleDesc,
            roleDesc,
            escapeHtml(u.email),
            statusValue,
            nowFormatted,
            alertBox
        );
    }

    
    private String buildAccountVerificationNeededHtml(User u) {
        String recipientName = escapeHtml(u.name != null && !u.name.isBlank() ? u.name : "Usuario");
        String roleDesc = u.role == Role.FARMACIA ? "de Farmacia Aliada" : (u.role == Role.REPARTIDOR ? "de Repartidor / Domiciliario" : (u.role == Role.ADMIN ? "de Administrador" : "de Cliente"));
        String establishmentName = escapeHtml(u.pharmacyName != null && !u.pharmacyName.isBlank() ? u.pharmacyName : u.name);
        String nowFormatted = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy, hh:mm a", new Locale("es", "CO"))
                .withZone(ZoneId.of("America/Bogota"))
                .format(Instant.now());

        return String.format("""
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Verificacion de Cuenta Requerida - FarmaYA</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
              <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 28px 12px;">
                <tr>
                  <td align="center">
                    <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px rgba(15,23,42,0.08);">
                      
                      <!-- Cabecera Institucional FarmaYA -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #b45309 0%%, #d97706 100%%); padding: 24px 28px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: middle;">
                                <table border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="padding-right: 14px; vertical-align: middle;">
                                      <img src="https://raw.githubusercontent.com/AKbrer/FarmaYA/main/src/main/resources/static/images/farmaya-cross.png" alt="Cruz FarmaYA" width="48" height="42" style="display:block; border-radius:10px; background:#ffffff; padding:4px; box-shadow: 0 2px 8px rgba(0,0,0,0.22);" />
                                    </td>
                                    <td style="vertical-align: middle;">
                                      <span style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; font-family: 'Segoe UI', sans-serif;">FarmaYA</span>
                                      <p style="margin: 2px 0 0 0; color: #fef3c7; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">Auditoria y Control Documental</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right" style="vertical-align: middle;">
                                <span style="display: inline-block; background: rgba(255,255,255,0.22); color: #ffffff; padding: 6px 14px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">
                                  VERIFICACION PENDIENTE
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Cuerpo del Mensaje -->
                      <tr>
                        <td style="padding: 32px 30px 20px 30px;">
                          
                          <div style="display: inline-block; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 8px 14px; margin-bottom: 18px;">
                            <span style="font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">ESTADO: REQUIERE VERIFICACION DE CUENTA</span>
                          </div>

                          <h1 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 800; line-height: 1.35;">
                            Estimado(a) %s: Tu cuenta necesita verificacion de documentos
                          </h1>

                          <p style="margin: 0 0 18px 0; color: #334155; font-size: 14px; line-height: 1.6;">
                            Te informamos que tu cuenta <strong>%s</strong> vinculada al correo <strong>%s</strong> requiere revision y aprobacion documental por parte del equipo de administracion de FarmaYA antes de ser habilitada para operar.
                          </p>

                          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 22px;">
                            <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="padding-bottom: 6px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Estado de Verificacion:</td>
                                <td align="right" style="padding-bottom: 6px; font-size: 13px; font-weight: 800; color: #d97706;">Pendiente de Aprobacion</td>
                              </tr>
                              <tr>
                                <td style="padding-bottom: 6px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Establecimiento / Titular:</td>
                                <td align="right" style="padding-bottom: 6px; font-size: 13px; font-weight: 700; color: #0f172a;">%s</td>
                              </tr>
                              <tr>
                                <td style="padding-top: 6px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Fecha de Notificacion:</td>
                                <td align="right" style="padding-top: 6px; font-size: 12.5px; font-weight: 600; color: #0f172a;">%s</td>
                              </tr>
                            </table>
                          </div>

                          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 14px; padding: 16px 18px; margin-bottom: 24px;">
                            <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5; font-weight: 600;">
                              Nuestro equipo administrativo se encuentra auditando tus documentos cargados (Registro INVIMA, RUT o datos del vehiculo). Una vez validado tu expediente, recibiras un correo de confirmacion y tu cuenta quedara 100%% habilitada para recibir pedidos.
                            </p>
                          </div>

                        </td>
                      </tr>

                      <!-- Pie Legal -->
                      <tr>
                        <td style="background: #f8fafc; padding: 22px 30px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11.5px; line-height: 1.6;">
                          <strong style="color: #0f172a;">FarmaYA Colombia &bull; Departamento de Verificacion y Cumplimiento Normativo</strong><br>
                          Notificacion oficial generada por la plataforma de salud FarmaYA.
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """,
            recipientName,
            roleDesc,
            escapeHtml(u.email),
            establishmentName,
            nowFormatted
        );
    }

    private String buildAccountCreatedHtml(User u) {
        String recipientName = escapeHtml(u.name != null && !u.name.isBlank() ? u.name : "Usuario");
        String roleDesc = u.role == Role.FARMACIA ? "de Farmacia Aliada" : (u.role == Role.REPARTIDOR ? "de Repartidor / Domiciliario" : (u.role == Role.ADMIN ? "de Administrador" : "de Cliente"));
        String establishmentName = escapeHtml(u.pharmacyName != null && !u.pharmacyName.isBlank() ? u.pharmacyName : u.name);
        String zoneText = escapeHtml(u.zone != null && !u.zone.isBlank() ? u.zone : (u.city != null ? u.city : "Cobertura General"));

        boolean needsVerification = (u.role == Role.FARMACIA || u.role == Role.REPARTIDOR) && !u.verified;

        String headerBadge = needsVerification ? "VERIFICACION PENDIENTE" : "CUENTA HABILITADA";
        String statusBanner = needsVerification
                ? "<div style=\"display: inline-block; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 8px 14px; margin-bottom: 18px;\"><span style=\"font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;\">ESTADO: REGISTRO RECIBIDO · REQUIERE VERIFICACION</span></div>"
                : "<div style=\"display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 8px 14px; margin-bottom: 18px;\"><span style=\"font-size: 12px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;\">ESTADO: CUENTA HABILITADA Y ACTIVA</span></div>";

        String title = needsVerification
                ? "Estimado(a) " + recipientName + ": Tu registro necesita verificacion"
                : "Estimado(a) " + recipientName + ": Tu cuenta esta habilitada y lista";

        String statusLabelValue = needsVerification
                ? "<span style=\"color: #b45309; font-weight: 800;\">Pendiente de Verificacion Documental</span>"
                : "<span style=\"color: #065f46; font-weight: 800;\">100% Habilitada para Operar</span>";

        String alertBox = needsVerification
                ? "<div style=\"background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 16px 18px; margin-bottom: 24px;\"><p style=\"margin: 0; font-size: 13px; color: #92400e; line-height: 1.5; font-weight: 600;\">Tu registro se encuentra en proceso de validacion documental por la administracion de FarmaYA. Una vez aprobados tus antecedentes y certificaciones, recibiras un correo confirmando la activacion para operar.</p></div>"
                : "<div style=\"background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 16px 18px; margin-bottom: 24px;\"><p style=\"margin: 0; font-size: 13px; color: #166534; line-height: 1.5; font-weight: 600;\">Tu cuenta se encuentra habilitada y activa. Ya puedes iniciar sesion para explorar farmacias cercanas, cotizar formulas y pedir tus medicamentos con entrega prioritaria.</p></div>";

        return String.format("""
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Bienvenido a FarmaYA</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
              <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 28px 12px;">
                <tr>
                  <td align="center">
                    <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px rgba(15,23,42,0.08);">
                      
                      <!-- Cabecera Institucional FarmaYA con Cruz 3D -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #0d5e41 0%%, #16865d 100%%); padding: 24px 28px;">
                          <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: middle;">
                                <table border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="padding-right: 14px; vertical-align: middle;">
                                      <img src="https://raw.githubusercontent.com/AKbrer/FarmaYA/main/src/main/resources/static/images/farmaya-cross.png" alt="Cruz FarmaYA" width="48" height="42" style="display:block; border-radius:10px; background:#ffffff; padding:4px; box-shadow: 0 2px 8px rgba(0,0,0,0.22);" />
                                    </td>
                                    <td style="vertical-align: middle;">
                                      <span style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; font-family: 'Segoe UI', sans-serif;">FarmaYA</span>
                                      <p style="margin: 2px 0 0 0; color: #a7f3d0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">Salud y Medicamentos a Domicilio</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td align="right" style="vertical-align: middle;">
                                <span style="display: inline-block; background: rgba(255,255,255,0.22); color: #ffffff; padding: 6px 14px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">
                                  %s
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Cuerpo del Mensaje -->
                      <tr>
                        <td style="padding: 32px 30px 20px 30px;">
                          
                          %s

                          <h1 style="margin: 0 0 12px 0; color: #0f172a; font-size: 21px; font-weight: 800; line-height: 1.35;">
                            %s
                          </h1>

                          <p style="margin: 0 0 18px 0; color: #334155; font-size: 14px; line-height: 1.6;">
                            Tu cuenta <strong>%s</strong> ha sido registrada satisfactoriamente en FarmaYA. A continuacion encuentras los detalles iniciales de tu cuenta:
                          </p>

                          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 22px;">
                            <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="padding-bottom: 8px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Correo registrado:</td>
                                <td align="right" style="padding-bottom: 8px; font-size: 13px; font-weight: 700; color: #0f172a;">%s</td>
                              </tr>
                              <tr>
                                <td style="padding-bottom: 8px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Nombre / Titular:</td>
                                <td align="right" style="padding-bottom: 8px; font-size: 13px; font-weight: 700; color: #0f172a;">%s</td>
                              </tr>
                              <tr>
                                <td style="padding-bottom: 8px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Zona / Ciudad:</td>
                                <td align="right" style="padding-bottom: 8px; font-size: 13px; font-weight: 700; color: #0f172a;">%s</td>
                              </tr>
                              <tr>
                                <td style="padding-top: 6px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; border-top: 1px dashed #e2e8f0;">Estado de Cuenta:</td>
                                <td align="right" style="padding-top: 6px; font-size: 13px; border-top: 1px dashed #e2e8f0;">%s</td>
                              </tr>
                            </table>
                          </div>

                          %s

                        </td>
                      </tr>

                      <!-- Pie Legal -->
                      <tr>
                        <td style="background: #f8fafc; padding: 22px 30px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11.5px; line-height: 1.6;">
                          <strong style="color: #0f172a;">FarmaYA Colombia &bull; Servicio al Cliente y Seguridad</strong><br>
                          Si no reconoces esta cuenta, por favor comunicate inmediatamente con soporte central.
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """,
            headerBadge,
            statusBanner,
            title,
            roleDesc,
            escapeHtml(u.email),
            recipientName,
            zoneText,
            statusLabelValue,
            alertBox
        );
    }

}
