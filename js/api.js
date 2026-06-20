/**
 * SocioCheck AI - Gemini API Client & Client-Side Image Compression
 */

/**
 * Compresses an image file using HTML Canvas to reduce bandwidth and storage.
 * Scaled down to max 1200px dimensions, outputted as JPEG with 0.75 quality.
 */
export function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) {
            return resolve(file); // Only compress image files
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Compute new dimensions keeping aspect ratio
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        return resolve(file); // Fallback to original file
                    }
                    // Format new filename
                    const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                    const compressedFile = new File([blob], newName, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.onerror = () => {
                resolve(file); // Fallback to original file if loading fails
            };
        };
        reader.onerror = () => {
            resolve(file); // Fallback to original
        };
    });
}

/**
 * Call Gemini Multimodal API with Base64 document
 */
export async function callGeminiVisionAPI(base64Data, mimeType, apiKey, model = 'gemini-2.5-flash') {
    const prompt = `Analiza la imagen del documento de asamblea de Santo Domingo Country Club. 
1. Clasificación:
   - Si el documento es un 'PODER DE REPRESENTACION' (sobre delegación de voto para la asamblea), el tipo de documento debe ser 'Poder'.
   - Si es una solicitud de inclusión de temas en agenda (como remover la limitación de 1 invitado), el tipo de documento debe ser 'Carta'.
2. Extracción de Datos de la Persona que firma (Socio Titular):
   - 'nombre_socio': Es el nombre del socio titular (escribiente principal). Se encuentra escrito a mano en la primera línea en blanco después del texto impreso 'Quien suscribe, '. Extrae este nombre completo (ej. 'Marie Cris Farías Mere' o 'Gianmarco Brache Guebra'). Colócalo como el nombre completo. No extraigas el nombre del apoderado (que se encuentra más abajo en letra imprenta).
   - 'socio_no': Es el número de socio del titular. Se encuentra escrito a mano en la segunda línea en blanco después de 'No. De socio '. Debe ser un número de exactamente 4 dígitos (ej. '4462' o '5225'). No extraigas el número de socio del apoderado.
   - 'resumen': Un resumen breve de la acción del documento.
IMPORTANTE: En el formulario físico, la primera línea contiene el nombre del socio titular (Poderdante) y la segunda línea contiene su número de socio de 4 dígitos. No extraigas los datos del apoderado (ej. León Antonio Rubio Cunillera, socio 3749) que se indican más abajo.
Retorna un JSON puro, sin markdown (sin \`\`\`json ni similares), que contenga exactamente estas claves: 'tipo_documento' (valores 'Poder' o 'Carta'), 'socio_no' (string de 4 dígitos), 'nombre_socio' (string), 'resumen' (string). Si no hay socio_no de 4 dígitos válido, pon null.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Gemini API Error: Status ${response.status}`);
    }

    const data = await response.json();
    const jsonText = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText.trim());
}

/**
 * Call Gemini Text API
 */
export async function callGeminiTextAPI(text, apiKey, model = 'gemini-2.5-flash') {
    const prompt = `Analiza el texto de un documento de asamblea de Santo Domingo Country Club.
1. Clasificación:
   - Si es un 'PODER DE REPRESENTACION' (con campos como 'Quien suscribe', 'designa y nombra a'), clasifícalo como 'Poder' obligatoriamente.
   - Si es una solicitud de inclusión de tema en agenda (como remover el límite de 1 invitado), clasifícalo como 'Carta'.
2. Extracción de Datos:
   - 'nombre_socio': Nombre del socio titular suscriptor. Se encuentra en la primera línea rellenable (después de 'Quien suscribe,'). Extrae el nombre completo (ej. 'Marie Cris Farías Mere' o 'Gianmarco Brache Guebra').
   - 'socio_no': Número de socio de exactamente 4 dígitos del socio titular suscriptor. Se encuentra en la segunda línea rellenable (después de 'No. De socio'). Extrae este número (ej. '4462' o '5225').
   - 'resumen': Extracto de la acción del documento.
IMPORTANTE: En el formulario físico, la primera línea contiene el nombre del socio titular (Poderdante) y la segunda línea contiene su número de socio de 4 dígitos. No extraigas los datos del apoderado (ej. León Antonio Rubio Cunillera, socio 3749) que se indican más abajo.
Retorna un JSON puro que contenga estrictamente las siguientes claves:
{
  "tipo_documento": "Poder" | "Carta" | "Desconocido",
  "socio_no": "string" | null,
  "nombre_socio": "string",
  "resumen": "string"
}
Si no encuentras un número de socio de exactamente 4 dígitos, socio_no debe ser null.

Texto del documento:
${text}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [
            {
                parts: [{ text: prompt }]
            }
        ],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Gemini API Error: Status ${response.status}`);
    }

    const data = await response.json();
    const jsonText = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText.trim());
}

/**
 * File utility readers
 */
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

export function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}
