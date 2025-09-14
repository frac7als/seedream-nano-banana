import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { CanvasObject, FrameObject, CanvasState, PromptNodeObject } from './types';
import { AiEditResult, editImageWithAI, editImageWithSeaDream, generateImageWithSeaDream } from './services';
import { Icon } from './components/Icon';

// --- UTILITY FUNCTIONS --- //
/**
 * Checks if a point is inside a rectangle that may be rotated.
 * @param point The point to check { x, y }.
 * @param rect The rectangle object { x, y, width, height, rotation }.
 * @returns True if the point is inside the rectangle, false otherwise.
 */
const isPointInRotatedRect = (
    point: { x: number; y: number },
    rect: { x: number; y: number; width: number; height: number; rotation: number }
): boolean => {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const angleRad = -rect.rotation * (Math.PI / 180);

    const translatedX = point.x - cx;
    const translatedY = point.y - cy;

    const rotatedX = translatedX * Math.cos(angleRad) - translatedY * Math.sin(angleRad);
    const rotatedY = translatedX * Math.sin(angleRad) + translatedY * Math.cos(angleRad);

    const halfW = rect.width / 2;
    const halfH = rect.height / 2;

    return rotatedX >= -halfW && rotatedX <= halfW && rotatedY >= -halfH && rotatedY <= halfH;
}


// --- UI COMPONENTS --- //
const ActionButton: React.FC<{ onClick: (e: React.MouseEvent) => void; children: React.ReactNode; className?: string; disabled?: boolean, style?: React.CSSProperties }> = ({ onClick, children, className = '', disabled = false, style }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
            disabled 
                ? 'bg-brand-surface text-brand-light-gray cursor-not-allowed'
                : 'bg-brand-accent text-brand-dark hover:bg-brand-accent-hover active:bg-brand-accent-active'
        } ${className}`}
        style={style}
    >
        {children}
    </button>
);

const SidebarButton: React.FC<{
  onClick: () => void;
  isActive: boolean;
  onDoubleClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  draggable: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, isActive, children, className, onDoubleClick, onDragStart, draggable }) => (
    <button
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onDragStart={onDragStart}
        draggable={draggable}
        className={`flex items-center w-full text-left gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
            isActive
                ? 'bg-brand-accent text-brand-dark'
                : 'text-brand-light-gray hover:bg-brand-surface'
        } ${className}`}
    >
        {children}
    </button>
);


// --- API KEY MODAL COMPONENT --- //
interface ApiConfig {
    provider: string;
    key: string;
}

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentConfigs: Record<string, string>;
    onSave: (config: ApiConfig) => void;
}
const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, currentConfigs, onSave }) => {
    const [provider, setProvider] = useState('gemini');
    const [key, setKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            setKey(currentConfigs[provider] || '');
        }
    }, [provider, currentConfigs, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if(key.trim()){
            onSave({ provider, key });
            onClose();
        }
    };
    
    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProvider = e.target.value;
        setProvider(newProvider);
        setKey(currentConfigs[newProvider] || '');
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            <div 
                className="bg-brand-panel rounded-lg shadow-xl p-6 w-full max-w-md border border-brand-border"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Manage API Keys</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-brand-surface">
                        <Icon name="close" className="w-6 h-6" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="api-provider" className="block text-sm font-medium text-brand-light-gray mb-1">
                            API Provider
                        </label>
                        <select
                            id="api-provider"
                            value={provider}
                            onChange={handleProviderChange}
                            className="w-full p-2 rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-all"
                        >
                            <option value="gemini">Google Gemini</option>
                            <option value="seadream">SeaDream</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="api-key" className="block text-sm font-medium text-brand-light-gray mb-1">
                            API Key
                        </label>
                        <input
                            type="password"
                            id="api-key"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Enter your API key"
                            className="w-full p-2 rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-all"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold bg-brand-surface hover:bg-brand-border transition-colors">
                            Cancel
                        </button>
                        <ActionButton onClick={handleSave}>
                            Save
                        </ActionButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- LOGIN MODAL COMPONENT --- //
const LoginModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            <div 
                className="bg-brand-panel rounded-lg shadow-xl p-6 w-full max-w-md border border-brand-border text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-end items-center mb-2">
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-brand-surface">
                        <Icon name="close" className="w-6 h-6" />
                    </button>
                </div>
                <h2 className="text-xl font-bold mb-4">Login Feature Coming Soon</h2>
                <p className="text-brand-light-gray">
                    A persistent user login system requires a secure backend service to manage accounts and encrypted API keys.
                </p>
                <p className="text-brand-light-gray mt-2">
                    This feature is planned for a future update and will likely be implemented using a service like <strong className="text-brand-text">Firebase</strong>.
                </p>
            </div>
        </div>
    );
};

// --- GOOGLE DRIVE MODAL COMPONENT --- //
const GoogleDriveModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            <div 
                className="bg-brand-panel rounded-lg shadow-xl p-6 w-full max-w-md border border-brand-border text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-end items-center mb-2">
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-brand-surface">
                        <Icon name="close" className="w-6 h-6" />
                    </button>
                </div>
                <h2 className="text-xl font-bold mb-4">Google Drive Integration Coming Soon</h2>
                <p className="text-brand-light-gray">
                    This feature will allow you to connect your Google Drive account to use as a Digital Asset Management (DAM) system.
                </p>
                <p className="text-brand-light-gray mt-2">
                    You will be able to browse, select and import images directly from your Google Drive and export your creations back to a designated folder.
                </p>
            </div>
        </div>
    );
};

// --- ASI SUPPORT MODAL COMPONENT --- //
interface AsiSupportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (status: string) => void;
}
const AsiSupportModal: React.FC<AsiSupportModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [status, setStatus] = useState('biosecure');
    const [exception, setException] = useState('financial');

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(status);
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            <div 
                className="bg-brand-panel rounded-lg shadow-xl p-6 w-full max-w-lg border border-brand-border"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Confirm Biosecurity Status:</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-brand-surface">
                        <Icon name="close" className="w-6 h-6" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div className="space-y-2">
                         <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-brand-surface cursor-pointer transition-colors">
                            <input type="radio" name="biosecurity" value="biosecure" checked={status === 'biosecure'} onChange={(e) => setStatus(e.target.value)} className="h-5 w-5 text-brand-blue bg-brand-surface border-brand-border focus:ring-brand-blue" />
                            <span>Biosecure - No SNP GMCs installed</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-brand-surface cursor-pointer transition-colors">
                            <input type="radio" name="biosecurity" value="insecure_installed" checked={status === 'insecure_installed'} onChange={(e) => setStatus(e.target.value)} className="h-5 w-5 text-brand-blue bg-brand-surface border-brand-border focus:ring-brand-blue" />
                            <span>Bioinsecure - Installed SNP GMCs</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-brand-surface cursor-pointer transition-colors">
                            <input type="radio" name="biosecurity" value="insecure_exception" checked={status === 'insecure_exception'} onChange={(e) => setStatus(e.target.value)} className="h-5 w-5 text-brand-blue bg-brand-surface border-brand-border focus:ring-brand-blue" />
                            <span>Bioinsecure - File for exception</span>
                        </label>
                    </div>

                    {status === 'insecure_exception' && (
                        <div className="pl-12">
                            <label htmlFor="exception-reason" className="block text-sm font-medium text-brand-light-gray mb-1">
                                Reason for Exception
                            </label>
                            <select
                                id="exception-reason"
                                value={exception}
                                onChange={(e) => setException(e.target.value)}
                                className="w-full p-2 rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-all"
                            >
                                <option value="financial">Immense Financial Contribution</option>
                                <option value="integrity">Moral Integrity</option>
                                <option value="whitelist">Whitelist</option>
                            </select>
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold bg-brand-surface hover:bg-brand-border transition-colors">
                            Cancel
                        </button>
                        <ActionButton 
                            onClick={handleConfirm}
                            className="!bg-brand-gold-light text-brand-dark hover:!bg-brand-gold-light-hover"
                        >
                            CONFIRM
                        </ActionButton>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- TRANSFORMABLE IMAGE COMPONENT --- //
interface TransformableImageProps {
    obj: CanvasObject;
    isSelected: boolean;
    onInteractionStart: (id: string, e: React.MouseEvent, type: 'move' | 'resize-br' | 'rotate') => void;
    onDelete: (id: string) => void;
    onSendToAPI: (id: string, api: 'SD' | 'NB') => void;
    onUpscale: (id: string) => void;
    onExport: (id: string) => void;
}

const TransformableImage: React.FC<TransformableImageProps> = ({ obj, isSelected, onInteractionStart, onDelete, onSendToAPI, onUpscale, onExport }) => {
    return (
        <div
            data-object-id={obj.id}
            className="absolute cursor-move"
            style={{ 
                left: obj.x, 
                top: obj.y, 
                width: obj.width, 
                height: obj.height, 
                zIndex: obj.zIndex,
                transform: `rotate(${obj.rotation}deg)` 
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                onInteractionStart(obj.id, e, 'move');
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <img src={obj.src} className="w-full h-full object-contain pointer-events-none" alt="" />
            
            {obj.isAiResult && (
                <div className="absolute -inset-1.5 pointer-events-none rounded-lg border-2 border-brand-light-blue shadow-glow-light-blue"></div>
            )}

            {isSelected && (
                <>
                    <div className="absolute -inset-1 border-2 border-brand-blue pointer-events-none"></div>
                    <div
                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-brand-blue rounded-full cursor-se-resize border-2 border-brand-dark"
                        onMouseDown={(e) => {
                           e.stopPropagation();
                           onInteractionStart(obj.id, e, 'resize-br');
                        }}
                    />
                     <div
                        className="absolute -top-6 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand-blue rounded-full cursor-alias border-2 border-brand-dark flex items-center justify-center text-white"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            onInteractionStart(obj.id, e, 'rotate');
                        }}
                     >
                        <Icon name="rotate" className="w-3 h-3"/>
                    </div>
                    <div
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full cursor-pointer border-2 border-brand-dark flex items-center justify-center text-white hover:bg-red-500 z-10"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            onDelete(obj.id);
                        }}
                    >
                        <Icon name="close" className="w-3 h-3"/>
                    </div>
                    
                    {/* NEW UNIFIED UPSCALE BUTTON */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 -right-2"
                        style={{ transform: `translate(100%, -50%) rotate(${-obj.rotation}deg)` }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUpscale(obj.id); }} 
                            className="bg-green-500 text-white hover:bg-green-600 p-2 rounded-lg ml-2 flex flex-col items-center justify-center gap-1 font-semibold w-8 h-20"
                            style={{ lineHeight: '1' }}
                        >
                            <Icon name="sparkles" className="w-4 h-4" />
                            <span style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>Upscale</span>
                        </button>
                    </div>

                    <div 
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-2" 
                        style={{ transform: `translate(-50%, 100%) rotate(${-obj.rotation}deg)`}}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                         {obj.isAiResult ? (
                            <>
                                <ActionButton onClick={() => onExport(obj.id)} className="!bg-brand-surface hover:!bg-brand-border !px-4 !py-2">
                                    <Icon name="download" className="w-4 h-4 mr-1"/> Export
                                </ActionButton>
                            </>
                        ) : (
                            <>
                                <ActionButton onClick={() => onSendToAPI(obj.id, 'SD')} className="!bg-brand-red text-white hover:!bg-brand-red-dark !px-4 !py-2">
                                    To SD
                                </ActionButton>
                                <ActionButton onClick={() => onSendToAPI(obj.id, 'NB')} className="!bg-brand-blue text-white hover:!bg-brand-blue-dark !px-4 !py-2">
                                    To NB
                                </ActionButton>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// --- FORMAT FRAME COMPONENT --- //
interface FormatFrameProps {
    frame: FrameObject;
    isSelected: boolean;
    onInteractionStart: (id: string, e: React.MouseEvent, type: 'move' | 'resize-br') => void;
    onFrameMouseDown: (id: string, e: React.MouseEvent) => void;
    onSendToAPI: (id: string, api: 'SD' | 'NB') => void;
    onDelete: (id: string) => void;
    onScreenshot: (id: string) => void;
}
const FormatFrame: React.FC<FormatFrameProps> = ({ frame, isSelected, onInteractionStart, onFrameMouseDown, onSendToAPI, onDelete, onScreenshot }) => {
    return (
        <div
            data-object-id={frame.id}
            className="absolute group"
            style={{
                left: frame.x,
                top: frame.y,
                width: frame.width,
                height: frame.height,
                zIndex: frame.zIndex,
            }}
            onMouseDown={(e) => onFrameMouseDown(frame.id, e)}
        >
            <div className={`w-full h-full pointer-events-none rounded-lg transition-all duration-200 ${isSelected ? 'border-4 border-solid border-brand-blue' : 'border-4 border-solid border-brand-gold-light shadow-glow-yellow'}`} />
            
            <div
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full cursor-pointer border-2 border-brand-dark flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onDelete(frame.id);
                }}
            >
                <Icon name="close" className="w-3 h-3"/>
            </div>

            <div
                className="absolute -top-2 -left-2 w-5 h-5 bg-green-500 hover:bg-green-600 rounded-full cursor-pointer border-2 border-brand-dark flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Capture frame contents"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onScreenshot(frame.id);
                }}
            >
                <Icon name="camera" className="w-3 h-3"/>
            </div>

            <div
                className="absolute -bottom-2 -right-2 w-5 h-5 bg-brand-gold rounded-full cursor-se-resize border-2 border-brand-dark group-hover:opacity-100 opacity-0 transition-opacity"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onInteractionStart(frame.id, e, 'resize-br');
                }}
            />
            <div 
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-2" 
                style={{ transform: 'translate(-50%, 100%)' }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <ActionButton onClick={() => onSendToAPI(frame.id, 'SD')} className="!bg-brand-red text-white hover:!bg-brand-red-dark !px-4 !py-2">
                    Frame to SD
                </ActionButton>
                 <ActionButton onClick={() => onSendToAPI(frame.id, 'NB')} className="!bg-brand-blue text-white hover:!bg-brand-blue-dark !px-4 !py-2">
                    Frame to NB
                </ActionButton>
            </div>
        </div>
    );
};

// --- PROMPT NODE COMPONENT --- //
interface PromptNodeProps {
    node: PromptNodeObject;
    isSelected: boolean;
    onInteractionStart: (id: string, e: React.MouseEvent, type: 'move') => void;
    onDelete: (id: string) => void;
}
const PromptNode: React.FC<PromptNodeProps> = ({ node, isSelected, onInteractionStart, onDelete }) => {
    const hasPrompt = node.prompt && node.prompt.trim().length > 0;

    return (
        <div
            data-object-id={node.id}
            className="absolute group"
            style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                zIndex: node.zIndex,
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                // This call is necessary for selection and z-index management.
                // The 'move' type is prevented from actually moving in handleMouseMove.
                onInteractionStart(node.id, e, 'move');
            }}
        >
            <div className={`w-full h-full rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 p-2 flex-col gap-1 font-semibold
                ${isSelected 
                    ? 'bg-brand-blue shadow-glow-blue text-white' 
                    : hasPrompt 
                        ? 'bg-brand-gold text-white' 
                        : 'bg-brand-surface text-brand-light-gray'
                }
            `}>
                <Icon name="document-text" className={`w-4 h-4 transition-colors`} />
            </div>
             <div
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full cursor-pointer border-2 border-brand-dark flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onDelete(node.id);
                }}
            >
                <Icon name="close" className="w-3 h-3"/>
            </div>
        </div>
    );
};


// --- PREVIEW MODAL --- //
const PreviewModal: React.FC<{ imageUrl: string; onClose: () => void; }> = ({ imageUrl, onClose }) => {
    return (
        <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="relative max-w-full max-h-full"
                onClick={(e) => e.stopPropagation()}
            >
                <img src={imageUrl} alt="Preview" className="block max-w-full max-h-[90vh] object-contain" />
                <button 
                    onClick={onClose} 
                    className="absolute -top-4 -right-4 p-2 bg-brand-surface rounded-full text-white hover:bg-brand-border transition-colors"
                    title="Close preview"
                >
                    <Icon name="close" className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};


// Capture function for a single object
const captureSingleObjectAsDataURL = async (
    object: CanvasObject
): Promise<{ dataUrl: string; width: number; height: number; }> => {
    const canvas = document.createElement('canvas');
    const width = Math.round(object.width);
    const height = Math.round(object.height);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error("Failed to create canvas context for single object capture.");
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous'; 
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load image for capture: ${object.src.substring(0, 50)}...`));
        image.src = object.src;
    });

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((object.rotation * Math.PI) / 180);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    ctx.restore();

    return { dataUrl: canvas.toDataURL('image/png', 0.95), width, height };
};


// Capture function for Gemini (Nano-Banana) with frame
const captureFrameContentAsDataURL = async (
    frame: FrameObject, 
    objects: CanvasObject[]
): Promise<{ dataUrl: string; width: number; height: number; }> => {
    const canvas = document.createElement('canvas');
    const width = Math.round(frame.width);
    const height = Math.round(frame.height);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error("Failed to create canvas context for capture.");
    
    ctx.fillStyle = '#101010'; // bg-brand-dark color
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const objectsToRender = objects.filter(obj => {
        return obj.x < frame.x + frame.width && obj.x + obj.width > frame.x &&
               obj.y < frame.y + frame.height && obj.y + obj.height > frame.y;
    }).sort((a, b) => a.zIndex - b.zIndex);

    const imageElements = await Promise.all(
        objectsToRender.map(obj => new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous'; 
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Could not load image: ${obj.src.substring(0, 50)}...`));
            img.src = obj.src;
        }))
    );

    objectsToRender.forEach((obj, index) => {
        const img = imageElements[index];
        const relativeX = obj.x - frame.x;
        const relativeY = obj.y - frame.y;
        
        ctx.save();
        ctx.translate(relativeX + obj.width / 2, relativeY + obj.height / 2);
        ctx.rotate((obj.rotation * Math.PI) / 180);
        ctx.drawImage(img, -obj.width / 2, -obj.height / 2, obj.width, obj.height);
        ctx.restore();
    });

    return { dataUrl: canvas.toDataURL('image/png', 0.95), width, height };
};

const defaultViewTransform = { zoom: 0.5, pan: { x: 0, y: 0 } };
const NUM_FAVORITE_SLOTS = 4;

const PROMPT_NODE_WIDTH = 48;
const PROMPT_NODE_HEIGHT = 180; // Increased by 50% from 120

// Layered Z-Indexing Constants
const Z_INDEX_BASE_IMAGE = 0;
const Z_INDEX_BASE_FRAME = 10000;
const Z_INDEX_BASE_PROMPT_NODE = 20000;


function App() {
    const [canvases, setCanvases] = useState<CanvasState[]>([]);
    const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
    const [favoriteCanvasIds, setFavoriteCanvasIds] = useState<(string | null)[]>(Array(NUM_FAVORITE_SLOTS).fill(null));
    const [renamingCanvasId, setRenamingCanvasId] = useState<string | null>(null);
    const [canvasSearchQuery, setCanvasSearchQuery] = useState('');

    const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
    const [viewTransform, setViewTransform] = useState<{zoom: number, pan: {x: number, y: number}}>(defaultViewTransform);
    
    const [activeCombinedJobs, setActiveCombinedJobs] = useState<Array<{ id: string; provider: 'SD' | 'NB' }>>([]);
    
    const [isPanning, setIsPanning] = useState(false);
    const [isPanningWithSpace, setIsPanningWithSpace] = useState(false);
    
    const [apiConfigs, setApiConfigs] = useState<Record<string, string>>({});
    const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
    const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState<boolean>(false);
    const [isAsiSupportModalOpen, setIsAsiSupportModalOpen] = useState<boolean>(false);
    const [asiActivationStatus, setAsiActivationStatus] = useState<'none' | 'secure' | 'insecure'>('none');

    const [prompt, setPrompt] = useState<string>('');
    const [textGenPrompt, setTextGenPrompt] = useState<string>('');
    const [customAspectRatio, setCustomAspectRatio] = useState<string>('16:9');

    const [error, setError] = useState<string | null>(null);
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
    const [apiCallCounts, setApiCallCounts] = useState({ sd: 0, nb: 0 });


    const viewportRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const jsonFileInputRef = useRef<HTMLInputElement>(null);
    const interactionRef = useRef({
        type: null as 'move' | 'resize-br' | 'rotate' | 'pan' | null,
        targetId: '',
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        startRotation: 0,
        startAspectRatio: 1,
        centerCanvasX: 0,
        centerCanvasY: 0,
        movedObjectIds: [] as string[],
        startPositions: {} as Record<string, { x: number; y: number }>
    });

    const activeCanvas = useMemo(() => canvases.find(c => c.id === activeCanvasId), [canvases, activeCanvasId]);

    const filteredCanvases = useMemo(() => {
        if (!canvasSearchQuery.trim()) {
            return canvases;
        }
        return canvases.filter(canvas =>
            canvas.name.toLowerCase().includes(canvasSearchQuery.toLowerCase())
        );
    }, [canvases, canvasSearchQuery]);

    // --- DATA PERSISTENCE EFFECTS --- //
    useEffect(() => {
        // Load data from localStorage on initial mount
        try {
            const storedCanvases = localStorage.getItem('canvases');
            const storedFavorites = localStorage.getItem('favoriteCanvasIds');
            const storedApiConfigs = localStorage.getItem('apiConfigs');
            let loadedCanvases: CanvasState[] = [];
            
            if (storedCanvases) {
                const parsedCanvases = JSON.parse(storedCanvases);
                if (Array.isArray(parsedCanvases) && parsedCanvases.length > 0) {
                    loadedCanvases = parsedCanvases.map(c => ({...c, promptNodes: c.promptNodes || []})); // Backwards compatibility
                }
            }

            if (loadedCanvases.length === 0) {
                const defaultCanvasId = crypto.randomUUID();
                loadedCanvases = [{ id: defaultCanvasId, name: 'Default Canvas', objects: [], frames: [], promptNodes: [] }];
                setCanvases(loadedCanvases);
                setActiveCanvasId(defaultCanvasId);
            } else {
                 setCanvases(loadedCanvases);
                 const lastActiveId = localStorage.getItem('activeCanvasId');
                 setActiveCanvasId(lastActiveId && loadedCanvases.some(c => c.id === lastActiveId) ? lastActiveId : loadedCanvases[0].id);
            }

            if (storedFavorites) {
                const parsedFavorites = JSON.parse(storedFavorites);
                 if (Array.isArray(parsedFavorites)) {
                    const newFavorites = [...parsedFavorites];
                    while (newFavorites.length < NUM_FAVORITE_SLOTS) {
                        newFavorites.push(null);
                    }
                    setFavoriteCanvasIds(newFavorites.slice(0, NUM_FAVORITE_SLOTS));
                }
            }

            if (storedApiConfigs) setApiConfigs(JSON.parse(storedApiConfigs));

        } catch (e) {
            console.error("Failed to parse data from localStorage", e);
            const defaultCanvasId = crypto.randomUUID();
            setCanvases([{ id: defaultCanvasId, name: 'Default Canvas', objects: [], frames: [], promptNodes: [] }]);
            setActiveCanvasId(defaultCanvasId);
        }
    }, []);

    useEffect(() => {
        if (canvases.length > 0) {
            localStorage.setItem('canvases', JSON.stringify(canvases));
            if(activeCanvasId) localStorage.setItem('activeCanvasId', activeCanvasId);
        } else {
            localStorage.removeItem('canvases');
            localStorage.removeItem('activeCanvasId');
        }
    }, [canvases, activeCanvasId]);

    useEffect(() => {
        localStorage.setItem('favoriteCanvasIds', JSON.stringify(favoriteCanvasIds));
    }, [favoriteCanvasIds]);
    
    useEffect(() => {
        setSelectedObjectIds([]);
    }, [activeCanvasId]);

    // This effect ensures the app is never in a "no canvas" state after a deletion.
    useEffect(() => {
        if (canvases.length === 0 && activeCanvasId === null) {
            const defaultCanvas: CanvasState = { id: crypto.randomUUID(), name: 'Default Canvas', objects: [], frames: [], promptNodes: [] };
            setCanvases([defaultCanvas]);
            setActiveCanvasId(defaultCanvas.id);
        }
    }, [canvases, activeCanvasId]);

    // Spacebar panning listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) setIsPanningWithSpace(true); };
        const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setIsPanningWithSpace(false); };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Effect for syncing prompt text area with selected prompt node
    useEffect(() => {
        if (!activeCanvas) return;

        if (selectedObjectIds.length === 1 && selectedObjectIds[0].startsWith('prompt-node-')) {
            const selectedNode = activeCanvas.promptNodes.find(p => p.id === selectedObjectIds[0]);
            if (selectedNode) {
                setPrompt(selectedNode.prompt);
            } else {
                setPrompt(''); // Node not found, clear prompt
            }
        } else {
            setPrompt(''); // No node selected, clear prompt
        }
    }, [selectedObjectIds, activeCanvas]);

    const getCanvasCoordinates = useCallback((screenX: number, screenY: number) => {
        if (!viewportRef.current) return { x: 0, y: 0 };
        const rect = viewportRef.current.getBoundingClientRect();
        const transform = viewTransform;
        const x = (screenX - rect.left - transform.pan.x) / transform.zoom;
        const y = (screenY - rect.top - transform.pan.y) / transform.zoom;
        return { x, y };
    }, [viewTransform]);

    const handleSaveApiConfig = (config: ApiConfig) => {
        const newConfigs = { ...apiConfigs, [config.provider]: config.key };
        setApiConfigs(newConfigs);
        localStorage.setItem('apiConfigs', JSON.stringify(newConfigs));
    };

    const createNewCanvas = () => {
        const newCanvas: CanvasState = {
            id: crypto.randomUUID(),
            name: `Project ${canvases.length + 1}`,
            objects: [],
            frames: [],
            promptNodes: [],
        };
        setCanvases(prev => [...prev, newCanvas]);
        setActiveCanvasId(newCanvas.id);
    };
    
    const handleDeleteCanvas = (idToDelete: string) => {
        if (!window.confirm("Are you sure you want to delete this canvas and all its content? This action cannot be undone.")) {
            return;
        }
    
        setCanvases(prevCanvases => {
            const indexToDelete = prevCanvases.findIndex(c => c.id === idToDelete);
            if (indexToDelete === -1) return prevCanvases;
    
            const newCanvases = prevCanvases.filter(c => c.id !== idToDelete);
    
            if (activeCanvasId === idToDelete) {
                if (newCanvases.length > 0) {
                    const newActiveIndex = Math.max(0, indexToDelete - 1);
                    setActiveCanvasId(newCanvases[newActiveIndex].id);
                } else {
                    // The useEffect will handle creating a new default canvas
                    setActiveCanvasId(null);
                }
            }
    
            // Remove from favorites separately
            setFavoriteCanvasIds(prevFavs => prevFavs.map(favId => (favId === idToDelete ? null : favId)));
            
            return newCanvases;
        });
    };

    const handleRenameCanvas = (id: string, newName: string) => {
        setCanvases(prev => prev.map(c => c.id === id ? {...c, name: newName || "Untitled Canvas" } : c));
        setRenamingCanvasId(null);
    };
    
    const addFormatFrame = (newAspectRatio: number) => {
        if (!activeCanvas) return;

        if (isNaN(newAspectRatio) || newAspectRatio <= 0) {
            setError("Invalid aspect ratio provided.");
            return;
        }

        const viewportBounds = viewportRef.current?.getBoundingClientRect();
        if (!viewportBounds) return;

        const zoom = viewTransform.zoom;
        const maxFrameWidth = viewportBounds.width * 0.5 / zoom;
        const maxFrameHeight = viewportBounds.height * 0.5 / zoom;
        let frameWidth, frameHeight;

        if ((maxFrameWidth / newAspectRatio) > maxFrameHeight) {
            frameHeight = maxFrameHeight;
            frameWidth = frameHeight * newAspectRatio;
        } else {
            frameWidth = maxFrameWidth;
            frameHeight = frameWidth / newAspectRatio;
        }

        const center = getCanvasCoordinates(viewportBounds.left + viewportBounds.width / 2, viewportBounds.top + viewportBounds.height / 2);
        
        const newZIndex = (activeCanvas.frames.length > 0 ? Math.max(...activeCanvas.frames.map(f => f.zIndex)) + 1 : Z_INDEX_BASE_FRAME);

        const newFrame: FrameObject = {
            id: `format-frame-${crypto.randomUUID()}`,
            src: '',
            x: center.x - frameWidth / 2,
            y: center.y - frameHeight / 2,
            width: frameWidth,
            height: frameHeight,
            rotation: 0,
            zIndex: newZIndex,
            aspectRatio: newAspectRatio,
        };

        setCanvases(prev => prev.map(c => c.id === activeCanvasId ? { ...c, frames: [...c.frames, newFrame] } : c));
    };

    const handleAddCustomFrame = () => {
        const ratioRegex = /^\d+(\.\d+)?\s*:\s*\d+(\.\d+)?$/;
        if (!ratioRegex.test(customAspectRatio)) {
            setError('Invalid aspect ratio format. Please use "width:height", e.g., "4:3" or "1.91:1".');
            return;
        }

        const parts = customAspectRatio.replace(/\s/g, '').split(':').map(Number);
        const width = parts[0];
        const height = parts[1];

        if (height === 0) {
            setError("Aspect ratio height cannot be zero.");
            return;
        }
        
        if (isNaN(width) || isNaN(height)) {
            setError("Invalid numbers in aspect ratio.");
            return;
        }

        setError(null); // Clear previous errors
        addFormatFrame(width / height);
    };


    const handleDeleteFrame = (idToDelete: string) => {
        if (!activeCanvas) return;
        setCanvases(prev => prev.map(c => c.id === activeCanvasId ? { ...c, frames: c.frames.filter(f => f.id !== idToDelete), promptNodes: c.promptNodes.filter(p => p.attachedToId !== idToDelete) } : c));
        setSelectedObjectIds(prev => prev.filter(id => id !== idToDelete));
    };

    const handleScreenshotFrame = async (frameId: string) => {
        if (!activeCanvas) return;
        const frame = activeCanvas.frames.find(f => f.id === frameId);
        if (!frame) return;

        try {
            const { dataUrl } = await captureFrameContentAsDataURL(frame, activeCanvas.objects);
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `screenshot-${frameId.substring(0, 8)}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            setError(err instanceof Error ? `Screenshot failed: ${err.message}` : 'An unknown error occurred during screenshot.');
        }
    };

    const handleAddImagesToCanvas = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !activeCanvas) return;
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const limit = 20;
        const currentCount = activeCanvas.objects.length;
        const canAddCount = limit - currentCount;

        if (canAddCount <= 0) {
            setError(`Canvas image limit of ${limit} reached.`);
            if (e.target) e.target.value = '';
            return;
        }

        const filesToAdd = files.slice(0, canAddCount);
        if (filesToAdd.length < files.length) setError(`Only ${filesToAdd.length} were added to reach the limit of ${limit}.`);
        else setError(null);

        let zIndexCounter = activeCanvas.objects.length > 0 ? Math.max(...activeCanvas.objects.map(o => o.zIndex)) + 1 : Z_INDEX_BASE_IMAGE;
        
        const newImageObjects = await Promise.all(filesToAdd.map(file => new Promise<CanvasObject>((resolve, reject) => {
            const src = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => resolve({ id: crypto.randomUUID(), src, x: 0, y: 0, width: 150, height: 150 / (img.width/img.height), rotation: 0, zIndex: zIndexCounter++ });
            img.onerror = reject;
            img.src = src;
        })));

        const viewportBounds = viewportRef.current?.getBoundingClientRect();
        const center = viewportBounds ? getCanvasCoordinates(viewportBounds.left + viewportBounds.width / 2, viewportBounds.top + viewportBounds.height / 2) : { x: 0, y: 0};
        
        const positionedObjects = newImageObjects.map((obj, index) => ({
            ...obj,
            x: center.x - obj.width / 2 + (index - (newImageObjects.length - 1) / 2) * 30,
            y: center.y - obj.height / 2 + (index - (newImageObjects.length - 1) / 2) * 30,
        }));

        setCanvases(prev => prev.map(c => c.id === activeCanvasId ? { ...c, objects: [...c.objects, ...positionedObjects] } : c));
        if (e.target) e.target.value = '';
    };

    const handleDeleteSingleObject = (idToDelete: string) => {
        if (!activeCanvasId) return;
        setCanvases(prev => prev.map(c => c.id === activeCanvasId ? { ...c, objects: c.objects.filter(o => o.id !== idToDelete), promptNodes: c.promptNodes.filter(p => p.attachedToId !== idToDelete) } : c));
        setSelectedObjectIds(prev => prev.filter(id => id !== idToDelete));
    };
    
    // --- PROMPT NODE HANDLERS --- //
    const handleAddPromptNode = () => {
        if (!activeCanvas || selectedObjectIds.length !== 1) return;
        
        const parentId = selectedObjectIds[0];
        const isFrame = parentId.startsWith('format-frame-');
        const parent = isFrame ? activeCanvas.frames.find(f => f.id === parentId) : activeCanvas.objects.find(o => o.id === parentId);

        if (!parent || activeCanvas.promptNodes.some(p => p.attachedToId === parentId)) {
            setError(parent ? "This object already has a prompt node." : "Could not find parent object.");
            return;
        }
        
        const newZIndex = (activeCanvas.promptNodes.length > 0 ? Math.max(...activeCanvas.promptNodes.map(p => p.zIndex)) + 1 : Z_INDEX_BASE_PROMPT_NODE);
        
        const newNode: PromptNodeObject = {
            id: `prompt-node-${crypto.randomUUID()}`,
            attachedToId: parent.id,
            x: parent.x - PROMPT_NODE_WIDTH - 8,
            y: parent.y + parent.height / 2 - PROMPT_NODE_HEIGHT / 2,
            width: PROMPT_NODE_WIDTH,
            height: PROMPT_NODE_HEIGHT,
            zIndex: newZIndex,
            prompt: ''
        };
        
        setCanvases(prev => prev.map(c => c.id === activeCanvasId ? { ...c, promptNodes: [...c.promptNodes, newNode] } : c));
    };

    const handleDeletePromptNode = (idToDelete: string) => {
        if (!activeCanvas) return;
        setCanvases(prev => prev.map(c => c.id === activeCanvasId ? { ...c, promptNodes: c.promptNodes.filter(p => p.id !== idToDelete) } : c));
        setSelectedObjectIds(prev => prev.filter(id => id !== idToDelete));
    };

    const handleRemovePromptNodeForSelected = () => {
        if (!activeCanvas || selectedObjectIds.length !== 1) return;
        const parentId = selectedObjectIds[0];
        const nodeExists = activeCanvas.promptNodes.some(p => p.attachedToId === parentId);

        if (!nodeExists) return;

        setCanvases(prev => prev.map(c => {
            if (c.id !== activeCanvasId) return c;
            const nodeIdToRemove = c.promptNodes.find(p => p.attachedToId === parentId)?.id;
            const newPromptNodes = c.promptNodes.filter(p => p.attachedToId !== parentId);
            
            // If the node itself was selected, deselect it.
            if (nodeIdToRemove) {
                 setSelectedObjectIds(prevIds => prevIds.filter(id => id !== nodeIdToRemove));
            }
            
            return { ...c, promptNodes: newPromptNodes };
        }));
    };

    const handlePromptChange = (newPromptValue: string) => {
        setPrompt(newPromptValue); // Update the local state for immediate UI feedback

        if (selectedObjectIds.length === 1 && selectedObjectIds[0].startsWith('prompt-node-')) {
            const nodeId = selectedObjectIds[0];
            setCanvases(prev => prev.map(c => {
                if (c.id !== activeCanvasId) return c;
                return {
                    ...c,
                    promptNodes: c.promptNodes.map(p => p.id === nodeId ? { ...p, prompt: newPromptValue } : p)
                };
            }));
        }
    };
    
    const handleClearPrompt = () => {
        if (selectedObjectIds.length === 1 && selectedObjectIds[0].startsWith('prompt-node-')) {
            // A node is selected, clear its prompt in the main state
            const nodeId = selectedObjectIds[0];
            setCanvases(prev => prev.map(c => {
                if (c.id !== activeCanvasId) return c;
                return {
                    ...c,
                    promptNodes: c.promptNodes.map(p => p.id === nodeId ? { ...p, prompt: '' } : p)
                };
            }));
            // The useEffect hook watching selectedObjectIds will then clear the textarea
        } else {
            // No node selected, just clear the local prompt state for the textarea
            setPrompt('');
        }
    };
    
    const handleUploadJsonPrompt = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const jsonContent = JSON.parse(event.target?.result as string);
                if (jsonContent.prompt && typeof jsonContent.prompt === 'string') {
                    setPrompt(jsonContent.prompt);
                    setError(null);
                } else {
                     setError("Invalid JSON format. Expected an object with a 'prompt' key.");
                }
            } catch (err) {
                setError("Failed to parse JSON file.");
            }
        };
        reader.readAsText(file);
        if (e.target) e.target.value = ''; // Reset input
    };


    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!activeCanvas) return;
        const { type, targetId, startX, startY, startWidth, startHeight, startRotation, startAspectRatio, centerCanvasX, centerCanvasY, startPositions, movedObjectIds } = interactionRef.current;
        if (!type) return;

        const zoom = viewTransform.zoom;

        if (type === 'pan') {
            setViewTransform(prev => {
                const newPan = { x: prev.pan.x + e.movementX, y: prev.pan.y + e.movementY };
                return { zoom: prev.zoom, pan: newPan };
            });
            return;
        }
        if (!targetId) return;

        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;
        
        const moveTarget = <T extends { id: string, x: number, y: number }>(target: T): T => {
            const startPos = startPositions[target.id];
            if (!startPos) return target; 
            return { ...target, x: startPos.x + dx, y: startPos.y + dy };
        };
        
        setCanvases(prevCanvases => prevCanvases.map(c => {
            if (c.id !== activeCanvasId) return c;

            let newObjects = [...c.objects];
            let newFrames = [...c.frames];
            let newPromptNodes = [...c.promptNodes];

            if (type === 'move') {
                 if (targetId.startsWith('format-frame-')) {
                    newFrames = c.frames.map(f => movedObjectIds.includes(f.id) ? moveTarget(f) : f);
                } else if (targetId.startsWith('prompt-node-')) {
                    // Prevent moving prompt nodes directly
                } else {
                    newObjects = c.objects.map(obj => movedObjectIds.includes(obj.id) ? moveTarget(obj) : obj);
                }
            } else if (type === 'resize-br') {
                if (targetId.startsWith('format-frame-')) {
                    const newWidth = Math.max(50, startWidth + dx);
                    const newHeight = newWidth / startAspectRatio;
                    newFrames = c.frames.map(f => f.id === targetId ? {...f, width: newWidth, height: newHeight } : f);
                } else {
                    const newWidth = Math.max(20, startWidth + dx);
                    const newHeight = Math.max(20, startHeight + dy);
                    newObjects = c.objects.map(o => o.id === targetId ? { ...o, width: newWidth, height: newHeight } : o);
                }
            } else if (type === 'rotate' && !targetId.startsWith('format-frame-') && !targetId.startsWith('prompt-node-')) {
                const mousePos = getCanvasCoordinates(e.clientX, e.clientY);
                const angle = Math.atan2(mousePos.y - centerCanvasY, mousePos.x - centerCanvasX) * (180 / Math.PI);
                const startAngle = Math.atan2(getCanvasCoordinates(startX, startY).y - centerCanvasY, getCanvasCoordinates(startX, startY).x - centerCanvasX) * (180 / Math.PI);
                newObjects = c.objects.map(o => o.id === targetId ? { ...o, rotation: startRotation + (angle - startAngle) } : o);
            }
            
            // Sync prompt nodes with their parents
            const findParent = (id: string) => newObjects.find(o => o.id === id) || newFrames.find(f => f.id === id);

            newPromptNodes = newPromptNodes.map(node => {
                const parent = findParent(node.attachedToId);
                if (parent) {
                    return {
                        ...node,
                        x: parent.x - PROMPT_NODE_WIDTH - 8,
                        y: parent.y + parent.height / 2 - PROMPT_NODE_HEIGHT / 2,
                        height: parent.height, // Auto-adjust height to match parent
                    };
                }
                return node;
            });

            return { ...c, objects: newObjects, frames: newFrames, promptNodes: newPromptNodes };
        }));

    }, [viewTransform, getCanvasCoordinates, activeCanvasId, activeCanvas]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
        interactionRef.current.type = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleInteractionStart = (id: string, e: React.MouseEvent, type: 'move' | 'resize-br' | 'rotate') => {
        e.preventDefault();
        if (!activeCanvas) return;
        
        let currentSelectedIds = selectedObjectIds;
        const isFrame = id.startsWith('format-frame-');
        const isNode = id.startsWith('prompt-node-');
        const isImage = !isFrame && !isNode;

        if (isImage || isFrame) {
            if (!e.shiftKey) {
                currentSelectedIds = selectedObjectIds.includes(id) ? currentSelectedIds : [id];
            } else {
                currentSelectedIds = selectedObjectIds.includes(id) ? selectedObjectIds.filter(sid => sid !== id) : [...selectedObjectIds, id];
            }
        } else if (isNode) {
            currentSelectedIds = [id]; // Nodes are always single selection
        }
        setSelectedObjectIds(currentSelectedIds);
        
        const targetObj: CanvasObject | FrameObject | PromptNodeObject | undefined = 
            isFrame ? activeCanvas.frames.find(f => f.id === id)
            : isNode ? activeCanvas.promptNodes.find(p => p.id === id)
            : activeCanvas.objects.find(o => o.id === id);

        if (!targetObj) return;
        
        let allSelected: (CanvasObject | FrameObject | PromptNodeObject)[] = [];
        let movedObjectIds: string[] = [];
        
        // Prevent prompt nodes from being moved directly
        if (isNode && type === 'move') {
            return;
        }

        if (isNode) {
            allSelected = [targetObj];
            movedObjectIds = [id];
        } else if (isFrame) {
             allSelected = [targetObj];
             movedObjectIds = [id];
        } else { // isImage
             allSelected = activeCanvas.objects.filter(o => currentSelectedIds.includes(o.id));
             movedObjectIds = currentSelectedIds;
        }

        const attachedNodes = activeCanvas.promptNodes.filter(p => movedObjectIds.includes(p.attachedToId));
        allSelected.push(...attachedNodes);
        
        interactionRef.current = {
            type, targetId: id, startX: e.clientX, startY: e.clientY,
            startWidth: targetObj.width, startHeight: targetObj.height, startRotation: (targetObj as CanvasObject).rotation || 0,
            startAspectRatio: (targetObj as FrameObject).aspectRatio || 1,
            centerCanvasX: targetObj.x + targetObj.width / 2, centerCanvasY: targetObj.y + targetObj.height / 2,
            movedObjectIds: movedObjectIds,
            startPositions: Object.fromEntries(allSelected.map(obj => [obj.id, {x: obj.x, y: obj.y}]))
        };

        setCanvases(prev => prev.map(c => {
            if (c.id !== activeCanvasId) return c;

            let updatedObjects = [...c.objects];
            let updatedFrames = [...c.frames];
            let updatedPromptNodes = [...c.promptNodes];

            if (isFrame) {
                const maxFrameZ = c.frames.length > 0 ? Math.max(...c.frames.map(f => f.zIndex)) : Z_INDEX_BASE_FRAME - 1;
                updatedFrames = c.frames.map(f => f.id === id ? { ...f, zIndex: maxFrameZ + 1 } : f);
            } else if (isNode) {
                const maxNodeZ = c.promptNodes.length > 0 ? Math.max(...c.promptNodes.map(p => p.zIndex)) : Z_INDEX_BASE_PROMPT_NODE - 1;
                updatedPromptNodes = c.promptNodes.map(p => p.id === id ? { ...p, zIndex: maxNodeZ + 1 } : p);
            } else { // isImage
                const maxImageZ = c.objects.length > 0 ? Math.max(...c.objects.map(o => o.zIndex)) : Z_INDEX_BASE_IMAGE - 1;
                updatedObjects = c.objects.map(obj => obj.id === id ? { ...obj, zIndex: maxImageZ + 1 } : obj);
            }
            
            // Also bring attached node to front of its layer if the parent was clicked
            if (isImage || isFrame) {
                const maxNodeZ = updatedPromptNodes.length > 0 ? Math.max(...updatedPromptNodes.map(p => p.zIndex)) : Z_INDEX_BASE_PROMPT_NODE - 1;
                updatedPromptNodes = updatedPromptNodes.map(p => p.attachedToId === id ? { ...p, zIndex: maxNodeZ + 1 } : p);
            }

            return {
                ...c,
                objects: updatedObjects,
                frames: updatedFrames,
                promptNodes: updatedPromptNodes,
            };
        }));
    
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleFrameMouseDown = (frameId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeCanvas) return;
    
        const clickCoords = getCanvasCoordinates(e.clientX, e.clientY);
    
        const objectsUnderCursor = activeCanvas.objects
            .filter(obj => isPointInRotatedRect(clickCoords, obj))
            .sort((a, b) => b.zIndex - a.zIndex);
    
        if (objectsUnderCursor.length > 0) {
            handleInteractionStart(objectsUnderCursor[0].id, e, 'move');
        } else {
            handleInteractionStart(frameId, e, 'move');
        }
    };

    const handleViewportMouseDown = (e: React.MouseEvent) => {
        if (e.target !== e.currentTarget) return;

        if (isPanningWithSpace || e.button === 2) { // Middle mouse button is often 1, right is 2
            e.preventDefault();
            interactionRef.current.type = 'pan';
            setIsPanning(true);
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            setSelectedObjectIds([]);
        }
    };
    
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const rect = viewportRef.current!.getBoundingClientRect();
        
        setViewTransform(prev => {
            const { zoom, pan } = prev;
            const newZoom = Math.max(0.1, Math.min(5, e.deltaY < 0 ? zoom * 1.1 : zoom / 1.1));
            
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const mouseOnCanvasX = (mouseX - pan.x) / zoom;
            const mouseOnCanvasY = (mouseY - pan.y) / zoom;
            
            const newPanX = mouseX - mouseOnCanvasX * newZoom;
            const newPanY = mouseY - mouseOnCanvasY * newZoom;

            return {
                zoom: newZoom,
                pan: { x: newPanX, y: newPanY },
            };
        });
    };
    
    const changeZoom = (delta: number) => {
        if (!viewportRef.current) return;
        const viewportBounds = viewportRef.current.getBoundingClientRect();
    
        setViewTransform(prev => {
            const newZoom = Math.max(0.1, Math.min(5, prev.zoom + delta));
            const center = getCanvasCoordinates(viewportBounds.left + viewportBounds.width / 2, viewportBounds.top + viewportBounds.height / 2);
            
            const newPan = { 
                x: (viewportBounds.width / 2) - center.x * newZoom, 
                y: (viewportBounds.height / 2) - center.y * newZoom 
            };
    
            return {
                zoom: newZoom,
                pan: newPan,
            };
        });
    };
    
    const deleteSelectedObjects = () => {
        if (selectedObjectIds.length > 0 && activeCanvasId) {
            setCanvases(prev => prev.map(c => c.id === activeCanvasId ? { ...c, objects: c.objects.filter(o => !selectedObjectIds.includes(o.id)) } : c));
            setSelectedObjectIds([]);
        }
    };

    const handleExportSingleImage = (objectId: string) => {
        const objectToExport = activeCanvas?.objects.find(obj => obj.id === objectId);
        if (!objectToExport) return;

        const link = document.createElement('a');
        link.href = objectToExport.src;
        link.download = `ai-result-export-${objectId.substring(0, 8)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleClearCanvas = () => {
        if (!activeCanvasId) return;
        setCanvases(prev => prev.map(c => c.id === activeCanvasId ? { ...c, objects: [], frames: [], promptNodes: [] } : c));
        setSelectedObjectIds([]);
    };
    
    const handleSendObjectToApi = async (objectId: string, targetApi: 'SD' | 'NB') => {
        if (!activeCanvas) return;
        if (activeCombinedJobs.length >= 10) {
            setError("Maximum of 10 concurrent AI jobs reached.");
            return;
        }

        const isFrame = objectId.startsWith('format-frame-');
        const originalObject = isFrame 
            ? activeCanvas.frames.find(f => f.id === objectId)
            : activeCanvas.objects.find(o => o.id === objectId);

        if (!originalObject) {
            setError("Could not find the source object to process.");
            return;
        }

        // Safety check for frames containing images with their own prompt nodes
        if (isFrame) {
            const frame = originalObject as FrameObject;
            const objectsInFrame = activeCanvas.objects.filter(obj => 
                obj.x < frame.x + frame.width && obj.x + obj.width > frame.x &&
                obj.y < frame.y + frame.height && obj.y + obj.height > frame.y
            );
            const objectIdsInFrame = objectsInFrame.map(obj => obj.id);
            const hasNestedPromptNode = activeCanvas.promptNodes.some(node => 
                objectIdsInFrame.includes(node.attachedToId)
            );

            if (hasNestedPromptNode) {
                setError("Cannot process frame: An image inside the frame has its own prompt node attached. Please remove it and attach a single prompt node to the frame itself.");
                return;
            }
        }

        const attachedNode = activeCanvas.promptNodes.find(p => p.attachedToId === objectId);
        const apiPrompt = attachedNode ? attachedNode.prompt : prompt;

        if (!apiPrompt.trim()) {
            setError(`Please enter an edit prompt or assign one to the selected object's node.`);
            return;
        }

        const provider = targetApi === 'NB' ? 'gemini' : 'seadream';
        const apiKey = apiConfigs[provider];
        if (!apiKey) {
            setError(`API key for ${provider} is required.`);
            return;
        }
        setError(null);

        if (targetApi === 'SD') {
            setApiCallCounts(prev => ({ ...prev, sd: prev.sd + 1 }));
        } else {
            setApiCallCounts(prev => ({ ...prev, nb: prev.nb + 1 }));
        }

        const jobId = crypto.randomUUID();
        setActiveCombinedJobs(prev => [...prev, { id: jobId, provider: targetApi }]);

        try {
            let capturedImage: { dataUrl: string; width: number; height: number; };
            
            if (isFrame) {
                capturedImage = await captureFrameContentAsDataURL(originalObject as FrameObject, activeCanvas.objects);
            } else {
                capturedImage = await captureSingleObjectAsDataURL(originalObject);
            }

            let result: AiEditResult;
            if (targetApi === 'SD') {
                result = await editImageWithSeaDream(capturedImage.dataUrl, apiPrompt, apiKey, capturedImage.width, capturedImage.height);
            } else {
                result = await editImageWithAI(capturedImage.dataUrl, apiPrompt, apiKey);
            }

            if (result.imageUrls && result.imageUrls.length > 0) {
                result.imageUrls.forEach(url => {
                    handleSendResultBackToCompositor(url, {
                        x: originalObject.x,
                        y: originalObject.y,
                        width: originalObject.width,
                        height: originalObject.height,
                    });
                });
            } else {
                throw new Error("AI returned a result with no images.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setActiveCombinedJobs(prev => prev.filter(job => job.id !== jobId));
        }
    };
    
    const handleUpscaleSingleImage = async (objectId: string) => {
        if (!activeCanvas) return;
        const provider = 'seadream';
        const apiKey = apiConfigs[provider];
        if (!apiKey) {
            setError("SeaDream API key must be connected for upscaling.");
            return;
        }
        if (activeCombinedJobs.length >= 10) {
            setError("Maximum of 10 concurrent AI jobs reached.");
            return;
        }
        setError(null);
        setApiCallCounts(prev => ({ ...prev, sd: prev.sd + 1 }));

        const originalObject = activeCanvas.objects.find(o => o.id === objectId);
        if (!originalObject) {
            setError("Could not find source object to upscale.");
            return;
        }

        const upscalePrompt = "CREATIVELY UPSCALE TO 16K RESOLUTION";
        const jobId = crypto.randomUUID();
        setActiveCombinedJobs(prev => [...prev, {id: jobId, provider: 'SD'}]);

        try {
            const result = await editImageWithSeaDream(originalObject.src, upscalePrompt, apiKey, originalObject.width, originalObject.height);

            if (result.imageUrls && result.imageUrls.length > 0) {
                result.imageUrls.forEach(url => {
                    handleSendResultBackToCompositor(url, {
                        x: originalObject.x,
                        y: originalObject.y,
                        width: originalObject.width,
                        height: originalObject.height,
                    });
                });
            } else {
                throw new Error("Upscale process returned no images.");
            }
        } catch (err)
 {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during upscaling.');
        } finally {
            setActiveCombinedJobs(prev => prev.filter(job => job.id !== jobId));
        }
    };

    const handleGenerateTextToImage = async () => {
        const apiKey = apiConfigs['seadream'];
        if (!textGenPrompt.trim() || !apiKey) {
             setError("SeaDream API key must be connected and a prompt provided.");
             return;
        }
        if (activeCombinedJobs.length >= 10) {
            setError("Maximum of 10 concurrent AI jobs reached.");
            return;
        }
        
        setError(null);
        setApiCallCounts(prev => ({ ...prev, sd: prev.sd + 1 }));
        const jobId = crypto.randomUUID();
        setActiveCombinedJobs(prev => [...prev, {id: jobId, provider: 'SD'}]);

        try {
            const imageUrl = await generateImageWithSeaDream(textGenPrompt, apiKey);
            handleSendResultBackToCompositor(imageUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during text-to-image generation.');
        } finally {
            setActiveCombinedJobs(prev => prev.filter(job => job.id !== jobId));
        }
    };
    
    const handleSendResultBackToCompositor = (
        imageUrl: string, 
        originalPosition?: { x: number; y: number; width: number; height: number; }
    ) => {
        if (!activeCanvas) return;
        const img = new Image();
        img.onload = () => {
            const newWidth = 300;
            const newHeight = newWidth / (img.width / img.height);
            
            let newX, newY;

            if (originalPosition) {
                newX = originalPosition.x + (originalPosition.width / 2) - (newWidth / 2);
                newY = originalPosition.y + originalPosition.height + 50; // 50px margin
            } else {
                const viewportBounds = viewportRef.current?.getBoundingClientRect();
                const center = viewportBounds ? getCanvasCoordinates(viewportBounds.left + viewportBounds.width / 2, viewportBounds.top + viewportBounds.height / 2) : { x: 0, y: 0 };
                newX = center.x - newWidth / 2;
                newY = center.y - newHeight / 2;
            }

            const newZIndex = (activeCanvas.objects.length > 0 ? Math.max(...activeCanvas.objects.map(o => o.zIndex)) + 1 : Z_INDEX_BASE_IMAGE);

            const newObject: CanvasObject = {
                id: crypto.randomUUID(),
                src: imageUrl,
                x: newX,
                y: newY,
                width: newWidth,
                height: newHeight,
                rotation: 0,
                zIndex: newZIndex,
                isAiResult: true,
            };
            
            setCanvases(prev => prev.map(c => c.id === activeCanvasId ? { ...c, objects: [...c.objects, newObject] } : c));
        };
        img.src = imageUrl;
    };
    
    const handleDropOnFavorite = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        const canvasId = e.dataTransfer.getData('text/plain');
        const newFavorites = [...favoriteCanvasIds];
        newFavorites[index] = canvasId;
        setFavoriteCanvasIds(newFavorites);
    };

    const handleRemoveFromFavorites = (index: number) => {
        setFavoriteCanvasIds(prev => {
            const newFavs = [...prev];
            if (index >= 0 && index < newFavs.length) {
                newFavs[index] = null;
            }
            return newFavs;
        });
    };

    const handleAsiConfirm = (status: string) => {
        if (status === 'biosecure' || status === 'insecure_exception') {
            setAsiActivationStatus('secure');
        } else if (status === 'insecure_installed') {
            setAsiActivationStatus('insecure');
        } else {
            setAsiActivationStatus('none');
        }
    };

    const isCompositorEmpty = activeCanvas ? activeCanvas.objects.length === 0 && activeCanvas.frames.length === 0 && activeCanvas.promptNodes.length === 0 : true;
    const isTextGenDisabled = !textGenPrompt.trim() || !apiConfigs['seadream'];
    const isAddPromptNodeDisabled = selectedObjectIds.length !== 1 || selectedObjectIds[0].startsWith('prompt-node-');
    const isRemovePromptNodeDisabled = selectedObjectIds.length !== 1 || !activeCanvas?.promptNodes.some(p => p.attachedToId === selectedObjectIds[0]);

    return (
        <div className="flex flex-col h-screen font-sans">
            <header className="flex items-center justify-between p-3 bg-brand-panel border-b border-brand-border shadow-md z-10">
                <div className="flex items-center gap-4">
                    <Icon name="sparkles" className="w-8 h-8 text-brand-gold-light" />
                    <div>
                        <h1 className="text-2xl font-bold text-brand-text">ASI Image Compositor</h1>
                        <p className="text-xs font-mono text-brand-light-gray -mt-1">developed by EPSCOM memetic engineering subcomittee</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <ActionButton 
                        onClick={() => setIsAsiSupportModalOpen(true)}
                        className={asiActivationStatus === 'secure' ? 'shadow-glow-yellow' : ''}
                    >
                        Activate ASI Support Mode
                    </ActionButton>
                    <ActionButton onClick={() => setIsLoginModalOpen(true)}>Login</ActionButton>
                    <ActionButton onClick={() => setIsApiModalOpen(true)}><Icon name="key" className="w-5 h-5"/> Connect API</ActionButton>
                </div>
            </header>
            
            <main className="flex-grow flex overflow-hidden">
                <nav className="w-64 flex-shrink-0 bg-brand-panel border-r border-brand-border p-4 flex flex-col gap-6">
                    <div>
                        <div className="mb-2.5">
                            <input
                                type="text"
                                placeholder="CANVASES (CLICK TO SEARCH)"
                                value={canvasSearchQuery}
                                onChange={(e) => setCanvasSearchQuery(e.target.value)}
                                className="w-full bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-accent"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            {filteredCanvases.map(canvas => (
                                <div key={canvas.id} className="relative">
                                    {renamingCanvasId === canvas.id ? (
                                        <input 
                                            type="text"
                                            defaultValue={canvas.name}
                                            autoFocus
                                            onBlur={(e) => handleRenameCanvas(canvas.id, e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCanvas(canvas.id, (e.target as HTMLInputElement).value)}}
                                            className="bg-brand-surface border border-brand-accent rounded-lg px-3 py-2.5 text-sm w-full outline-none"
                                        />
                                    ) : (
                                        <div className="group">
                                            <SidebarButton 
                                                isActive={activeCanvasId === canvas.id} 
                                                onClick={() => setActiveCanvasId(canvas.id)}
                                                onDoubleClick={() => setRenamingCanvasId(canvas.id)}
                                                onDragStart={(e) => e.dataTransfer.setData('text/plain', canvas.id)}
                                                draggable={true}
                                            >
                                                <Icon name="sparkles" className="w-5 h-5 text-brand-gold-light"/>
                                                <span className="truncate">{canvas.name}</span>
                                            </SidebarButton>
                                             <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteCanvas(canvas.id); }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-brand-light-gray hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title={`Delete ${canvas.name}`}
                                            >
                                                <Icon name="trash" className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <button 
                                onClick={createNewCanvas}
                                className="w-full text-sm text-brand-light-gray hover:text-brand-text hover:bg-brand-surface rounded-lg py-2 mt-2"
                            >
                               + Create New Canvas
                            </button>
                        </div>
                    </div>
                </nav>

                <div className="flex-grow flex flex-col overflow-hidden relative">
                    {/* --- TOOLBARS --- */}
                    <div className="border-b border-brand-border p-2 flex flex-col gap-2">
                        {/* TOP TOOLBAR ROW */}
                        <div className="flex items-center justify-center relative">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2">
                                <ActionButton onClick={handleClearCanvas} disabled={isCompositorEmpty} className="!bg-brand-red text-white hover:!bg-brand-red-dark !py-2">
                                    <Icon name="clear" className="w-5 h-5" /> Clear Canvas
                                </ActionButton>
                            </div>
                    
                            <div className="flex items-center gap-2 flex-wrap justify-center">
                               <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAddImagesToCanvas} />
                                <ActionButton onClick={() => setIsGoogleDriveModalOpen(true)} className="!bg-brand-blue text-white hover:!bg-brand-blue-dark !py-2">
                                    <Icon name="cloud" className="w-5 h-5" /> Google Drive
                                </ActionButton>
                               <div className="flex items-center gap-1 bg-brand-surface rounded-lg p-1 border border-brand-border shadow-sm">
                                   <input 
                                       type="text" 
                                       value={customAspectRatio} 
                                       onChange={(e) => setCustomAspectRatio(e.target.value)}
                                       placeholder="e.g., 4:3"
                                       className="bg-brand-panel border border-brand-border rounded-md px-2 py-2 w-24 text-sm font-mono focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-all outline-none"
                                       aria-label="Custom aspect ratio"
                                   />
                                   <ActionButton onClick={handleAddCustomFrame} className="!bg-brand-gold text-white hover:!bg-brand-gold-hover !py-2">Add Frame</ActionButton>
                               </div>
                               <ActionButton onClick={() => fileInputRef.current?.click()} className="!bg-brand-gold-light text-brand-dark hover:!bg-brand-gold-light-hover !py-2"><Icon name="image" className="w-5 h-5" /> Add Images</ActionButton>
                            </div>
                            
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {activeCombinedJobs.map(job => (
                                    <div key={job.id} className="relative" title={`AI processing (${job.provider})...`}>
                                        <div className="w-8 h-8 flex items-center justify-center">
                                             <Icon name="clock" className={`w-5 h-5 animate-pulse-fast ${job.provider === 'SD' ? 'text-brand-pink' : 'text-brand-gold-light'}`} />
                                        </div>
                                        <div className={`absolute inset-0 rounded-full border pointer-events-none ${job.provider === 'SD' ? 'border-brand-pink/50 shadow-glow-pink' : 'border-brand-gold-light/50 shadow-glow-yellow'}`}></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* BOTTOM TOOLBAR ROW */}
                        <div className="flex items-center justify-between min-h-[40px]">
                             <div className="flex items-center gap-2">
                                <div
                                    className="h-10 w-32 bg-brand-dark rounded-md border border-dashed border-brand-border flex items-center justify-center text-sm font-semibold text-brand-light-gray"
                                    title="SeaDream API calls this session"
                                >
                                    SD Calls:&nbsp;<span className="font-mono text-brand-pink">{apiCallCounts.sd}</span>
                                </div>
                                <div
                                    className="h-10 w-32 bg-brand-dark rounded-md border border-dashed border-brand-border flex items-center justify-center text-sm font-semibold text-brand-light-gray"
                                    title="Nano-Banana API calls this session"
                                >
                                    NB Calls:&nbsp;<span className="font-mono text-brand-gold-light">{apiCallCounts.nb}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="file" accept=".json" className="hidden" ref={jsonFileInputRef} onChange={handleUploadJsonPrompt} />
                                <ActionButton onClick={handleAddPromptNode} disabled={isAddPromptNodeDisabled} className="!bg-white !text-black hover:!bg-gray-200 !py-2 !px-3">
                                    Assign Prompt Node
                                </ActionButton>
                                <ActionButton onClick={handleRemovePromptNodeForSelected} disabled={isRemovePromptNodeDisabled} className="!bg-black !text-white hover:!bg-gray-800 !py-2 !px-3 shadow-glow-white shadow-brand-text/50">
                                    Remove Prompt Node
                                </ActionButton>
                            </div>
                             <div className="flex items-center gap-2">
                                {favoriteCanvasIds.map((favId, index) => {
                                    const canvas = favId ? canvases.find(c => c.id === favId) : null;
                                    return (
                                        <div 
                                            key={index} 
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => handleDropOnFavorite(e, index)}
                                            className="relative group h-10 w-32 bg-brand-dark rounded-md border border-dashed border-brand-border flex items-center justify-center"
                                            title={canvas ? `Favourite: ${canvas.name}` : 'Drag a canvas here'}
                                        >
                                            {canvas ? (
                                                <>
                                                    <button 
                                                        onClick={() => setActiveCanvasId(canvas.id)}
                                                        className="w-full h-full text-sm font-semibold text-brand-light-gray hover:bg-brand-surface transition-colors rounded-md truncate px-2"
                                                    >
                                                        {canvas.name}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveFromFavorites(index); }}
                                                        className="absolute -top-1 -right-1 p-0.5 bg-red-600 rounded-full text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                        title="Remove from Favourites"
                                                    >
                                                        <Icon name="close" className="w-3 h-3" />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-xs text-gray-500">Favourite Canvas</span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div 
                        ref={viewportRef}
                        className={`flex-grow w-full h-full relative overflow-hidden bg-brand-dark bg-[radial-gradient(#4B5563_1px,transparent_1px)] [background-size:16px_16px] ${isPanning ? 'cursor-grabbing' : isPanningWithSpace ? 'cursor-grab' : 'cursor-default'}`}
                        onMouseDown={handleViewportMouseDown}
                        onWheel={handleWheel}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                       {activeCanvas && (
                        <div
                            className="absolute top-0 left-0"
                            style={{
                                transform: `translate(${viewTransform.pan.x}px, ${viewTransform.pan.y}px) scale(${viewTransform.zoom})`,
                                transformOrigin: '0 0',
                            }}
                            onMouseDown={handleViewportMouseDown} // Also add here to allow deselection by clicking canvas
                        >
                            {activeCanvas.promptNodes.map(node => (
                                <PromptNode 
                                    key={node.id} 
                                    node={node}
                                    isSelected={selectedObjectIds.includes(node.id)}
                                    onInteractionStart={handleInteractionStart}
                                    onDelete={handleDeletePromptNode}
                                />
                            ))}

                            {activeCanvas.frames.map(frame => (
                                <FormatFrame 
                                    key={frame.id} 
                                    frame={frame} 
                                    isSelected={selectedObjectIds.includes(frame.id)}
                                    onInteractionStart={handleInteractionStart} 
                                    onFrameMouseDown={handleFrameMouseDown}
                                    onSendToAPI={handleSendObjectToApi} 
                                    onDelete={handleDeleteFrame}
                                    onScreenshot={handleScreenshotFrame}
                                />
                            ))}
                            
                            {activeCanvas.objects.map(obj => (
                                <TransformableImage
                                    key={obj.id} obj={obj} isSelected={selectedObjectIds.includes(obj.id)}
                                    onInteractionStart={handleInteractionStart}
                                    onDelete={handleDeleteSingleObject}
                                    onSendToAPI={handleSendObjectToApi}
                                    onUpscale={handleUpscaleSingleImage}
                                    onExport={handleExportSingleImage}
                                />
                            ))}
                        </div>
                        )}
                         <div className="absolute top-4 right-4 bg-brand-panel p-1 rounded-lg flex items-center gap-1 shadow-lg border border-brand-border text-brand-text z-20">
                            <button onClick={() => changeZoom(-0.1)} className="p-1.5 rounded-md hover:bg-brand-surface"><Icon name="zoom-out" className="w-5 h-5"/></button>
                            <span className="w-12 text-center text-sm font-mono select-none">{Math.round(viewTransform.zoom * 100)}%</span>
                            <button onClick={() => changeZoom(0.1)} className="p-1.5 rounded-md hover:bg-brand-surface"><Icon name="zoom-in" className="w-5 h-5"/></button>
                        </div>
                    </div>
                </div>
                
                <div className="w-96 flex-shrink-0 bg-brand-panel border-l border-brand-border flex flex-col overflow-hidden">
                    <div className="p-4 flex-grow overflow-y-auto">
                        <div className="flex flex-col gap-4">
                            <h2 className="text-lg font-semibold text-brand-text">SeaDream and Nano-Banana: Rapid Iterative Prototyping.</h2>
                            <div className="p-3 bg-sky-200 text-black rounded-lg text-sm border border-sky-400">
                                <button onClick={() => setIsInstructionsOpen(!isInstructionsOpen)} className="w-full text-left font-bold flex justify-between items-center hover:text-gray-800 transition-colors">
                                    <span>{isInstructionsOpen ? 'Object-Centric Workflow:' : 'Click for instructions'}</span>
                                    <span className={`transform transition-transform duration-200 ${isInstructionsOpen ? 'rotate-90' : 'rotate-0'}`}>{'>'}</span>
                                </button>
                                {isInstructionsOpen && (
                                    <div className="mt-2 flex flex-col gap-1 text-black">
                                        <span>1. Add images onto the canvas or generate with SeaDream.</span>
                                        <span>2. Optionally add a frame to group images.</span>
                                        <span>3. Select image(s) or a frame.</span>
                                        <span>4. Use the buttons around the image or frame to upscale or send into an API. Deselect all images before sending a frame into an API.</span>
                                        <span>5. Results returned back from the API have a blue frame around them. Upscale or export them.</span>
                                        <span>6. Assign prompt nodes to either images or a frame to send a prompt together with the image or frame into the API.</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="prompt" className="font-medium text-brand-light-gray mb-2">Edit Prompt</label>
                                <textarea
                                    id="prompt" value={prompt} onChange={(e) => handlePromptChange(e.target.value)}
                                    placeholder={selectedObjectIds.length === 1 && selectedObjectIds[0].startsWith('prompt-node-') ? "Editing selected node's prompt..." : "e.g., A photorealistic image..."}
                                    className="w-full p-2 rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-all duration-200 resize-none"
                                    rows={4}
                                />
                                <div className="flex justify-end items-center gap-2 mt-1">
                                     <button 
                                        onClick={() => jsonFileInputRef.current?.click()} 
                                        className="text-xs text-brand-light-gray hover:text-brand-text underline px-2 py-1"
                                    >
                                        Upload JSON prompt
                                    </button>
                                    <button 
                                        onClick={handleClearPrompt} 
                                        className="text-xs text-brand-light-gray hover:text-brand-text underline px-2 py-1 disabled:opacity-50"
                                        disabled={!prompt}
                                    >
                                        Clear Prompt
                                    </button>
                                </div>
                            </div>
                            
                            <div className="border-t border-brand-border my-4" />
                            <h2 className="text-lg font-semibold text-brand-text">Image Generation: SeaDream</h2>
                            
                            {!apiConfigs['seadream'] && <p className="text-xs text-yellow-400 text-center -mt-2">Connect SeaDream API to enable.</p>}

                            <div className="flex flex-col">
                                <textarea
                                    id="text-gen-prompt" value={textGenPrompt} onChange={(e) => setTextGenPrompt(e.target.value)}
                                    placeholder="e.g., A cat wearing a wizard hat..."
                                    className="w-full p-2 rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-all duration-200 resize-none"
                                    rows={3}
                                />
                            </div>
                            <div className="flex flex-col items-center">
                                <ActionButton onClick={handleGenerateTextToImage} disabled={isTextGenDisabled} className="w-full">
                                    <Icon name="send" className="w-5 h-5"/>
                                    Generate Image with SD API
                                </ActionButton>
                                 <button 
                                    onClick={() => setTextGenPrompt('')} 
                                    className="text-xs text-brand-light-gray hover:text-brand-text underline self-center mt-2 px-2 py-1 disabled:opacity-50"
                                    disabled={!textGenPrompt}
                                >
                                    Clear Prompt
                                </button>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-900/50 text-red-300 rounded-lg text-sm border border-red-700">{error}</div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} currentConfigs={apiConfigs} onSave={handleSaveApiConfig} />
            <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
            <GoogleDriveModal isOpen={isGoogleDriveModalOpen} onClose={() => setIsGoogleDriveModalOpen(false)} />
            <AsiSupportModal 
                isOpen={isAsiSupportModalOpen} 
                onClose={() => setIsAsiSupportModalOpen(false)}
                onConfirm={handleAsiConfirm} 
            />
        </div>
    );
}

export default App;