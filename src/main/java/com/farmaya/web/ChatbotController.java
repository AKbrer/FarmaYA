package com.farmaya.web;

import com.farmaya.model.Dtos.ChatRequest;
import com.farmaya.model.Dtos.ChatResponse;
import com.farmaya.service.ChatbotService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
public class ChatbotController {

    private final ChatbotService chatbotService;

    public ChatbotController(ChatbotService chatbotService) {
        this.chatbotService = chatbotService;
    }

    @Public
    @PostMapping("/ask")
    public ResponseEntity<ChatResponse> askBot(@RequestBody(required = false) ChatRequest request) {
        ChatResponse response = chatbotService.processUserQuery(request);
        return ResponseEntity.ok(response);
    }
}
