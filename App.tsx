import React, { useState, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { FACE_OPTIONS, ASPECT_RATIO_OPTIONS, STYLE_OPTIONS, CAMERA_SHOT_OPTIONS } from './constants';
import type { VariationParams, GeneratedImage, BaseImage } from './types';
import { generateImageVariation } from './services/geminiService';
import SparklesIcon from './components/icons/SparklesIcon';
import UploadIcon from './components/icons/UploadIcon';
import DownloadIcon from './components/icons/DownloadIcon';
import RegenerateIcon from './components/icons/RegenerateIcon';
import DeleteIcon from './components/icons/DeleteIcon';


// Helper Components defined outside the main App component
// to prevent re-creation on every render.

// A reusable select input component
interface SelectInputProps {
  label: string;
  name: keyof VariationParams;
  value: string;
  options: (string | { value: string; label: string })[];
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}
const SelectInput: React.FC<SelectInputProps> = ({ label, name, value, options, onChange }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-400 mb-1">
      {label}
    </label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
    >
      {options.map(option => {
        if (typeof option === 'string') {
          return <option key={option} value={option}>{option}</option>;
        }
        return <option key={option.value} value={option.value}>{option.label}</option>;
      })}
    </select>
  </div>
);

// A reusable textarea input component
interface TextAreaInputProps {
  label: string;
  name: keyof VariationParams;
  value: string;
  placeholder: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}
const TextAreaInput: React.FC<TextAreaInputProps> = ({ label, name, value, placeholder, onChange }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-400 mb-1">
      {label}
    </label>
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={2}
      className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
    />
  </div>
);

// Image Uploader Component
interface ImageUploaderProps {
  baseImage: BaseImage | null;
  onImageUpload: (file: File) => void;
}
const ImageUploader: React.FC<ImageUploaderProps> = ({ baseImage, onImageUpload }) => {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onImageUpload(event.target.files[0]);
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition group mb-4">
      <input
        type="file"
        id="imageUpload"
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleFileChange}
      />
      <label htmlFor="imageUpload" className="cursor-pointer">
        {baseImage ? (
          <img src={baseImage.dataUrl} alt="Preview" className="mx-auto max-h-48 rounded-md object-contain" />
        ) : (
          <div className="flex flex-col items-center">
            <UploadIcon className="h-12 w-12 text-gray-500 group-hover:text-indigo-400 transition" />
            <p className="mt-2 text-sm text-gray-400">
              <span className="font-semibold text-indigo-400">Sube una imagen base</span>
            </p>
            <p className="text-xs text-gray-500">PNG, JPG, WEBP (mín. 1080x1080px)</p>
          </div>
        )}
      </label>
    </div>
  );
};


// Main Application Component
const App: React.FC = () => {
  const [baseImage, setBaseImage] = useState<BaseImage | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<BaseImage | null>(null);
  const [variationParams, setVariationParams] = useState<VariationParams>({
    face: FACE_OPTIONS[0],
    hands: '',
    clothing: '',
    background: '',
    text: '',
    textPosition: '',
    aspectRatio: ASPECT_RATIO_OPTIONS[0],
    style: STYLE_OPTIONS[0],
    cameraShot: CAMERA_SHOT_OPTIONS[0].value,
    observations: '',
  });
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setBaseImage({ file, dataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImage({ file, dataUrl: reader.result as string });
        setVariationParams(prev => ({ ...prev, background: '' }));
      };
      reader.readAsDataURL(file);
      e.target.value = ''; // Allow re-uploading the same file
    }
  };

  const handleParamChange = (e: ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setVariationParams(prev => ({ ...prev, [name]: value }));
     if (name === 'background' && value.trim() !== '') {
        setBackgroundImage(null);
    }
  };

  const buildPrompt = (params: VariationParams, hasBackgroundImage: boolean): string => {
    let promptParts = [
      `Edita la PRIMERA imagen proporcionada (la imagen principal) con las siguientes instrucciones, asegurando que el resultado sea una imagen nítida y de alta calidad de 2048px en su lado más largo.`,
      `El estilo general debe ser: ${params.style}.`,
      `La relación de aspecto debe ser: ${params.aspectRatio.split(' ')[0]}.`
    ];

    if (hasBackgroundImage) {
        promptParts.push('- Reemplaza el fondo de la imagen principal con la SEGUNDA imagen proporcionada (la imagen de fondo). Integra al sujeto de la imagen principal de forma natural en el nuevo fondo.');
    } else if (params.background) {
        promptParts.push(`- Cambia el fondo a: ${params.background}.`);
    }

    if (params.face !== 'Neutral') promptParts.push(`- Cambia la expresión facial a: ${params.face}.`);
    if (params.hands) promptParts.push(`- Las manos deben estar: ${params.hands}.`);
    if (params.clothing) promptParts.push(`- Cambia la vestimenta a: ${params.clothing}.`);
    if (params.cameraShot !== 'A Nivel del Ojo') promptParts.push(`- Usa una toma de cámara de tipo ${params.cameraShot}.`);
    if (params.observations) promptParts.push(`- Observaciones importantes a seguir: ${params.observations}.`);
    if (params.text && params.textPosition) {
      promptParts.push(`- Agrega el texto "${params.text}" a la imagen, ubicado en la ${params.textPosition}.`);
    }

    return promptParts.join('\n');
  };
  
  const handleGenerate = async (paramsToUse: VariationParams, bgImageToUse: BaseImage | null) => {
    if (!baseImage) {
      setError("Por favor, sube una imagen base primero.");
      return;
    }
    setIsLoading(true);
    setError(null);

    const prompt = buildPrompt(paramsToUse, !!bgImageToUse);

    try {
      const generatedDataUrl = await generateImageVariation(baseImage, prompt, bgImageToUse);
      const newImage: GeneratedImage = {
        id: new Date().toISOString(),
        dataUrl: generatedDataUrl,
        prompt: prompt,
        params: paramsToUse,
        backgroundImage: bgImageToUse,
      };
      setGeneratedImages(prev => [newImage, ...prev]);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleGenerate(variationParams, backgroundImage);
  };

  const handleRegenerate = (image: GeneratedImage) => {
    handleGenerate(image.params, image.backgroundImage);
  };
  
  const handleDelete = (idToDelete: string) => {
    setGeneratedImages(prevImages => prevImages.filter(image => image.id !== idToDelete));
  };

  const handleDownload = (dataUrl: string, index: number, params: VariationParams) => {
      const link = document.createElement('a');
      link.href = dataUrl;
      const slug = 'variacion';
      const aspectRatio = params.aspectRatio.split(' ')[0].replace(':', 'x');
      link.download = `${slug}_${generatedImages.length - index}_web_${aspectRatio}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-900 font-sans">
      {/* Control Panel (Left) */}
      <aside className="w-full lg:w-1/4 xl:w-1/5 p-6 bg-gray-800/50 border-r border-gray-700/50 overflow-y-auto">
        <div className="sticky top-6">
            <h1 className="text-2xl font-bold text-white mb-1">Generador de Variaciones</h1>
            <p className="text-gray-400 mb-6">Crea variaciones increíbles de tus imágenes con IA.</p>
            
            <form onSubmit={handleSubmit}>
              <ImageUploader baseImage={baseImage} onImageUpload={handleImageUpload} />

              <div className="space-y-4">
                  <SelectInput label="Expresión Facial" name="face" value={variationParams.face} options={FACE_OPTIONS} onChange={handleParamChange} />
                  <TextAreaInput label="Manos" name="hands" value={variationParams.hands} placeholder="e.g., juntas en oracion" onChange={handleParamChange} />
                  <TextAreaInput label="Vestimenta" name="clothing" value={variationParams.clothing} placeholder="e.g., tradicional arabe" onChange={handleParamChange} />
                  
                  <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                          Fondo
                      </label>
                      {backgroundImage ? (
                          <div className="relative group">
                              <img src={backgroundImage.dataUrl} alt="Background Preview" className="w-full h-24 object-cover rounded-md" />
                              <button 
                                  type="button"
                                  onClick={() => setBackgroundImage(null)} 
                                  className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition hover:bg-red-500/80"
                                  aria-label="Eliminar imagen de fondo"
                              >
                                  <DeleteIcon className="h-4 w-4" />
                              </button>
                          </div>
                      ) : (
                          <div>
                              <textarea
                                  id="background"
                                  name="background"
                                  value={variationParams.background}
                                  onChange={handleParamChange}
                                  placeholder="Describe el fondo o sube una imagen"
                                  rows={2}
                                  className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                              />
                              <div className="text-center text-xs text-gray-500 my-1">O</div>
                              <label htmlFor="bgImageUpload" className="cursor-pointer text-sm w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-md py-2 px-3 text-white transition">
                                  <UploadIcon className="h-4 w-4" />
                                  Subir Imagen de Fondo
                              </label>
                              <input
                                  type="file"
                                  id="bgImageUpload"
                                  className="hidden"
                                  accept="image/png, image/jpeg, image/webp"
                                  onChange={handleBackgroundImageUpload}
                              />
                          </div>
                      )}
                  </div>

                  <SelectInput label="Toma de Cámara" name="cameraShot" value={variationParams.cameraShot} options={CAMERA_SHOT_OPTIONS} onChange={handleParamChange} />
                  <SelectInput label="Tamaño (Relación de Aspecto)" name="aspectRatio" value={variationParams.aspectRatio} options={ASPECT_RATIO_OPTIONS} onChange={handleParamChange} />
                  <SelectInput label="Estilo" name="style" value={variationParams.style} options={STYLE_OPTIONS} onChange={handleParamChange} />
                  <TextAreaInput label="Texto" name="text" value={variationParams.text} placeholder="e.g., '¿qué quieres decir?'" onChange={handleParamChange} />
                  <TextAreaInput label="Posición del Texto" name="textPosition" value={variationParams.textPosition} placeholder="e.g., arriba" onChange={handleParamChange} />
                  <TextAreaInput label="Observaciones" name="observations" value={variationParams.observations} placeholder="e.g. mantener anteojos" onChange={handleParamChange} />
              </div>

              <button
                type="submit"
                disabled={isLoading || !baseImage}
                className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center transition hover:bg-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed mt-6"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    Generar Variación
                  </>
                )}
              </button>
              {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
            </form>
        </div>
      </aside>

      {/* Results Panel (Right) */}
      <main className="flex-1 p-8">
        {generatedImages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <SparklesIcon className="h-16 w-16 mb-4" />
                <h2 className="text-xl font-semibold text-gray-300">Tus imágenes generadas aparecerán aquí</h2>
                <p className="max-w-md mt-2">Sube una imagen y completa las instrucciones para comenzar a crear variaciones.</p>
            </div>
        )}
         {isLoading && generatedImages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <svg className="animate-spin h-12 w-12 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h2 className="text-xl font-semibold text-gray-300 mt-4">Generando tu obra maestra...</h2>
                <p className="max-w-md mt-2">La IA está haciendo su magia. Esto puede tomar un momento.</p>
            </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {generatedImages.map((image, index) => (
            <div key={image.id} className="group relative overflow-hidden rounded-lg shadow-lg bg-gray-800">
              <img src={image.dataUrl} alt={`Generated variation ${index + 1}`} className="w-full h-auto object-cover transition duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 p-4">
                <button 
                  onClick={() => handleDownload(image.dataUrl, index, image.params)} 
                  className="bg-white/20 text-white p-3 rounded-full backdrop-blur-sm hover:bg-white/30 transition"
                  aria-label="Download image"
                >
                  <DownloadIcon className="h-6 w-6" />
                </button>
                <button 
                  onClick={() => handleRegenerate(image)} 
                  className="bg-white/20 text-white p-3 rounded-full backdrop-blur-sm hover:bg-white/30 transition"
                  aria-label="Regenerate image"
                >
                  <RegenerateIcon className="h-6 w-6" />
                </button>
                <button 
                  onClick={() => handleDelete(image.id)} 
                  className="bg-red-500/60 text-white p-3 rounded-full backdrop-blur-sm hover:bg-red-500/80 transition"
                  aria-label="Delete image"
                >
                  <DeleteIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default App;