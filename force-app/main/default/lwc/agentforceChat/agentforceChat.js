import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAudioFromText from '@salesforce/apex/ElevenLabsTTSController.getAudioFromText';
import initializeAgentSession from '@salesforce/apex/AgentforceController.initializeAgentSession';
import getAgentResponse from '@salesforce/apex/AgentforceController.getAgentResponse';
import endAgentSession from '@salesforce/apex/AgentforceController.endAgentSession';
import saveChatTranscript from '@salesforce/apex/AgentforceController.saveChatTranscript';

export default class AgentforceChat extends LightningElement {
    // API properties for configuration
    @api agentId = '2F005Hs00000HDK7D'; // Default agent ID
    @api headerText = 'Agentforce';
    @api welcomeMessage = 'Hello! How can I assist you today?';
    @api allowVoiceMode = false;
    @api position = 'bottom-right';
    @api defaultDarkMode = false;

    // Reactive component state
    @track messages = [];
    @track messageText = '';
    @track isDarkMode = false;
    @track isFullscreen = false;
    @track isVoiceMode = false;
    @track voiceStatus = '';
    @track isThinking = false;
    @track sessionId = null;
    @track showOptionsMenu = false;
    @track isTypewriterActive = false;
    @track showEndChatModal = false;
    @track isInitializing = false;
    @track isListening = false;
    @track isSpeaking = false;

    // Internal state
    isInitialized = false;
    recognition = null;
    currentAudio = null;
    isFirstThinkingMessage = true;

    // Window event listeners
    connectedCallback() {
        // Check system dark mode preference
        this.checkDarkMode();
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.checkDarkMode.bind(this));

        // Load saved dark mode preference if available
        try {
            const savedTheme = localStorage.getItem('agentforceChatDarkMode');
            this.isDarkMode = savedTheme !== null ? savedTheme === 'true' : this.defaultDarkMode;
        } catch (e) {
            console.error('Error accessing localStorage', e);
            this.isDarkMode = this.defaultDarkMode;
        }

        // Initialize the agent session
        if (this.agentId) {
            this.initializeAgentSession();
        }
    }

    disconnectedCallback() {
        // Clean up event listeners
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this.checkDarkMode.bind(this));
        
        // Stop voice recognition if active
        this.stopVoiceRecognition();
        
        // Close audio playback if any
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
    }

    // Check system dark mode preference
    checkDarkMode() {
        const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDarkMode !== this.isDarkMode && !localStorage.getItem('agentforceChatDarkMode')) {
            this.isDarkMode = prefersDarkMode;
        }
    }

    // Initialize agent session
    initializeAgentSession() {
        if (this.isInitialized || this.isInitializing) {
            console.log('Skipping initialization – already initialized or in progress');
            return;
        }
        
        if (!this.agentId) {
            console.error('Missing Agent ID: Please configure an Agent ID in the component properties');
            this.addSystemMessage('Error: Agent ID not configured. Please ask your administrator to configure an Agent ID.');
            return;
        }
        
        console.log('Initializing Agentforce session with agent ID:', this.agentId);
        this.isInitializing = true;
        this.addSystemMessage('Initializing Agentforce...');
        
        const initializationTimeout = setTimeout(() => {
            console.log('Initialization is taking longer than expected...');
            this.updateInitializationMessage('Still connecting to Agentforce...');
        }, 5000);
        
        initializeAgentSession({ agentId: this.agentId })
            .then(result => {
                clearTimeout(initializationTimeout);
                console.log('Session initialized successfully:', result);
                
                if (!result) {
                    throw new Error('Session initialization failed – no session ID returned');
                }
                
                this.sessionId = result;
                this.isInitialized = true;
                this.isInitializing = false;
                this.updateInitializationMessage('Connected to Agentforce successfully!');
                
                // Send welcome message after successful initialization
                setTimeout(() => {
                    // Remove initialization messages
                    this.messages = this.messages.filter(m => 
                        !m.text.includes('Connected to Agentforce') && 
                        !m.text.includes('Initializing Agentforce')
                    );
                    
                    // Add welcome message from the agent
                    this.getAgentResponse('Hello');
                }, 1500);
            })
            .catch(error => {
                clearTimeout(initializationTimeout);
                this.isInitializing = false;
                
                console.error('Error initializing Agentforce session:', error);
                const errorMsg = this.getErrorMessage(error);
                
                this.updateInitializationMessage("Couldn't connect to Agentforce. Please contact your administrator.");
                this.addSystemMessage(`Error: ${errorMsg}`);
            });
    }
    
    // Update initialization message
    updateInitializationMessage(text) {
        const initMsgIndex = this.messages.findIndex(m =>
            m.text.includes('Initializing Agentforce') ||
            m.text.includes('connecting to Agentforce') ||
            m.text.includes('Reconnecting to Agentforce')
        );
        
        if (initMsgIndex !== -1) {
            const updatedMessages = [...this.messages];
            updatedMessages[initMsgIndex] = { ...updatedMessages[initMsgIndex], text };
            this.messages = updatedMessages;
        }
    }
    
    // Get response from Agentforce agent
    getAgentResponse(message) {
        if (!message || this.isThinking) {
            return;
        }
        
        this.isThinking = true;
        
        // Add a typing indicator
        const typingId = `typing_${Date.now()}`;
        const typingText = this.isFirstThinkingMessage ? 
            "Agentforce incoming..." : 
            "Agentforce is thinking...";
            
        // Update first message flag
        if (this.isFirstThinkingMessage) {
            this.isFirstThinkingMessage = false;
        }
        
        // Add typing indicator message
        if (!this.isVoiceMode) {
            this.messages = [...this.messages, {
                id: typingId,
                text: typingText,
                isAgent: true,
                cssClass: 'message bot-message typing shimmer-text',
                timestamp: this.getTimestamp(),
                isTypingMessage: true
            }];
        }
        
        // Get response from agent
        getAgentResponse({ sessionId: this.sessionId, message })
            .then(response => {
                console.log('Agent response received, length:', response ? response.length : 0);
                
                // Remove typing indicator
                if (!this.isVoiceMode) {
                    this.messages = this.messages.filter(m => 
                        !m.isTypingMessage &&
                        !m.text.includes('Agentforce is thinking') && 
                        !m.text.includes('Agentforce incoming')
                    );
                }
                
                this.isThinking = false;
                
                if (response) {
                    // Extract thinking process from <think> tags if present
                    let thinkingProcess = '';
                    let displayText = response;
                    
                    const thinkRegex = /<think>([\s\S]*?)<\/think>/;
                    const match = response.match(thinkRegex);
                    
                    if (match && match[1]) {
                        thinkingProcess = match[1].trim();
                        // Remove the thinking process from the display text
                        displayText = response.replace(thinkRegex, '').trim();
                    }
                    
                    // Add message to chat
                    const messageId = `msg_${Date.now()}`;
                    this.messages = [...this.messages, {
                        id: messageId,
                        text: displayText,
                        isAgent: true,
                        timestamp: this.getTimestamp(),
                        footnote: thinkingProcess
                    }];
                    
                    // Speak text if in voice mode
                    if (this.isVoiceMode) {
                        const cleanText = this.stripHtmlTags(displayText);
                        this.playAgentResponseWithVoice(cleanText);
                    }
                } else {
                    // Handle empty response
                    this.addAgentMessage("I'm sorry, I don't have a response for that right now.");
                }
            })
            .catch(error => {
                console.error('Error getting agent response:', error);
                const errorMsg = this.getErrorMessage(error);
                
                // Remove typing indicator
                this.messages = this.messages.filter(m => m.id !== typingId);
                this.isThinking = false;
                
                // Add error message
                this.addAgentMessage("I'm sorry, I encountered an error while processing your request.");
                this.addSystemMessage(`Error: ${errorMsg}`);
            });
    }
    
    // Send message
    sendMessage() {
        const textArea = this.template.querySelector('textarea');
        const message = textArea ? textArea.value.trim() : '';
        
        if (!message) {
            return;
        }
        
        if (textArea) {
            textArea.value = '';
            this.messageText = '';
        }
        
        // Add user message to chat
        this.addUserMessage(message);
        
        // Get agent response
        this.getAgentResponse(message);
    }
    
    // Add user message
    addUserMessage(text) {
        if (!text.trim()) {
            return;
        }
        
        this.messages.push({
            id: Date.now(),
            text,
            isAgent: false,
            timestamp: this.getTimestamp()
        });
    }
    
    // Add agent message
    addAgentMessage(text, footnote = null) {
        if (!text) {
            return;
        }
        
        const messageId = `msg_${Date.now()}`;
        this.messages.push({
            id: messageId,
            text,
            isAgent: true,
            timestamp: this.getTimestamp(),
            footnote
        });
        
        // Speak text if in voice mode
        if (this.isVoiceMode) {
            this.playAgentResponseWithVoice(text);
        }
    }
    
    // Add system message
    addSystemMessage(text) {
        if (!text) {
            return;
        }
        
        this.messages.push({
            id: `system_${Date.now()}`,
            text,
            isSystem: true,
            timestamp: this.getTimestamp()
        });
    }
    
    // Toggle dark mode
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        
        try {
            localStorage.setItem('agentforceChatDarkMode', this.isDarkMode.toString());
        } catch (e) {
            console.error('Error saving theme preference', e);
        }
        
        this.showOptionsMenu = false;
    }
    
    // Toggle fullscreen mode
    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
        this.showOptionsMenu = false;
    }
    
    // Toggle voice mode
    toggleVoiceMode() {
        if (!this.allowVoiceMode) {
            return;
        }
        
        // Stop any current audio playback
        this.stopAudioPlayback();
        
        this.isVoiceMode = !this.isVoiceMode;
        
        if (this.isVoiceMode) {
            this.isListening = true;
            this.isSpeaking = false;
            this.voiceStatus = 'Listening...';
            
            // Start voice recognition
            this.startVoiceRecognition();
        } else {
            this.isListening = false;
            this.isSpeaking = false;
            this.voiceStatus = '';
            this.stopVoiceRecognition();
        }
        
        this.showOptionsMenu = false;
    }
    
    // Toggle options menu
    toggleOptionsMenu() {
        this.showOptionsMenu = !this.showOptionsMenu;
    }
    
    // Toggle footnote display
    toggleFootnote(event) {
        const messageId = event.currentTarget.dataset.id;
        const footnoteContent = this.template.querySelector(`.footnote-content[data-id="${messageId}"]`);
        
        if (footnoteContent) {
            footnoteContent.classList.toggle('expanded');
            
            // Update toggle text
            const toggleEl = event.currentTarget;
            const spanEl = toggleEl.querySelector('span');
            
            if (footnoteContent.classList.contains('expanded')) {
                spanEl.textContent = 'Hide thinking process';
            } else {
                spanEl.textContent = 'Show thinking process';
            }
        }
    }
    
    // Handle input changes
    handleInputKey(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        } else {
            this.resizeTextarea(event.target);
        }
    }
    
    // Handle message input change
    handleMessageChange(event) {
        this.messageText = event.target.value;
        this.resizeTextarea(event.target);
    }
    
    // Resize textarea based on content
    resizeTextarea(textarea) {
        if (!textarea) {
            return;
        }
        
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }
    
    // Play agent response with voice
    async playAgentResponseWithVoice(text) {
        if (!text) {
            return;
        }
        
        try {
            this.voiceStatus = 'Generating voice...';
            this.isSpeaking = true;
            this.isListening = false;
            
            // Get audio from text
            const base64Audio = await getAudioFromText({ text });
            const audioBlob = this.base64ToBlob(base64Audio, 'audio/mpeg');
            const audioUrl = URL.createObjectURL(audioBlob);
            
            this.voiceStatus = 'Playing voice...';
            
            const statusEl = this.template.querySelector('.voice-status');
            if (statusEl) {
                statusEl.classList.add('pulsing');
            }
            
            const audio = new Audio(audioUrl);
            this.currentAudio = audio;
            
            audio.onerror = () => {
                console.error('Voice playback error occurred.');
                this.voiceStatus = 'Voice playback failed. Showing text only.';
                if (statusEl) statusEl.classList.remove('pulsing');
                setTimeout(() => this.voiceStatus = '', 3000);
                this.isSpeaking = false;
                this.isListening = true;
                
                // Restart voice recognition
                if (this.isVoiceMode) {
                    this.startVoiceRecognition();
                }
            };
            
            audio.onended = () => {
                this.voiceStatus = '';
                if (statusEl) statusEl.classList.remove('pulsing');
                this.isSpeaking = false;
                this.isListening = true;
                this.currentAudio = null;
                
                // Restart voice recognition
                if (this.isVoiceMode) {
                    this.startVoiceRecognition();
                }
            };
            
            audio.play();
        } catch (error) {
            console.error('Audio playback failed:', error);
            this.voiceStatus = 'Voice unavailable. Message shown as text.';
            
            const statusEl = this.template.querySelector('.voice-status');
            if (statusEl) statusEl.classList.remove('pulsing');
            
            setTimeout(() => this.voiceStatus = '', 3000);
            this.isSpeaking = false;
            this.isListening = true;
            
            // Restart voice recognition
            if (this.isVoiceMode) {
                this.startVoiceRecognition();
            }
        }
    }
    
    // Convert base64 to blob
    base64ToBlob(base64, mime) {
        const byteCharacters = atob(base64);
        const byteArrays = [];
        
        for (let i = 0; i < byteCharacters.length; i += 1024) {
            const slice = byteCharacters.slice(i, i + 1024);
            const byteNumbers = new Array(slice.length);
            
            for (let j = 0; j < slice.length; j++) {
                byteNumbers[j] = slice.charCodeAt(j);
            }
            
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        
        return new Blob(byteArrays, { type: mime });
    }
    
    // Start voice recognition
    startVoiceRecognition() {
        try {
            // First make sure any existing recognition is stopped
            if (this.recognition) {
                try {
                    this.recognition.stop();
                } catch (e) {
                    console.log('Ignoring error when stopping existing recognition');
                }
                this.recognition = null;
            }
            
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                this.recognition = new SpeechRecognition();
                this.recognition.continuous = false;
                this.recognition.interimResults = true;
                this.recognition.lang = 'en-US';
                
                this.recognition.onstart = () => {
                    console.log('Voice recognition started');
                    this.isListening = true;
                    this.voiceStatus = 'Listening...';
                };
                
                this.recognition.onresult = (event) => {
                    const resultIndex = event.resultIndex;
                    const transcript = event.results[resultIndex][0].transcript;
                    
                    if (event.results[resultIndex].isFinal && transcript.trim().length > 0) {
                        console.log('Final voice transcript:', transcript);
                        
                        // Set UI state to "thinking"
                        this.isListening = false;
                        this.voiceStatus = 'Agentforce is thinking...';
                        
                        // Add the user message to the conversation
                        this.addUserMessage(transcript);
                        
                        // Stop listening while processing
                        try { this.recognition.stop(); } catch (e) { console.error(e); }
                        
                        // Get agent response
                        this.getAgentResponse(transcript);
                    }
                };
                
                this.recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    // Only show error and exit voice mode for critical errors, not for abort/no-speech
                    if (event.error !== 'aborted' && event.error !== 'no-speech') {
                        this.showToast('Voice Error', 'Voice recognition error: ' + event.error, 'error');
                        this.isVoiceMode = false;
                        this.isListening = false;
                    } else {
                        console.log('Non-critical recognition error:', event.error);
                    }
                };
                
                this.recognition.onend = () => {
                    console.log('Voice recognition ended');
                    // Only restart if we're still in listening mode and not speaking
                    if (this.isVoiceMode && this.isListening && !this.isSpeaking) {
                        try { 
                            setTimeout(() => {
                                this.recognition.start();
                            }, 200);
                        } catch (e) { 
                            console.error('Failed to restart voice recognition', e); 
                        }
                    }
                };
                
                // Start recognition with a small delay to ensure previous instance is cleaned up
                setTimeout(() => {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        console.error('Error starting recognition after delay:', e);
                    }
                }, 100);
            } else {
                console.log('Speech recognition not supported');
                this.showToast('Not Supported', 'Voice mode is not supported in your browser.', 'warning');
                this.isVoiceMode = false;
                this.isListening = false;
            }
        } catch (error) {
            console.error('Error initializing voice recognition:', error);
            this.showToast('Voice Error', 'Voice recognition not available.', 'error');
            this.isVoiceMode = false;
            this.isListening = false;
        }
    }
    
    // Stop voice recognition
    stopVoiceRecognition() {
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {
                console.error('Error stopping voice recognition:', e);
            }
            this.recognition = null;
        }
    }
    
    // Stop audio playback
    stopAudioPlayback() {
        // Cancel any Web Speech API synthesis
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        
        // Stop current audio if playing
        if (this.currentAudio) {
            try {
                this.currentAudio.pause();
                this.currentAudio = null;
            } catch (e) {
                console.error('Error stopping audio playback:', e);
            }
        }
    }
    
    // Show toast message
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({ title, message, variant });
        this.dispatchEvent(evt);
    }
    
    // Get error message
    getErrorMessage(error) {
        if (!error) {
            return 'Unknown error';
        }
        
        if (typeof error === 'string') {
            return error;
        }
        
        if (error.body && error.body.message) {
            return error.body.message;
        }
        
        if (error.message) {
            return error.message;
        }
        
        return 'Unknown error occurred';
    }
    
    // Get timestamp
    getTimestamp() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    // Strip HTML tags from text
    stripHtmlTags(html) {
        if (!html) return '';
        
        try {
            // First remove any <think> tags and their content
            const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
            const textWithoutThinking = html.replace(thinkRegex, '');
            
            // Create a temporary div element
            const tempDiv = document.createElement('div');
            
            // Set the HTML content
            tempDiv.innerHTML = textWithoutThinking;
            
            // Return the text content only (strips all HTML tags)
            return tempDiv.textContent || tempDiv.innerText || '';
        } catch (error) {
            console.error('Error stripping HTML tags:', error);
            // Fallback to basic tag stripping
            return html.replace(/<\/?[^>]+(>|$)/g, '');
        }
    }
    
    // End chat
    endChat() {
        this.showEndChatModal = false;
        
        // Stop any playing audio
        this.stopAudioPlayback();
        
        // Add goodbye message
        this.addSystemMessage('Thank you for chatting with us today. Your conversation has ended.');
        
        // End session
        if (this.sessionId) {
            endAgentSession({ sessionId: this.sessionId })
                .then(() => {
                    console.log('Session ended successfully');
                    
                    // Save chat transcript
                    this.saveChatTranscript();
                    
                    // Reset session
                    this.sessionId = null;
                    this.isInitialized = false;
                })
                .catch(error => {
                    console.error('Error ending session:', error);
                });
        }
    }
    
    // Cancel end chat
    cancelEndChat() {
        this.showEndChatModal = false;
    }
    
    // Show end chat confirmation
    showEndChatConfirmation() {
        // Stop any audio playback
        this.stopAudioPlayback();
        this.showEndChatModal = true;
        this.showOptionsMenu = false;
    }
    
    // Save chat transcript
    saveChatTranscript() {
        const messagesJson = JSON.stringify(this.messages);
        saveChatTranscript({ messages: messagesJson })
            .then(result => {
                console.log('Chat transcript saved:', result);
            })
            .catch(error => {
                console.error('Error saving chat transcript:', error);
            });
    }
    
    // Rendered callback
    renderedCallback() {
        this.messages.forEach((msg) => {
            if (msg.isAgent && msg.text) {
                const el = this.template.querySelector(`.bubble-text[data-id="${msg.id}"]`);
                if (el) {
                    el.innerHTML = msg.text;
                }
            }
        });
        
        this.scrollToBottom();
    }
    
    // Scroll to bottom of chat
    scrollToBottom() {
        const chatContainer = this.template.querySelector('.chat-messages');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
    
    // Get CSS classes for message
    getMessageClass(msg) {
        return msg.isAgent ? 'msg agent-msg' : 'msg user-msg';
    }
    
    // Computed properties for CSS classes
    get computedShellClass() {
        return this.isDarkMode ? 'chat-shell dark-mode' : 'chat-shell';
    }
    
    get computedChatboxClass() {
        let base = 'chatbox';
        if (this.isFullscreen) base += ' fullscreen';
        return base;
    }
    
    get themeIcon() {
        return this.isDarkMode ? 'utility:daylight' : 'utility:night';
    }
    
    get expandIcon() {
        return this.isFullscreen ? 'utility:contract' : 'utility:expand';
    }
    
    get voiceIcon() {
        return this.isVoiceMode ? 'utility:keyboard' : 'utility:unmuted';
    }
    
    get isInputDisabled() {
        return this.isThinking || this.isTypewriterActive || this.isVoiceMode;
    }
    
    // NEW getter methods for HTML template fixes
    get themeModeText() {
        return this.isDarkMode ? 'Light Mode' : 'Dark Mode';
    }
    
    get voiceModeText() {
        return this.isVoiceMode ? 'Text Mode' : 'Voice Mode';
    }
    
    get fullscreenText() {
        return this.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
    }
}