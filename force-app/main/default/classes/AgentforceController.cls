/**
 * Controller for the AgentforceChat LWC
 * Handles communication with the Agentforce API
 */
public with sharing class AgentforceController {
    
    private static final String API_ENDPOINT = 'callout:AgentforceAPI';
    
    /**
     * Initialize a new agent session
     * @param agentId The ID of the agent to initialize
     * @return String The session ID for the new session
     */
    @AuraEnabled
    public static String initializeAgentSession(String agentId) {
        try {
            // Validate input
            if (String.isBlank(agentId)) {
                throw new AuraHandledException('Agent ID is required');
            }
            
            // Prepare API request
            HttpRequest req = new HttpRequest();
            req.setEndpoint(API_ENDPOINT + '/sessions');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            
            // Prepare request body
            Map<String, Object> requestBody = new Map<String, Object>{
                'agentId' => agentId,
                'metadata' => new Map<String, Object>{
                    'source' => 'salesforce',
                    'userId' => UserInfo.getUserId(),
                    'url' => URL.getSalesforceBaseUrl().toExternalForm()
                }
            };
            
            req.setBody(JSON.serialize(requestBody));
            
            // Send request
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            // Process response
            if (res.getStatusCode() == 200 || res.getStatusCode() == 201) {
                Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                String sessionId = (String) responseData.get('sessionId');
                
                if (String.isBlank(sessionId)) {
                    throw new AuraHandledException('Invalid session ID received from API');
                }
                
                return sessionId;
            } else {
                String errorMsg = 'API error: ' + res.getStatusCode() + ' ' + res.getStatus();
                System.debug(LoggingLevel.ERROR, errorMsg);
                throw new AuraHandledException(errorMsg);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error initializing agent session: ' + e.getMessage());
            throw new AuraHandledException('Error initializing agent session: ' + e.getMessage());
        }
    }
    
    /**
     * Get a response from the agent
     * @param sessionId The session ID
     * @param message The message to send to the agent
     * @return String The agent's response
     */
    @AuraEnabled
    public static String getAgentResponse(String sessionId, String message) {
        try {
            // Validate input
            if (String.isBlank(sessionId)) {
                throw new AuraHandledException('Session ID is required');
            }
            
            if (String.isBlank(message)) {
                throw new AuraHandledException('Message is required');
            }