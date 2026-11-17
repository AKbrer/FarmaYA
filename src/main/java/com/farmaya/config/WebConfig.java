package com.farmaya.config;

import com.farmaya.web.AuthInterceptor;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final AuthInterceptor auth;

    public WebConfig(AuthInterceptor auth) {
        this.auth = auth;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(auth).addPathPatterns("/api/**");
    }

    @Bean
    public FilterRegistrationBean<Filter> securityHeadersFilter() {
        FilterRegistrationBean<Filter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new Filter() {
            @Override
            public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                    throws IOException, ServletException {
                if (response instanceof HttpServletResponse res) {
                    res.setHeader("X-Content-Type-Options", "nosniff");
                    res.setHeader("X-Frame-Options", "SAMEORIGIN");
                    res.setHeader("X-XSS-Protection", "1; mode=block");
                    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
                    res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
                }
                chain.doFilter(request, response);
            }
        });
        bean.setOrder(1);
        return bean;
    }
}
