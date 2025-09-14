import { AiEditResult } from './index';

// --- Helper: Upload Image to WaveSpeed for a Public URL ---
const uploadImageToWaveSpeed = async (
    imageDataUri: string,
    apiKey: string
): Promise<string> => {
    if (!apiKey) {
        throw new Error("API key is missing for upload.");
    }

    const byteString = atob(imageDataUri.split(',')[1]);
    const mimeString = imageDataUri.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });

    const UPLOAD_URL = 'https://api.wavespeed.ai/api/v3/media/upload/binary';

    const formData = new FormData();
    formData.append('file', blob, 'snapshot.png');

    try {
        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData,
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw new Error(`Upload failed with status ${response.status}: ${responseText}`);
        }

        const result = JSON.parse(responseText);
        const downloadUrl = result?.data?.download_url;

        if (!downloadUrl) {
            throw new Error('Upload succeeded but no download URL returned.');
        }

        return downloadUrl;
    } catch (error) {
        console.error("Error uploading image to WaveSpeed:", error);
        throw new Error(`Image upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
};


// --- SEADREAM API (ASYNCHRONOUS POLLING MODE FOR IMAGE EDITING) ---
export const editImageWithSeaDream = async (
    imageDataUri: string, 
    prompt: string, 
    apiKey: string,
    width: number,
    height: number
): Promise<AiEditResult> => {
    if (!apiKey) throw new Error("API key is missing for SeaDream.");
    if (!prompt) throw new Error("Prompt is missing for SeaDream.");
    
    const imageUrl = await uploadImageToWaveSpeed(imageDataUri, apiKey);

    let finalWidth = Math.round(width);
    let finalHeight = Math.round(height);
    const MIN_PIXELS = 921600;

    if (finalWidth * finalHeight < MIN_PIXELS) {
        const aspectRatio = finalWidth / finalHeight;
        const newWidth = Math.sqrt(MIN_PIXELS * aspectRatio);
        const newHeight = newWidth / aspectRatio;
        
        finalWidth = Math.ceil(newWidth);
        finalHeight = Math.ceil(newHeight);
    }

    const SUBMIT_URL = 'https://api.wavespeed.ai/api/v3/bytedance/seedream-v4/edit';
    const payload = {
        enable_sync_mode: false,
        enable_base_64_output: false,
        images: [imageUrl],
        prompt: prompt,
        size: `${finalWidth}*${finalHeight}`,
    };

    const submitResponse = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        throw new Error(`SeaDream task submission failed with status ${submitResponse.status}: ${errorText}`);
    }

    const submitResult = await submitResponse.json();
    const requestId = submitResult?.data?.id;

    if (!requestId) {
        throw new Error('Could not get a request ID from SeaDream API submission.');
    }

    const RESULT_URL = `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`;
    const pollingStartTime = Date.now();
    const POLLING_TIMEOUT = 3 * 60 * 1000;

    while (Date.now() - pollingStartTime < POLLING_TIMEOUT) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const resultResponse = await fetch(RESULT_URL, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!resultResponse.ok) {
            console.warn(`Polling failed with status ${resultResponse.status}, retrying...`);
            continue;
        }
        
        const resultData = await resultResponse.json();
        const status = resultData?.data?.status;

        if (status === 'completed') {
            const outputUrl = resultData?.data?.outputs?.[0];
            if (!outputUrl) {
                throw new Error('Task completed but no output URL was found.');
            }

            const imageResponse = await fetch(outputUrl);
            if (!imageResponse.ok) {
                throw new Error(`Failed to download the final image from ${outputUrl}`);
            }
            const imageBlob = await imageResponse.blob();
            const finalDataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(imageBlob);
            });

            return { imageUrls: [finalDataUri] };

        } else if (status === 'failed') {
            throw new Error(`SeaDream task failed: ${resultData?.data?.error || 'Unknown error'}`);
        }
    }

    throw new Error('SeaDream task timed out after 3 minutes.');
};


// --- SEADREAM API (ASYNCHRONOUS POLLING MODE FOR TEXT-TO-IMAGE) ---
export const generateImageWithSeaDream = async (
    prompt: string, 
    apiKey: string
): Promise<string> => {
    if (!apiKey) throw new Error("API key is missing for SeaDream text-to-image.");
    if (!prompt) throw new Error("Prompt is missing for SeaDream text-to-image.");
    
    // Use the base endpoint for text-to-image generation
    const SUBMIT_URL = 'https://api.wavespeed.ai/api/v3/bytedance/seedream-v4';
    const payload = {
        enable_sync_mode: false,
        enable_base_64_output: false,
        prompt: prompt,
        size: "1024*1024", // A standard default size for text-to-image
    };

    const submitResponse = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        throw new Error(`SeaDream text-gen task submission failed with status ${submitResponse.status}: ${errorText}`);
    }

    const submitResult = await submitResponse.json();
    const requestId = submitResult?.data?.id;

    if (!requestId) {
        throw new Error('Could not get a request ID from SeaDream text-gen API submission.');
    }

    const RESULT_URL = `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`;
    const pollingStartTime = Date.now();
    const POLLING_TIMEOUT = 3 * 60 * 1000;

    while (Date.now() - pollingStartTime < POLLING_TIMEOUT) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const resultResponse = await fetch(RESULT_URL, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!resultResponse.ok) {
            console.warn(`Polling for text-gen failed with status ${resultResponse.status}, retrying...`);
            continue;
        }
        
        const resultData = await resultResponse.json();
        const status = resultData?.data?.status;

        if (status === 'completed') {
            const outputUrl = resultData?.data?.outputs?.[0];
            if (!outputUrl) {
                throw new Error('Text-gen task completed but no output URL was found.');
            }

            const imageResponse = await fetch(outputUrl);
            if (!imageResponse.ok) {
                throw new Error(`Failed to download the final generated image from ${outputUrl}`);
            }
            const imageBlob = await imageResponse.blob();
            const finalDataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(imageBlob);
            });
            // Return a single Data URI string
            return finalDataUri;

        } else if (status === 'failed') {
            throw new Error(`SeaDream text-gen task failed: ${resultData?.data?.error || 'Unknown error'}`);
        }
    }

    throw new Error('SeaDream text-gen task timed out after 3 minutes.');
};