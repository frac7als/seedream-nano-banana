
export interface UploadedImage {
  id: string;
  src: string;
  name: string;
}

export interface CanvasObject {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  isAiResult?: boolean;
}

export interface FrameObject extends CanvasObject {
    aspectRatio: number;
}

export interface PromptNodeObject {
    id: string;
    attachedToId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    prompt: string;
}

export interface CanvasState {
  id: string;
  name: string;
  objects: CanvasObject[];
  frames: FrameObject[];
  promptNodes: PromptNodeObject[];
}