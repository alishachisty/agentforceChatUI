/**
 * Controller for handling text-to-speech using ElevenLabs API
 */
public with sharing class ElevenLabsTTSController {
    
    private static final String API_ENDPOINT = 'callout:ElevenLabsAPI';
    private static final String DEFAULT_VOICE_ID = '5l5f8iK3YPeGga21rQIX'; // Your Eleven Labs voice ID
    
    /**
     * Get audio from text using ElevenLabs API
     * @param text The text to convert to audio
     * @return String Base64-encoded audio file
     */
    @AuraEnabled
    public static String getAudioFromText(String text) {
        try {
            // Validate input
            if (String.isBlank(text)) {
                throw new AuraHandledException('Text is required');
            }
            
            // Get API key from custom label
            String apiKey = System.Label.ElevenLabs_API_Key;
            
            if (String.isBlank(apiKey)) {
                throw new AuraHandledException('ElevenLabs API key is not configured');
            }
            
            // Prepare API request
            HttpRequest req = new HttpRequest();
            req.setEndpoint(API_ENDPOINT + '/v1/text-to-speech/' + DEFAULT_VOICE_ID);
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('xi-api-key', apiKey);
            
            // Prepare request body
            Map<String, Object> requestBody = new Map<String, Object>{
                'text' => text,
                'model_id' => 'eleven_multilingual_v2',
                'voice_settings' => new Map<String, Object>{
                    'stability' => 0.5,
                    'similarity_boost' => 0.8
                }
            };
            
            req.setBody(JSON.serialize(requestBody));
            req.setTimeout(120000); // 2-minute timeout for audio generation
            
            // Send request
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            // Process response
            if (res.getStatusCode() == 200) {
                // Convert binary response to base64
                Blob audioBlob = res.getBodyAsBlob();
                String base64Audio = EncodingUtil.base64Encode(audioBlob);
                return base64Audio;
            } else {
                String errorMsg = 'API error: ' + res.getStatusCode() + ' ' + res.getStatus();
                System.debug(LoggingLevel.ERROR, errorMsg);
                throw new AuraHandledException(errorMsg);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error generating audio: ' + e.getMessage());
            throw new AuraHandledException('Error generating audio: ' + e.getMessage());
        }
    }
}
