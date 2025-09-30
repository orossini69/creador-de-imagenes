export interface VariationParams {
  face: string;
  hands: string;
  clothing: string;
  background: string;
  text: string;
  textPosition: string;
  aspectRatio: string;
  style: string;
  cameraShot: string;
  observations: string;
}

export interface GeneratedImage {
  id: string;
  dataUrl: string;
  prompt: string;
  params: VariationParams;
  backgroundImage: BaseImage | null;
}

export interface BaseImage {
  file: File;
  dataUrl: string;
}