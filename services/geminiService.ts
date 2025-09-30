import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import type { BaseImage } from '../types';

const MODEL_NAME = 'gemini-2.5-flash-image-preview';

export const generateImageVariation = async (
  baseImage: BaseImage,
  prompt: string,
  backgroundImage: BaseImage | null
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const base64Data = baseImage.dataUrl.split(',')[1];

  const parts: ({ inlineData: { data: string; mimeType: string; }; } | { text: string; })[] = [
    {
      inlineData: {
        data: base64Data,
        mimeType: baseImage.file.type,
      },
    },
  ];

  if (backgroundImage) {
    const bgBase64Data = backgroundImage.dataUrl.split(',')[1];
    parts.push({
      inlineData: {
        data: bgBase64Data,
        mimeType: backgroundImage.file.type,
      },
    });
  }

  parts.push({ text: prompt });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: parts,
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const generatedBase64 = part.inlineData.data;
        return `data:${part.inlineData.mimeType};base64,${generatedBase64}`;
      }
    }
    throw new Error("No image was generated in the response.");
  } catch (error) {
    console.error("Error generating image variation:", error);
    throw new Error("Failed to generate image. Please check the console for details.");
  }
};