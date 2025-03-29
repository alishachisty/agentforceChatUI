public with sharing class ElevenLabsTTSController {
    
    @AuraEnabled(cacheable=false)
    public static String getAudioFromText(String textInput) {
        try {
            String elevenLabsApiKey = System.Label.ElevenLabs_API_Key; // This is your custom label
            String voiceId = '5l5f8iK3YPeGga21rQIX'; // <-- Replace this with your real Eleven Labs voice ID

            HttpRequest req = new HttpRequest();
            req.setEndpoint('callout:ElevenLabsAPI/v1/text-to-speech/' + voiceId);
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('xi-api-key', elevenLabsApiKey);
            
            Map<String, Object> body = new Map<String, Object>();
            body.put('text', textInput);
            body.put('model_id', 'eleven_multilingual_v2'); // You can change this if needed
            body.put('voice_settings', new Map<String, Object>{
                'stability' => 0.5,
                'similarity_boost' => 0.8
            });

            req.setBody(JSON.serialize(body));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                Blob audioBlob = res.getBodyAsBlob();
                String base64Audio = EncodingUtil.base64Encode(audioBlob);
                return base64Audio;
            } else {
                throw new AuraHandledException('Error: ' + res.getBody());
            }
        } catch (Exception e) {
            throw new AuraHandledException('Failed to fetch audio: ' + e.getMessage());
        }
    }
}
