import { GoogleGenAI, Modality } from "@google/genai";
import { AiEditResult } from './index';


export const editImageWithAI = async (imageDataUri: string, prompt: string, apiKey: string): Promise<AiEditResult> => {
  if (!apiKey) {
    throw new Error("API key is missing.");
  }
  
  const rawBase64 = imageDataUri.split(',')[1];
  if (!rawBase64) {
      throw new Error("Invalid image data URI provided to Gemini service.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview', // FIX: Corrected model name from 2-5 to 2.5
      contents: {
        parts: [
          {
            inlineData: {
              data: rawBase64, // Gemini requires the raw base64 string
              mimeType: 'image/png',
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const imageUrls: string[] = [];
    
    if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            imageUrls.push(`data:image/png;base64,${base64ImageBytes}`);
          }
        }
    }

    if (imageUrls.length === 0) {
        const errorText = response.text || "API returned an empty response without an image.";
        throw new Error(errorText);
    }

    return { imageUrls };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        // Intercept and clarify the specific 404 error from the typo.
        if (error.message.includes("Requested entity was not found")) {
             throw new Error(`Failed to generate image with AI: A 404 Not Found error occurred. This is often due to an incorrect model name.`);
        }
        throw new Error(`Failed to generate image with AI: ${error.message}`);
    }
    throw new Error("An unknown error occurred while calling the AI model.");
  }
};