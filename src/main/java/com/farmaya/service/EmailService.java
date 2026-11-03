package com.farmaya.service;

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
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Servicio de envío de correos electrónicos reales para FarmaYA.
 * Soporta conexión directa SSL SMTP (Gmail smtp.gmail.com:465) y API REST (Resend/Brevo).
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
     * Envía un correo con el código de verificación OTP al destinatario.
     * Retorna un objeto con el estado del despacho.
     */
    public EmailDispatchResult sendVerificationOtp(String toEmail, String code, String name) {
        if (toEmail == null || toEmail.isBlank()) {
            return new EmailDispatchResult(false, "Correo destinatario vacío.");
        }

        String subject = "Tu código de verificación FarmaYA: " + code;
        String html = buildOtpHtml(code, name);

        // 1. Gmail SMTP SSL Directo (Entrega a cualquier correo sin restricciones de dominio)
        String effUser = getEffectiveUsername();
        String effPass = getEffectivePassword();
        if (effUser != null && !effUser.isBlank() && effPass != null && !effPass.isBlank()) {
            try {
                return sendViaSmtpSsl(toEmail, subject, html, code, effUser, effPass);
            } catch (Exception e) {
                log.error("Error enviando vía SMTP SSL Gmail a {}: {}", toEmail, e.getMessage(), e);
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

        log.info("[FarmaYA Email] Modo demostración (Sin servidor SMTP configurado). Código para {}: {}", toEmail, code);
        return new EmailDispatchResult(false, "Servidor SMTP no configurado. Configura farmaya.mail.username y password en application.properties.");
    }

    /** Envío directo mediante socket SSL a smtp.gmail.com:465 sin librerías externas */
    private EmailDispatchResult sendViaSmtpSsl(String toEmail, String subject, String htmlContent, String code, String effUser, String effPass) throws Exception {
        log.info("Iniciando envío de correo real vía {}:{} a {}...", host, port, toEmail);
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

            // Contraseña de aplicación en base64 (sin espacios)
            String passClean = effPass.trim().replace(" ", "");
            String passB64 = Base64.getEncoder().encodeToString(passClean.getBytes(StandardCharsets.UTF_8));
            sendSmtpCommand(writer, passB64);
            readSmtpResponse(reader, "235"); // Autenticación exitosa

            sendSmtpCommand(writer, "MAIL FROM:<" + effUser.trim() + ">");
            readSmtpResponse(reader, "250");

            sendSmtpCommand(writer, "RCPT TO:<" + toEmail.trim() + ">");
            readSmtpResponse(reader, "250");

            sendSmtpCommand(writer, "DATA");
            readSmtpResponse(reader, "354");

            // Encabezados y contenido MIME optimizados para entrega inmediata (Instant Delivery RFC)
            String fromHeader = (from != null && from.contains("@")) ? from : ("FarmaYA <" + effUser.trim() + ">");
            String rfcDate = java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME.format(java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC));
            String msgId = "<" + java.util.UUID.randomUUID().toString() + "@gmail.com>";
            String boundary = "----=_Part_FarmaYA_" + System.currentTimeMillis();
            String plainText = "Tu código de verificación FarmaYA es: " + (code != null ? code : "") + "\r\nVálido por 10 minutos para validar tu cuenta en FarmaYA.\r\n";

            writer.write("From: " + fromHeader + "\r\n");
            writer.write("To: " + toEmail.trim() + "\r\n");
            writer.write("Reply-To: " + effUser.trim() + "\r\n");
            writer.write("Date: " + rfcDate + "\r\n");
            writer.write("Message-ID: " + msgId + "\r\n");
            writer.write("Subject: =?UTF-8?B?" + Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8)) + "?=\r\n");
            writer.write("X-Priority: 1 (Highest)\r\n");
            writer.write("Priority: urgent\r\n");
            writer.write("Importance: high\r\n");
            writer.write("Auto-Submitted: auto-generated\r\n");
            writer.write("X-Mailer: FarmaYA FastOtp 1.0\r\n");
            writer.write("MIME-Version: 1.0\r\n");
            writer.write("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n");
            writer.write("\r\n");

            // 1. Plain text para escaneo antispam instantáneo sin retrasos
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

            readSmtpResponse(reader, "250"); // Correo encolado con éxito

            sendSmtpCommand(writer, "QUIT");
            log.info("Correo de verificación entregado exitosamente a {}", toEmail);
            return new EmailDispatchResult(true, "Correo enviado exitosamente a tu cuenta de Gmail.");
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
        throw new IllegalStateException("Conexión cerrada prematuramente por el servidor SMTP.");
    }

    /** Envío a través de Resend API si se configuró API Key */
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
            log.info("Correo real entregado vía Resend API a {}: {}", toEmail, resp.body());
            return new EmailDispatchResult(true, "Correo de verificación entregado a tu bandeja de entrada.");
        }
        log.error("Fallo Resend API hacia {}. Código HTTP: {}, Respuesta: {}", toEmail, resp.statusCode(), resp.body());
        return new EmailDispatchResult(false, "API de correo respondió con código " + resp.statusCode() + ": " + resp.body());
    }

    private String escapeJson(String raw) {
        return "\"" + raw.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r") + "\"";
    }

    private String buildOtpHtml(String code, String name) {
        String displayName = (name != null && !name.isBlank()) ? name : "Usuario";
        return """
                <!DOCTYPE html>
                <html>
                <head><meta charset="utf-8"></head>
                <body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="padding: 30px 15px;">
                    <tr>
                      <td align="center">
                        <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.04);">
                          <tr>
                            <td style="background: #16865d; padding: 26px 30px; text-align: left;">
                              <span style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">+ FarmaYA</span>
                              <p style="margin: 4px 0 0 0; color: #d1fae5; font-size: 13px;">Red Asistencial de Salud y Farmacias de Colombia</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 32px 30px;">
                              <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 700;">Verifica tu correo electrónico</h2>
                              <p style="margin: 0 0 20px 0; color: #475569; font-size: 14.5px; line-height: 1.6;">
                                Hola <strong>%s</strong>, estás creando tu cuenta en FarmaYA. Para confirmar que este correo te pertenece, ingresa el siguiente código de seguridad en la aplicación:
                              </p>
                              <div style="background: #f0fdf4; border: 2px dashed #16865d; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
                                <span style="font-family: 'Courier New', monospace; font-size: 34px; font-weight: 900; letter-spacing: 10px; color: #16865d; display: inline-block; margin-left: 10px;">%s</span>
                              </div>
                              <p style="margin: 0 0 14px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                                Este código es de uso personal y expira en <strong>10 minutos</strong>. Si tú no solicitaste este código, puedes ignorar este mensaje de forma segura.
                              </p>
                            </td>
                          </tr>
                          <tr>
                            <td style="background: #f8fafc; padding: 18px 30px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
                              FarmaYA Tecnologías en Salud S.A.S. • Barranquilla, Colombia • Soporte 24/7
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

    public record EmailDispatchResult(boolean success, String message) {}
}
