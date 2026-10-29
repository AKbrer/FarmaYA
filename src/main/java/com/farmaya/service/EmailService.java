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

        // 1. Si hay API Key configurada (ej. Resend API)
        if (apiKey != null && !apiKey.isBlank()) {
            try {
                return sendViaResendApi(toEmail, subject, html);
            } catch (Exception e) {
                log.error("Error enviando por API de correo: {}", e.getMessage());
            }
        }

        // 2. Si hay credenciales de Gmail SMTP configuradas (host, username, password)
        if (username != null && !username.isBlank() && password != null && !password.isBlank()) {
            try {
                return sendViaSmtpSsl(toEmail, subject, html);
            } catch (Exception e) {
                log.error("Error enviando vía SMTP SSL Gmail a {}: {}", toEmail, e.getMessage());
                return new EmailDispatchResult(false, "Fallo de conexión SMTP: " + e.getMessage());
            }
        }

        log.info("[FarmaYA Email] Modo demostración (Sin servidor SMTP configurado). Código para {}: {}", toEmail, code);
        return new EmailDispatchResult(false, "Servidor SMTP no configurado. Configura farmaya.mail.username y password en application.properties.");
    }

    /** Envío directo mediante socket SSL a smtp.gmail.com:465 sin librerías externas */
    private EmailDispatchResult sendViaSmtpSsl(String toEmail, String subject, String htmlContent) throws Exception {
        log.info("Iniciando envío de correo real vía {}:{} a {}...", host, port, toEmail);
        SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();

        try (SSLSocket socket = (SSLSocket) factory.createSocket(host, port);
             BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8))) {

            socket.setSoTimeout(15000);

            readSmtpResponse(reader, "220"); // Saludo del servidor
            sendSmtpCommand(writer, "EHLO localhost");
            readSmtpResponse(reader, "250");

            sendSmtpCommand(writer, "AUTH LOGIN");
            readSmtpResponse(reader, "334");

            // Usuario en base64
            String userB64 = Base64.getEncoder().encodeToString(username.trim().getBytes(StandardCharsets.UTF_8));
            sendSmtpCommand(writer, userB64);
            readSmtpResponse(reader, "334");

            // Contraseña de aplicación en base64 (sin espacios)
            String passClean = password.trim().replace(" ", "");
            String passB64 = Base64.getEncoder().encodeToString(passClean.getBytes(StandardCharsets.UTF_8));
            sendSmtpCommand(writer, passB64);
            readSmtpResponse(reader, "235"); // Autenticación exitosa

            sendSmtpCommand(writer, "MAIL FROM:<" + username.trim() + ">");
            readSmtpResponse(reader, "250");

            sendSmtpCommand(writer, "RCPT TO:<" + toEmail.trim() + ">");
            readSmtpResponse(reader, "250");

            sendSmtpCommand(writer, "DATA");
            readSmtpResponse(reader, "354");

            // Encabezados y contenido MIME
            writer.write("From: " + from + "\r\n");
            writer.write("To: " + toEmail.trim() + "\r\n");
            writer.write("Subject: =?UTF-8?B?" + Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8)) + "?=\r\n");
            writer.write("MIME-Version: 1.0\r\n");
            writer.write("Content-Type: text/html; charset=UTF-8\r\n");
            writer.write("Content-Transfer-Encoding: base64\r\n");
            writer.write("\r\n");

            // Cuerpo en Base64 para evitar problemas con caracteres especiales y saltos de línea
            String bodyB64 = Base64.getMimeEncoder().encodeToString(htmlContent.getBytes(StandardCharsets.UTF_8));
            writer.write(bodyB64);
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
    private EmailDispatchResult sendViaResendApi(String toEmail, String subject, String html) throws Exception {
        String payload = String.format("""
                {"from":"%s","to":["%s"],"subject":"%s","html":%s}
                """, from, toEmail, subject, escapeJson(html));

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.resend.com/emails"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
            return new EmailDispatchResult(true, "Correo enviado mediante API.");
        }
        return new EmailDispatchResult(false, "API de correo respondió con error: " + resp.statusCode());
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
