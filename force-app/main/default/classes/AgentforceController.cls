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
            
            // Prepare API request
            HttpRequest req = new HttpRequest();
            req.setEndpoint(API_ENDPOINT + '/sessions/' + sessionId + '/messages');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            
            // Prepare request body
            Map<String, Object> requestBody = new Map<String, Object>{
                'message' => message,
                'metadata' => new Map<String, Object>{
                    'source' => 'salesforce',
                    'timestamp' => Datetime.now().getTime()
                }
            };
            
            req.setBody(JSON.serialize(requestBody));
            
            // Send request
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            // Process response
            if (res.getStatusCode() == 200) {
                Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                String agentResponse = (String) responseData.get('response');
                
                if (agentResponse == null) {
                    throw new AuraHandledException('Invalid response received from API');
                }
                
                return agentResponse;
            } else {
                String errorMsg = 'API error: ' + res.getStatusCode() + ' ' + res.getStatus();
                System.debug(LoggingLevel.ERROR, errorMsg);
                throw new AuraHandledException(errorMsg);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error getting agent response: ' + e.getMessage());
            throw new AuraHandledException('Error getting agent response: ' + e.getMessage());
        }
    }
    
    /**
     * End an agent session
     * @param sessionId The session ID to end
     * @return Boolean True if the session was ended successfully
     */
    @AuraEnabled
    public static Boolean endAgentSession(String sessionId) {
        try {
            // Validate input
            if (String.isBlank(sessionId)) {
                throw new AuraHandledException('Session ID is required');
            }
            
            // Prepare API request
            HttpRequest req = new HttpRequest();
            req.setEndpoint(API_ENDPOINT + '/sessions/' + sessionId);
            req.setMethod('DELETE');
            req.setHeader('Content-Type', 'application/json');
            
            // Send request
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            // Process response
            if (res.getStatusCode() == 200 || res.getStatusCode() == 204) {
                return true;
            } else {
                String errorMsg = 'API error: ' + res.getStatusCode() + ' ' + res.getStatus();
                System.debug(LoggingLevel.ERROR, errorMsg);
                throw new AuraHandledException(errorMsg);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error ending agent session: ' + e.getMessage());
            throw new AuraHandledException('Error ending agent session: ' + e.getMessage());
        }
    }
    
    /**
     * Save chat transcript
     * @param messages JSON string representation of messages
     * @return String ID of the saved transcript
     */
    @AuraEnabled
    public static String saveChatTranscript(String messages) {
        try {
            // Validate input
            if (String.isBlank(messages)) {
                throw new AuraHandledException('Messages are required');
            }
            
            // Create a new Chat Transcript record
            // Note: You'll need to create a custom object for storing transcripts
            Chat_Transcript__c transcript = new Chat_Transcript__c(
                User__c = UserInfo.getUserId(),
                Transcript_Body__c = messages.abbreviate(131072), // Limit to 128KB if your field is a Long Text Area
                Chat_Date__c = Datetime.now()
            );
            
            insert transcript;
            return transcript.Id;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error saving chat transcript: ' + e.getMessage());
            throw new AuraHandledException('Error saving chat transcript: ' + e.getMessage());
        }
    }
}
